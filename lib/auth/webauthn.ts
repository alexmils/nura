import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { isoBase64URL, isoUint8Array } from "@simplewebauthn/server/helpers";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { BRAND_SPOKEN } from "@/lib/brand";

type AuthenticatorTransport =
  | "ble"
  | "cable"
  | "hybrid"
  | "internal"
  | "nfc"
  | "smart-card"
  | "usb";

const CHALLENGE_COOKIE = "emdr_webauthn_challenge";
const CHALLENGE_TTL_SEC = 5 * 60;

export function getWebAuthnConfig() {
  const appUrl = process.env.APP_URL ?? "http://localhost:3471";
  const url = new URL(appUrl);
  const rpID = process.env.WEBAUTHN_RP_ID ?? url.hostname;
  const origin = process.env.WEBAUTHN_ORIGIN ?? url.origin;
  return {
    rpName: BRAND_SPOKEN,
    rpID,
    origin,
  };
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set (min 32 chars)");
  }
  return new TextEncoder().encode(secret);
}

type ChallengePayload = {
  challenge: string;
  type: "registration" | "authentication";
  userId?: string;
};

export async function storeChallenge(
  payload: ChallengePayload
): Promise<void> {
  const token = await new SignJWT({
    challenge: payload.challenge,
    type: payload.type,
    userId: payload.userId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${CHALLENGE_TTL_SEC}s`)
    .sign(getSecret());

  const jar = await cookies();
  jar.set({
    name: CHALLENGE_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CHALLENGE_TTL_SEC,
  });
}

export async function consumeChallenge(
  type: ChallengePayload["type"]
): Promise<ChallengePayload | null> {
  const jar = await cookies();
  const token = jar.get(CHALLENGE_COOKIE)?.value;
  jar.set({
    name: CHALLENGE_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.challenge !== "string" ||
      payload.type !== type
    ) {
      return null;
    }
    return {
      challenge: payload.challenge,
      type,
      userId:
        typeof payload.userId === "string" ? payload.userId : undefined,
    };
  } catch {
    return null;
  }
}

export async function createRegistrationOptions(input: {
  userId: string;
  email: string;
  name?: string | null;
  excludeCredentialIds: string[];
}) {
  const { rpName, rpID } = getWebAuthnConfig();
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: input.email,
    userDisplayName: input.name ?? input.email,
    userID: isoUint8Array.fromUTF8String(input.userId),
    attestationType: "none",
    excludeCredentials: input.excludeCredentialIds.map((id) => ({ id })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
      authenticatorAttachment: "platform",
    },
  });
  await storeChallenge({
    challenge: options.challenge,
    type: "registration",
    userId: input.userId,
  });
  return options;
}

export async function verifyRegistration(input: {
  userId: string;
  response: RegistrationResponseJSON;
}) {
  const stored = await consumeChallenge("registration");
  if (!stored || stored.userId !== input.userId) {
    throw new Error("Passkey registration challenge expired. Try again.");
  }
  const { origin, rpID } = getWebAuthnConfig();
  const verification = await verifyRegistrationResponse({
    response: input.response,
    expectedChallenge: stored.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: false,
  });
  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Passkey registration could not be verified");
  }
  return verification.registrationInfo;
}

export async function createAuthenticationOptions(input: {
  allowCredentialIds?: string[];
}) {
  const { rpID } = getWebAuthnConfig();
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
    allowCredentials: input.allowCredentialIds?.map((id) => ({ id })),
  });
  await storeChallenge({
    challenge: options.challenge,
    type: "authentication",
  });
  return options;
}

export async function verifyAuthentication(input: {
  response: AuthenticationResponseJSON;
  credential: {
    id: string;
    publicKey: Uint8Array;
    counter: number;
    transports?: AuthenticatorTransport[];
  };
}) {
  const stored = await consumeChallenge("authentication");
  if (!stored) {
    throw new Error("Passkey login challenge expired. Try again.");
  }
  const { origin, rpID } = getWebAuthnConfig();
  return verifyAuthenticationResponse({
    response: input.response,
    expectedChallenge: stored.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: input.credential.id,
      publicKey: new Uint8Array(input.credential.publicKey) as Uint8Array<ArrayBuffer>,
      counter: input.credential.counter,
      transports: input.credential.transports,
    },
    requireUserVerification: false,
  });
}

export function publicKeyToBase64Url(publicKey: Uint8Array): string {
  return isoBase64URL.fromBuffer(
    new Uint8Array(publicKey) as Uint8Array<ArrayBuffer>
  );
}

export function publicKeyFromBase64Url(value: string): Uint8Array {
  return new Uint8Array(isoBase64URL.toBuffer(value));
}
