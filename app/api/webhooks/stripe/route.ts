import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  getStripeConfig,
  getStripeForLivemode,
  stripePriceIdsFromConfig,
} from "@/lib/stripe";
import {
  findUserIdByStripeCustomer,
  mapStripeSubscription,
  markStripeEventProcessed,
  releaseStripeEvent,
  syncSubscriptionFromStripe,
} from "@/lib/stripe-admin";
import {
  describeInvoicePayment,
  recordBillingEvent,
} from "@/lib/billing-events";
import { getUserByEmail, getUserById, markOnboardingCompleted } from "@/lib/users";
import {
  dispatchConversion,
  isFirstPaidCharge,
} from "@/lib/conversions/dispatch";
import { sendPurchaseReceipt } from "@/lib/email/purchase-receipt";

function verifyStripeEvent(
  body: string,
  sig: string,
  secrets: string[]
): Stripe.Event {
  let lastErr: unknown;
  for (const secret of secrets) {
    if (!secret) continue;
    try {
      return Stripe.webhooks.constructEvent(body, sig, secret);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error("Webhook signature verification failed");
}

/** Stripe webhook — sync subscription state when configured. */
export async function POST(request: Request) {
  const cfg = await getStripeConfig();
  const secrets = [
    cfg.sandbox.webhookSecret.trim(),
    cfg.live.webhookSecret.trim(),
  ].filter(Boolean);
  if (secrets.length === 0) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  let claimedEventId: string | null = null;

  try {
    const body = await request.text();
    const sig = request.headers.get("stripe-signature");
    if (!sig) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const event = verifyStripeEvent(body, sig, secrets);
    const stripe = await getStripeForLivemode(event.livemode);
    if (!stripe) {
      return NextResponse.json(
        {
          error: event.livemode
            ? "Live Stripe secret key is not configured"
            : "Sandbox Stripe secret key is not configured",
        },
        { status: 503 }
      );
    }
    const priceIds = stripePriceIdsFromConfig(
      event.livemode ? cfg.live : cfg.sandbox
    );

    const isNew = await markStripeEventProcessed(event.id, event.type);
    if (!isNew) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    claimedEventId = event.id;

    const resolveUserId = async (
      meta?: {
        user_id?: string;
        user_email?: string;
      },
      customerId?: string | null
    ) => {
      if (meta?.user_id) {
        const u = await getUserById(meta.user_id);
        if (u) return u.id;
      }
      if (meta?.user_email) {
        const u = await getUserByEmail(meta.user_email);
        if (u) return u.id;
      }
      if (customerId) {
        return findUserIdByStripeCustomer(customerId);
      }
      return null;
    };

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as {
        id?: string;
        client_reference_id?: string | null;
        customer?: string | null;
        subscription?: string | null;
        amount_total?: number | null;
        currency?: string | null;
        metadata?: { user_id?: string; user_email?: string; plan?: string };
      };
      const userId = await resolveUserId(
        {
          user_id: session.client_reference_id ?? session.metadata?.user_id,
          user_email: session.metadata?.user_email,
        },
        session.customer ?? null
      );
      if (!userId || !session.subscription) {
        // Do not keep the claim — allow Stripe retry once metadata/user exists.
        await releaseStripeEvent(event.id);
        claimedEventId = null;
        return NextResponse.json({ received: true, skipped: true });
      }
      const sub = await stripe.subscriptions.retrieve(session.subscription);
      const mapped = mapStripeSubscription(sub, priceIds);
      await syncSubscriptionFromStripe({
        userId,
        ...mapped,
        stripeLivemode: event.livemode,
        eventCreatedAt: event.created,
      });
      await markOnboardingCompleted(userId);

      const amountCents = session.amount_total ?? mapped.amountCents ?? 0;
      const isTrial = mapped.status === "trialing" || amountCents === 0;
      await recordBillingEvent({
        userId,
        stripeEventId: event.id,
        eventType: event.type,
        status: isTrial ? "trial_started" : "checkout",
        amountCents,
        currency: session.currency ?? mapped.currency,
        description: isTrial
          ? `Checkout · ${mapped.plan} trial started`
          : `Checkout · ${mapped.plan}`,
        subscriptionId: mapped.stripeSubscriptionId,
        livemode: event.livemode,
        occurredAt: event.created,
      });
    }

    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as {
        id: string;
        status: string;
        customer: string;
        items: {
          data: {
            price?: {
              id?: string;
              unit_amount?: number | null;
              currency?: string;
            } | null;
          }[];
        };
        current_period_end?: number;
        trial_end?: number | null;
        metadata?: { user_id?: string; user_email?: string; plan?: string };
      };

      const userId = await resolveUserId(sub.metadata, sub.customer);
      if (!userId) {
        await releaseStripeEvent(event.id);
        claimedEventId = null;
        return NextResponse.json({ received: true, skipped: true });
      }

      if (event.type === "customer.subscription.deleted") {
        await syncSubscriptionFromStripe({
          userId,
          plan: "free",
          status: "canceled",
          amountCents: 0,
          accessTier: "none",
          stripeCustomerId: sub.customer,
          stripeSubscriptionId: sub.id,
          stripeLivemode: event.livemode,
          eventCreatedAt: event.created,
        });
      } else {
        const mapped = mapStripeSubscription(sub, priceIds);
        await syncSubscriptionFromStripe({
          userId,
          ...mapped,
          stripeLivemode: event.livemode,
          eventCreatedAt: event.created,
        });
        if (mapped.status === "trialing" || mapped.status === "active") {
          await markOnboardingCompleted(userId);
        }
      }
    }

    if (
      event.type === "invoice.payment_failed" ||
      event.type === "invoice.paid"
    ) {
      const invoice = event.data.object as {
        id?: string;
        customer?: string | null;
        subscription?: string | null;
        amount_paid?: number | null;
        amount_due?: number | null;
        currency?: string | null;
        billing_reason?: string | null;
        status?: string | null;
      };
      if (invoice.subscription) {
        const sub = await stripe.subscriptions.retrieve(invoice.subscription);
        const userId = await resolveUserId(
          sub.metadata,
          typeof sub.customer === "string" ? sub.customer : sub.customer?.id
        );
        if (!userId) {
          await releaseStripeEvent(event.id);
          claimedEventId = null;
          return NextResponse.json({ received: true, skipped: true });
        }
        const mapped = mapStripeSubscription(sub, priceIds);
        await syncSubscriptionFromStripe({
          userId,
          ...mapped,
          stripeLivemode: event.livemode,
          eventCreatedAt: event.created,
        });

        const amountCents =
          event.type === "invoice.paid"
            ? (invoice.amount_paid ?? 0)
            : (invoice.amount_due ?? invoice.amount_paid ?? 0);
        const subscriptionId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : mapped.stripeSubscriptionId;

        // Must be read before this invoice is recorded, and only when money
        // actually moved: a trial's $0 `subscription_create` invoice is not a
        // purchase, the `subscription_cycle` charge seven days later is.
        const firstPaidCharge =
          event.type === "invoice.paid" && amountCents > 0
            ? await isFirstPaidCharge({
                subscriptionId,
                invoiceId: invoice.id ?? null,
              })
            : false;

        await recordBillingEvent({
          userId,
          stripeEventId: event.id,
          eventType: event.type,
          status: event.type === "invoice.paid" ? "succeeded" : "failed",
          amountCents,
          currency: invoice.currency ?? mapped.currency,
          description: describeInvoicePayment({
            eventType: event.type,
            amountCents,
            currency: invoice.currency ?? mapped.currency,
            plan: mapped.plan,
            billingReason: invoice.billing_reason,
          }),
          invoiceId: invoice.id ?? null,
          subscriptionId,
          livemode: event.livemode,
          occurredAt: event.created,
        });

        if (firstPaidCharge && invoice.id) {
          // Nobody else can see this charge: the browser is long gone, so the
          // ad platforms are told here or not at all.
          await dispatchConversion({
            kind: "purchase",
            userId,
            transactionId: invoice.id,
            valueCents: amountCents,
            currency: invoice.currency ?? mapped.currency,
            plan: mapped.plan,
            occurredAt: new Date(event.created * 1000),
          });

          // The customer's only confirmation that money moved: checkout stored
          // a card, nothing was charged then, and no email is sent elsewhere.
          await sendPurchaseReceipt({
            userId,
            plan: mapped.plan,
            amountCents,
            currency: invoice.currency ?? mapped.currency,
            paidAt: new Date(event.created * 1000),
            livemode: event.livemode,
          });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[webhooks/stripe]", err);
    if (claimedEventId) {
      try {
        await releaseStripeEvent(claimedEventId);
      } catch (releaseErr) {
        console.error("[webhooks/stripe] release claim", releaseErr);
      }
    }
    return NextResponse.json({ error: "Webhook failed" }, { status: 400 });
  }
}
