import type { Metadata } from "next";
import { BrandLockup } from "@/app/components/BrandLockup";
import {
  ReviewInviteView,
  type ReviewInviteState,
} from "@/app/components/ReviewInviteView";
import { reviewInviteByToken } from "@/lib/review-invite";

export const dynamic = "force-dynamic";

/** The page behind the emailed link: tokenised, one-use, never indexed. */
export const metadata: Metadata = {
  title: "Leave a review | Nura",
  robots: { index: false, follow: false },
};

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.t) ? params.t[0] : params.t;
  const token = raw?.trim() ?? "";
  const invite = await reviewInviteByToken(token).catch(() => null);

  const state: ReviewInviteState = !invite
    ? "invalid"
    : invite.usedAt
      ? "used"
      : new Date(invite.expiresAt).getTime() <= Date.now()
        ? "expired"
        : "valid";

  return (
    <div className="feedback-page">
      <div className="feedback-page-inner">
        <div className="feedback-page-brand">
          <BrandLockup tone="color" />
        </div>
        <ReviewInviteView token={token} state={state} />
        <p className="feedback-page-foot">
          Reviews may be published on Nura to help other people. We show your
          first name and your note, never your email.
        </p>
      </div>
    </div>
  );
}
