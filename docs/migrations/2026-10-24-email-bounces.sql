-- Brevo hard-bounce suppression.
-- Idempotent; lib/db.ts runs the same statements at startup.

-- Hard bounce on a member account. The opt-in flag is untouched: the address
-- is suppressed, not unsubscribed. A new opt-in clears this again.
ALTER TABLE users ADD COLUMN IF NOT EXISTS marketing_email_bounced_at TIMESTAMPTZ;

-- Hard bounce on a footer newsletter lead.
ALTER TABLE newsletter_leads ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMPTZ;
