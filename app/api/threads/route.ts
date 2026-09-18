import { NextResponse } from "next/server";
import {
  listThreads,
  createThread,
  getThread,
  updateThread,
  deleteThread,
  pruneEmptyThreads,
  listMessages,
} from "@/lib/db";
import { withAuth } from "@/lib/api-auth";
import { isChoosableSessionMode } from "@/lib/session-mode";
import { consumeGuidedSessionIfNeeded, TrialLimitError } from "@/lib/trial-usage";
import { getEntitlementForUser, publicEntitlement } from "@/lib/entitlements";
import { hasRequiredConsents } from "@/lib/consents";

export async function GET(request: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (id) {
      const thread = await getThread(id);
      if (!thread) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const messages = await listMessages(id);
      return NextResponse.json({ thread, messages });
    }
    const exceptId = searchParams.get("except");
    await pruneEmptyThreads(exceptId);
    return NextResponse.json({ threads: await listThreads() });
  });
}

export async function POST(request: Request) {
  return withAuth(async (ctx) => {
    const entitlement = await getEntitlementForUser({
      userId: ctx.user.id,
      role: ctx.user.role,
      onboardingCompletedAt: ctx.user.onboardingCompletedAt,
    });

    if (ctx.user.role === "user" && !entitlement.canUseApp) {
      return NextResponse.json(
        {
          error: entitlement.needsOnboarding
            ? "Complete onboarding first"
            : "Subscription required",
          code: entitlement.needsOnboarding ? "needs_onboarding" : "needs_payment",
          entitlement: publicEntitlement(entitlement),
        },
        { status: 402 }
      );
    }

    const body = await request.json();
    if (body.action === "create") {
      if (ctx.user.role === "user") {
        const ok = await hasRequiredConsents(ctx.user.id);
        if (!ok) {
          return NextResponse.json(
            {
              error: "Confirm the safety consent before starting a session",
              code: "needs_consent",
            },
            { status: 403 }
          );
        }
      }
      const thread = await createThread(body.title || "New session");
      return NextResponse.json({ thread });
    }
    if (body.action === "update" && body.id) {
      const patch = body.patch ?? {};
      if (patch.mode !== undefined && !isChoosableSessionMode(patch.mode)) {
        return NextResponse.json(
          { error: "Invalid mode; use guided or free" },
          { status: 400 }
        );
      }

      if (patch.mode !== undefined) {
        if (ctx.user.role === "user") {
          const ok = await hasRequiredConsents(ctx.user.id);
          if (!ok) {
            return NextResponse.json(
              {
                error: "Confirm the safety consent before starting a session",
                code: "needs_consent",
              },
              { status: 403 }
            );
          }
        }
        const existing = await getThread(body.id);
        if (!existing) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        try {
          const nextEntitlement = await consumeGuidedSessionIfNeeded({
            userId: ctx.user.id,
            role: ctx.user.role,
            onboardingCompletedAt: ctx.user.onboardingCompletedAt,
            threadId: body.id,
            previousMode: existing.mode,
            nextMode: patch.mode,
          });
          const thread = await updateThread(body.id, patch);
          return NextResponse.json({
            thread,
            entitlement: publicEntitlement(nextEntitlement),
          });
        } catch (err) {
          if (err instanceof TrialLimitError) {
            return NextResponse.json(
              {
                error: err.message,
                code: err.code,
                entitlement: publicEntitlement(err.entitlement),
              },
              { status: 402 }
            );
          }
          throw err;
        }
      }

      const thread = await updateThread(body.id, patch);
      return NextResponse.json({ thread });
    }
    if (body.action === "delete" && body.id) {
      await deleteThread(body.id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  });
}
