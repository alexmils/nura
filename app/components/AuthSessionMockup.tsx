import { BrandSocialLinks } from "@/app/components/BrandSocialLinks";

/**
 * Decorative right-pane mockup for auth: flat ball sweeping edge ↔ edge,
 * SEO-leaning supporting copy, and quiet follow-us social chrome.
 * Pure CSS motion; respects reduced-motion.
 */
export function AuthSessionMockup() {
  return (
    <div className="auth-visual">
      <div className="auth-visual-atmosphere" aria-hidden="true" />
      <div className="auth-visual-stack">
        <div className="auth-visual-device" aria-hidden="true">
          <div className="auth-visual-chrome">
            <span className="auth-visual-dots" />
          </div>
          <div className="auth-visual-stage">
            <div className="auth-visual-track">
              <span className="auth-visual-ball" />
            </div>
          </div>
        </div>
        <div className="auth-visual-copy">
          <p className="auth-visual-kicker">Self-help EMDR</p>
          <p className="auth-visual-title">EMDR therapy online</p>
          <p className="auth-visual-lead">
            AI agent-guided sessions and self-guided visual sets in a calm app.
          </p>
        </div>
        <div className="auth-visual-social-wrap" aria-label="Follow Nura">
          <BrandSocialLinks
            className="auth-visual-social"
            linkClassName="auth-visual-social-link"
            iconSize={16}
            labelled={false}
          />
        </div>
      </div>
    </div>
  );
}
