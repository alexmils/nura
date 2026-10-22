import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureFeedbackSchema } from "@/lib/feedback-db";
import { isValidFeedbackScore } from "@/lib/feedback";
import { notifyAdminsOfFeedback } from "@/lib/feedback-notify";
import { getUserById } from "@/lib/users";
import {
  ensureReviewInviteSchema,
  hashReviewToken,
  isPlausibleReviewToken,
  reviewInviteByToken,
} from "@/lib/review-invite";

/**
 * The public side of a review invite. The token is the credential: there is no
 * account to sign in to, so the link is unguessable, one-use and expires. Both
 * answers are deliberately terse — an invalid link should not reveal whether a
 * member exists.
 */

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const invite = await reviewInviteByToken(token);

  if (!invite) {
    return NextResponse.json({ valid: false, reason: "invalid" }, { status: 404 });
  }
  if (invite.usedAt) {
    return NextResponse.json({ valid: false, reason: "used" }, { status: 409 });
  }
  if (new Date(invite.expiresAt).getTime() <= Date.now()) {
    return NextResponse.json(
      { valid: false, reason: "expired" },
      { status: 410 }
    );
  }
  return NextResponse.json({ valid: true });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  const score = typeof body.score === "number" ? body.score : Number(body.score);
  const commentText =
    typeof body.comment === "string" ? body.comment.trim() : "";
  const comment = commentText ? commentText.slice(0, 2000) : null;

  if (!isPlausibleReviewToken(token)) {
    return NextResponse.json({ error: "invalid" }, { status: 404 });
  }
  if (!isValidFeedbackScore(score)) {
    return NextResponse.json({ error: "Invalid score" }, { status: 400 });
  }

  await ensureReviewInviteSchema();
  await ensureFeedbackSchema();

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query<{
      user_id: string;
      expires_at: Date;
      used_at: Date | null;
    }>(
      `SELECT user_id, expires_at, used_at
       FROM review_invites
       WHERE token_hash = $1
       FOR UPDATE`,
      [hashReviewToken(token)]
    );
    const invite = rows[0];

    if (!invite) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "invalid" }, { status: 404 });
    }
    if (invite.used_at) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "used" }, { status: 409 });
    }
    if (new Date(invite.expires_at).getTime() <= Date.now()) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "expired" }, { status: 410 });
    }

    // One review per member. A second invite should not create a second row.
    const existing = await client.query(
      `SELECT 1 FROM feedback_responses WHERE user_id = $1 LIMIT 1`,
      [invite.user_id]
    );
    if (existing.rowCount) {
      await client.query(
        `UPDATE review_invites SET used_at = NOW() WHERE token_hash = $1`,
        [hashReviewToken(token)]
      );
      await client.query("COMMIT");
      return NextResponse.json(
        { error: "already_submitted" },
        { status: 409 }
      );
    }

    const id = crypto.randomUUID();
    await client.query(
      `INSERT INTO feedback_responses (id, user_id, score, comment, source, kind, created_at)
       VALUES ($1, $2, $3, $4, 'review_email', 'review', NOW())`,
      [id, invite.user_id, score, comment]
    );
    await client.query(
      `UPDATE review_invites SET used_at = NOW() WHERE token_hash = $1`,
      [hashReviewToken(token)]
    );
    await client.query("COMMIT");

    const member = await getUserById(invite.user_id).catch(() => null);
    await notifyAdminsOfFeedback({
      feedback: {
        id,
        score,
        comment,
        source: "review_email",
        kind: "review",
        userEmail: member?.email ?? null,
        userName: member?.name ?? null,
      },
      user: member,
    }).catch((err) => console.error("[review/notify]", err));

    return NextResponse.json({ ok: true, feedback: { id } });
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.error("[review] submit failed", err);
    return NextResponse.json(
      { error: "Could not save the review" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
