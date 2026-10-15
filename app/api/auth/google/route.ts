import { NextResponse } from "next/server";
import { APP_BASE, safeAppNext } from "@/lib/app-base";
import { getPublicAppUrl } from "@/lib/platform-settings";
import {
  buildGoogleAuthorizeUrl,
  clearGoogleOAuthCookieOptions,
  createGoogleOAuthState,
  getGoogleOAuthCredentials,
  googleAuthErrorPath,
  googleOAuthCookieOptions,
  isGoogleOAuthConfigured,
  parseGoogleReturnTo,
  resolveOAuthAppBase,
  shouldUseSecureAuthCookies,
} from "@/lib/auth/google";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = parseGoogleReturnTo(url.searchParams.get("from"));
  const next = safeAppNext(url.searchParams.get("next"), APP_BASE);

  const configuredUrl = await getPublicAppUrl();
  const appBase = resolveOAuthAppBase(request, configuredUrl);
  const secure = shouldUseSecureAuthCookies(appBase);

  if (!isGoogleOAuthConfigured()) {
    return NextResponse.redirect(
      new URL(googleAuthErrorPath(returnTo, "google_not_configured"), appBase)
    );
  }

  const creds = getGoogleOAuthCredentials()!;
  const redirectUri = `${appBase}/api/auth/google/callback`;

  try {
    const gate = url.searchParams.get("gate") ?? undefined;
    const { state, nonce } = await createGoogleOAuthState({
      next,
      returnTo,
      appBase,
      gate,
    });
    const authorizeUrl = buildGoogleAuthorizeUrl({
      clientId: creds.clientId,
      redirectUri,
      state,
    });

    const res = NextResponse.redirect(authorizeUrl);
    res.cookies.set(googleOAuthCookieOptions(nonce, { secure }));
    return res;
  } catch (err) {
    console.error("[auth/google]", err);
    const res = NextResponse.redirect(
      new URL(googleAuthErrorPath(returnTo, "google"), appBase)
    );
    res.cookies.set(clearGoogleOAuthCookieOptions({ secure }));
    return res;
  }
}
