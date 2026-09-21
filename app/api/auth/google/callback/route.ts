import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { APP_BASE, LOGIN_PATH } from "@/lib/app-base";
import { resolveAccessRedirect } from "@/lib/access-gate";
import { clientIp, recordUserLogin, writeAuditEvent } from "@/lib/audit-log";
import {
  canAutoLinkGoogleAccount,
  clearGoogleOAuthCookieOptions,
  exchangeGoogleCode,
  fetchGoogleUserInfo,
  getGoogleOAuthCredentials,
  GOOGLE_OAUTH_COOKIE,
  googleAuthErrorPath,
  isPgUniqueViolation,
  shouldUseSecureAuthCookies,
  resolveOAuthAppBase,
  verifyGoogleOAuthState,
  type GoogleOAuthReturnTo,
} from "@/lib/auth/google";
import {
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { getAppUrl, sendTemplateEmail } from "@/lib/email";
import { notifyAdminsOfSignup } from "@/lib/email/admin-payment-notify";
import { getEntitlementForUser } from "@/lib/entitlements";
import { getPublicAppUrl } from "@/lib/platform-settings";
import { ensureUserAccessStub } from "@/lib/user-access";
import {
  createUser,
  getUserByEmail,
  getUserByGoogleSub,
  linkGoogleAccount,
  type User,
} from "@/lib/users";

async function errorRedirect(
  returnTo: GoogleOAuthReturnTo,
  code: string,
  opts: { secure: boolean; appUrl: string }
) {
  const res = NextResponse.redirect(
    new URL(googleAuthErrorPath(returnTo, code), opts.appUrl)
  );
  res.cookies.set(clearGoogleOAuthCookieOptions({ secure: opts.secure }));
  return res;
}

async function resolveGoogleUser(
  profile: {
    email: string;
    name: string | null;
    sub: string;
  },
  request: Request
): Promise<
  | { ok: true; user: User; isNew: boolean }
  | { ok: false; code: string }
> {
  const bySub = await getUserByGoogleSub(profile.sub);
  if (bySub) {
    if (bySub.status === "disabled") {
      return { ok: false, code: "google_disabled" };
    }
    const linked = await linkGoogleAccount(
      bySub.id,
      profile.sub,
      profile.name
    );
    return { ok: true, user: linked ?? bySub, isNew: false };
  }

  const byEmail = await getUserByEmail(profile.email);
  if (byEmail) {
    if (byEmail.status === "disabled") {
      return { ok: false, code: "google_disabled" };
    }
    if (byEmail.googleSub && byEmail.googleSub !== profile.sub) {
      return { ok: false, code: "google_conflict" };
    }
    if (!canAutoLinkGoogleAccount(byEmail)) {
      return { ok: false, code: "google_link_required" };
    }
    const linked = await linkGoogleAccount(
      byEmail.id,
      profile.sub,
      profile.name
    );
    return { ok: true, user: linked ?? byEmail, isNew: false };
  }

  try {
    const created = await createUser(
      profile.email,
      profile.name ?? undefined,
      "user"
    );
    const linked = await linkGoogleAccount(
      created.id,
      profile.sub,
      profile.name
    );
    const user = linked ?? created;
    await ensureUserAccessStub(user.id);

    try {
      await sendTemplateEmail(user.email, "welcome", {
        name: user.name ?? user.email.split("@")[0],
        loginUrl: await getAppUrl(LOGIN_PATH),
      });
    } catch (err) {
      console.warn("[auth/google/callback] welcome email failed:", err);
    }

    void notifyAdminsOfSignup({
      userId: user.id,
      email: user.email,
      name: user.name,
      source: "google",
    });

    await writeAuditEvent({
      actorUserId: user.id,
      targetUserId: user.id,
      action: "user.created",
      detail: { source: "google_oauth" },
      ip: clientIp(request),
    });

    return { ok: true, user, isNew: true };
  } catch (err) {
    if (!isPgUniqueViolation(err)) throw err;
    // Race: another request created the email — load and link.
    const raced = await getUserByEmail(profile.email);
    if (!raced) throw err;
    if (raced.status === "disabled") {
      return { ok: false, code: "google_disabled" };
    }
    if (raced.googleSub && raced.googleSub !== profile.sub) {
      return { ok: false, code: "google_conflict" };
    }
    if (!canAutoLinkGoogleAccount(raced)) {
      return { ok: false, code: "google_link_required" };
    }
    const linked = await linkGoogleAccount(
      raced.id,
      profile.sub,
      profile.name
    );
    return { ok: true, user: linked ?? raced, isNew: false };
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const configuredUrl = await getPublicAppUrl();
  const stateParamEarly = url.searchParams.get("state");
  const earlyState = stateParamEarly
    ? await verifyGoogleOAuthState(stateParamEarly, configuredUrl)
    : null;
  let returnTo: GoogleOAuthReturnTo = earlyState?.returnTo ?? "login";
  let appBase = earlyState?.appBase ?? resolveOAuthAppBase(request, configuredUrl);
  let secure = shouldUseSecureAuthCookies(appBase);

  const fail = (code: string) =>
    errorRedirect(returnTo, code, { secure, appUrl: appBase });

  const oauthError = url.searchParams.get("error");
  if (oauthError === "access_denied") {
    return fail("google_cancelled");
  }
  if (oauthError) {
    return fail("google");
  }

  const code = url.searchParams.get("code");
  const stateParam = stateParamEarly;
  if (!code || !stateParam) {
    return fail("google");
  }

  const creds = getGoogleOAuthCredentials();
  if (!creds) {
    return fail("google_not_configured");
  }

  const parsed =
    earlyState ?? (await verifyGoogleOAuthState(stateParam, configuredUrl));
  if (!parsed) {
    return fail("google");
  }
  returnTo = parsed.returnTo;
  appBase = parsed.appBase;
  secure = shouldUseSecureAuthCookies(appBase);

  const jar = await cookies();
  const cookieNonce = jar.get(GOOGLE_OAUTH_COOKIE)?.value;
  if (!cookieNonce || cookieNonce !== parsed.nonce) {
    return fail("google");
  }

  const redirectUri = `${appBase}/api/auth/google/callback`;

  try {
    const { accessToken } = await exchangeGoogleCode({
      code,
      redirectUri,
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
    });
    const profile = await fetchGoogleUserInfo(accessToken);

    if (!profile.emailVerified) {
      return fail("google_unverified");
    }

    const resolved = await resolveGoogleUser(profile, request);
    if (!resolved.ok) {
      return fail(resolved.code);
    }

    const { user, isNew } = resolved;

    if (!isNew) {
      await recordUserLogin(user.id, clientIp(request));
      if (user.role === "user") {
        await ensureUserAccessStub(user.id);
      }
    }

    const token = await createSessionToken({
      sub: user.id,
      email: user.email,
      name: user.name ?? profile.name ?? undefined,
      role: user.role,
    });

    const entitlement = await getEntitlementForUser({
      userId: user.id,
      role: user.role,
      onboardingCompletedAt: isNew ? null : user.onboardingCompletedAt,
    });

    const dest = resolveAccessRedirect({
      role: user.role,
      needsOnboarding: entitlement.needsOnboarding,
      needsPayment: entitlement.needsPayment,
      canUseApp: entitlement.canUseApp,
      next: isNew ? `${APP_BASE}/onboarding?registered=1` : parsed.next,
    });

    const res = NextResponse.redirect(new URL(dest, appBase));
    res.cookies.set(sessionCookieOptions(token, { secure }));
    res.cookies.set(clearGoogleOAuthCookieOptions({ secure }));
    return res;
  } catch (err) {
    console.error("[auth/google/callback]", err);
    return fail("google");
  }
}
