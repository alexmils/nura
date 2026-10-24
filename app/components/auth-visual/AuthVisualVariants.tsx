"use client";

import Image from "next/image";
import { Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  CalendarCheck,
  Hand,
  Headphones,
  MessageCircle,
  Pause,
  Play,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { AuthSessionMockup } from "@/app/components/AuthSessionMockup";
import { BrandSocialLinks } from "@/app/components/BrandSocialLinks";
import { TRIAL_DAYS } from "@/lib/billing-constants";
import "./auth-visual-variants.css";

/**
 * Right pane of the sign-in / sign-up screens. `?auth=1|2|3` previews the
 * three candidate designs; without it the current panel stays the default.
 */
export function AuthVisual({ fallback }: { fallback?: ReactNode }) {
  const current = fallback ?? <AuthSessionMockup />;
  return (
    <Suspense fallback={current}>
      <AuthVisualSwitch fallback={current} />
    </Suspense>
  );
}

function AuthVisualSwitch({ fallback }: { fallback: ReactNode }) {
  const params = useSearchParams();
  switch (params.get("auth")) {
    case "1":
      return <AuthVisualLandscape />;
    case "2":
      return <AuthVisualProduct />;
    case "3":
      return <AuthVisualValue />;
    default:
      return <>{fallback}</>;
  }
}

function Social({ tone }: { tone: "light" | "dark" }) {
  return (
    <div className={`av-social av-social--${tone}`} aria-label="Follow Nura">
      <BrandSocialLinks
        className="av-social-list"
        linkClassName="av-social-link"
        iconSize={16}
        labelled={false}
      />
    </div>
  );
}

/* 1. Calm landscape: full-bleed photo, soft forest overlay, three points. */
export function AuthVisualLandscape() {
  return (
    <div className="av av--landscape">
      <Image
        src="/marketing/landing/green-landscape.jpg"
        alt=""
        fill
        sizes="58vw"
        className="av-photo"
        priority
      />
      <div className="av-photo-shade" aria-hidden="true" />
      <div className="av-landscape-body">
        <p className="av-kicker av-kicker--light">Self-help EMDR</p>
        <p className="av-title av-title--light">
          A quiet place to work through what weighs on you.
        </p>
        <ul className="av-points av-points--light">
          <li>
            <MessageCircle size={18} strokeWidth={1.8} aria-hidden />
            AI agent-guided or self-guided sessions
          </li>
          <li>
            <Pause size={18} strokeWidth={1.8} aria-hidden />
            Pause or stop whenever you need
          </li>
          <li>
            <CalendarCheck size={18} strokeWidth={1.8} aria-hidden />
            {TRIAL_DAYS}-day free trial, cancel anytime
          </li>
        </ul>
        <Social tone="light" />
      </div>
    </div>
  );
}

/* 2. Product preview: a static mock of the session screen in a window. */
export function AuthVisualProduct() {
  return (
    <div className="av av--product">
      <div className="av-product-wash" aria-hidden="true" />
      <div className="av-product-stack">
        <div className="av-window" aria-hidden="true">
          <div className="av-window-bar">
            <span className="av-window-dots" />
            <span className="av-window-url">nurahelp.com/app</span>
          </div>
          <div className="av-app">
            <div className="av-app-side">
              <span className="av-app-logo" />
              <span className="av-app-new">New chat</span>
              <span className="av-app-label">Recent</span>
              <span className="av-app-line av-app-line--on" />
              <span className="av-app-line" />
              <span className="av-app-line av-app-line--short" />
            </div>
            <div className="av-app-main">
              <div className="av-app-head">
                <span className="av-app-title">Evening session</span>
                <span className="av-app-pill">AI agent-guided</span>
              </div>
              <div className="av-chat">
                <p className="av-bubble av-bubble--guide">
                  Welcome back. Before we start, how calm do you feel right
                  now, from 0 to 10?
                </p>
                <p className="av-bubble av-bubble--me">About a 6 today.</p>
                <p className="av-bubble av-bubble--guide">
                  Thanks. Let&apos;s find your calm place first, then begin a
                  short set.
                </p>
              </div>
              <div className="av-dock">
                <span className="av-dock-btn av-dock-btn--play">
                  <Play size={14} strokeWidth={2.2} />
                </span>
                <span className="av-dock-meter">
                  <span />
                </span>
                <span className="av-dock-btn">
                  <Headphones size={14} strokeWidth={2} />
                </span>
                <span className="av-dock-btn">
                  <SlidersHorizontal size={14} strokeWidth={2} />
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="av-product-copy">
          <p className="av-kicker">Inside Nura</p>
          <p className="av-title">Everything for a session, in one calm screen.</p>
          <ul className="av-points">
            <li>
              <MessageCircle size={18} strokeWidth={1.8} aria-hidden />
              A guide that checks in before and after each set
            </li>
            <li>
              <SlidersHorizontal size={18} strokeWidth={1.8} aria-hidden />
              Visuals, sound and speed set the way you like
            </li>
            <li>
              <Hand size={18} strokeWidth={1.8} aria-hidden />
              You stay in control, stop at any moment
            </li>
          </ul>
          <Social tone="dark" />
        </div>
      </div>
    </div>
  );
}

/* 3. Value panel: deep forest, slow light, benefit cards, trial highlight. */
export function AuthVisualValue() {
  return (
    <div className="av av--value">
      <div className="av-glow" aria-hidden="true">
        <span className="av-glow-a" />
        <span className="av-glow-b" />
        <span className="av-glow-c" />
      </div>
      <div className="av-value-body">
        <span className="av-trial">
          <Sparkles size={15} strokeWidth={2} aria-hidden />
          {TRIAL_DAYS}-day free trial
        </span>
        <p className="av-title av-title--light av-title--xl">
          Go at your own pace.
          <br />
          Come back whenever you need.
        </p>
        <p className="av-lead av-lead--light">
          EMDR-style sessions you can run at home, with a guide when you want
          one and quiet when you don&apos;t.
        </p>
        <div className="av-cards">
          <div className="av-card">
            <MessageCircle size={20} strokeWidth={1.8} aria-hidden />
            <p className="av-card-title">Guided or on your own</p>
            <p className="av-card-text">
              Talk it through with the AI agent, or run self-guided sets.
            </p>
          </div>
          <div className="av-card">
            <ShieldCheck size={20} strokeWidth={1.8} aria-hidden />
            <p className="av-card-title">Safety built in</p>
            <p className="av-card-text">
              Grounding and a calm place first, and a pause at any moment.
            </p>
          </div>
          <div className="av-card">
            <CalendarCheck size={20} strokeWidth={1.8} aria-hidden />
            <p className="av-card-title">Full app on every plan</p>
            <p className="av-card-text">
              Try everything free for {TRIAL_DAYS} days, cancel anytime.
            </p>
          </div>
        </div>
        <Social tone="light" />
      </div>
    </div>
  );
}
