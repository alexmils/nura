"use client";

/**
 * Admin -> Platform -> Voice orb. A grid of the allowlisted orb looks
 * (lib/voice-orb-catalog), each rendered by the real VoiceOrb on the voice
 * stage's cream background, previewed in idle / listening / thinking /
 * speaking. "Use this orb" saves app_settings.voiceOrbId through the
 * admin-only /api/admin/voice-orb (audited), and the chime toggle sits here
 * too.
 *
 * WebGL budget: browsers keep ~16 live contexts per page. The grid has 10,
 * Orbkit pauses any canvas scrolled out of view, and "Focus" mode freezes
 * every card except the hovered / current one on its last frame.
 */

import { useCallback, useEffect, useState } from "react";
import { Check, Pause, Play, Volume2 } from "lucide-react";
import { VoiceOrb, type VoiceOrbState } from "@/app/components/voice/VoiceOrb";
import { playVoiceChime } from "@/app/components/voice/voice-chime-player";
import { setVoicePrefs } from "@/app/components/voice/useVoicePrefs";
import { unlockVoiceAudio } from "@/lib/voice-audio";
import {
  DEFAULT_VOICE_ORB_ID,
  VOICE_ORB_OPTIONS,
  type VoiceOrbId,
} from "@/lib/voice-orb-catalog";
import "./voice-orb-picker.css";

const STATES: VoiceOrbState[] = ["idle", "listening", "thinking", "speaking"];
const CYCLE: VoiceOrbState[] = ["idle", "listening", "thinking", "speaking"];
const CYCLE_MS = 3200;

type Mode = "all" | "focus";

/** A soft synthetic voice level so listening / speaking previews move. */
const previewLevel = () => {
  const t = performance.now() / 1000;
  return 0.45 + 0.35 * Math.sin(t * 5.1) * Math.sin(t * 1.7 + 0.4);
};

export function VoiceOrbPicker() {
  const [current, setCurrent] = useState<VoiceOrbId | null>(null);
  const [sounds, setSounds] = useState(true);
  const [state, setState] = useState<VoiceOrbState>("idle");
  const [cycle, setCycle] = useState(false);
  const [mode, setMode] = useState<Mode>("all");
  const [hovered, setHovered] = useState<VoiceOrbId | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [lost, setLost] = useState(0);

  useEffect(() => {
    let live = true;
    void fetch("/api/admin/voice-orb")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load"))))
      .then((d: { orbId: VoiceOrbId; sounds: boolean }) => {
        if (!live) return;
        setCurrent(d.orbId);
        setSounds(d.sounds !== false);
      })
      .catch(() => {
        if (live) {
          setCurrent(DEFAULT_VOICE_ORB_ID);
          setMsg("Could not load the saved orb; showing the default.");
        }
      });
    return () => {
      live = false;
    };
  }, []);

  // Auto-cycle the preview state.
  useEffect(() => {
    if (!cycle) return;
    const id = window.setInterval(() => {
      setState((s) => CYCLE[(CYCLE.indexOf(s) + 1) % CYCLE.length]);
    }, CYCLE_MS);
    return () => window.clearInterval(id);
  }, [cycle]);

  // Contexts lost and not restored (the events do not bubble, but do pass the
  // capture phase). Orbkit releases and restores a context itself when an
  // effect re-runs (React dev double-mount), so only the net count matters.
  useEffect(() => {
    const onLost = () => setLost((n) => n + 1);
    const onRestored = () => setLost((n) => Math.max(0, n - 1));
    document.addEventListener("webglcontextlost", onLost, true);
    document.addEventListener("webglcontextrestored", onRestored, true);
    return () => {
      document.removeEventListener("webglcontextlost", onLost, true);
      document.removeEventListener("webglcontextrestored", onRestored, true);
    };
  }, []);

  const save = useCallback(
    async (body: { orbId?: VoiceOrbId; sounds?: boolean }, label: string) => {
      setBusy(label);
      setMsg("");
      try {
        const res = await fetch("/api/admin/voice-orb", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const d = (await res.json()) as { orbId?: VoiceOrbId; sounds?: boolean; error?: string };
        if (!res.ok || !d.orbId) throw new Error(d.error || "Save failed");
        setCurrent(d.orbId);
        setSounds(d.sounds !== false);
        setVoicePrefs({ orbId: d.orbId, sounds: d.sounds !== false });
        setMsg(
          body.orbId
            ? `Voice mode now uses \u201c${VOICE_ORB_OPTIONS.find((o) => o.id === d.orbId)?.name ?? d.orbId}\u201d.`
            : `Start and end chimes ${d.sounds ? "on" : "off"}.`
        );
      } catch (err) {
        setMsg(err instanceof Error ? err.message : "Save failed");
      } finally {
        setBusy(null);
      }
    },
    []
  );

  const preview = (kind: "start" | "end") => {
    unlockVoiceAudio();
    playVoiceChime(kind, true);
  };

  return (
    <div className="vo-pick" data-webgl-lost={lost}>
      <div className="vo-pick-toolbar">
        <div className="vo-pick-seg" role="radiogroup" aria-label="Preview state">
          {STATES.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={state === s}
              className={state === s ? "is-on" : ""}
              data-state={s}
              onClick={() => {
                setCycle(false);
                setState(s);
              }}
            >
              {s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`vo-pick-chip${cycle ? " is-on" : ""}`}
          aria-pressed={cycle}
          data-cycle
          onClick={() => setCycle((c) => !c)}
        >
          {cycle ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}
          Auto-cycle
        </button>
        <div className="vo-pick-seg" role="radiogroup" aria-label="Animation">
          <button type="button" role="radio" aria-checked={mode === "all"} className={mode === "all" ? "is-on" : ""} onClick={() => setMode("all")}>
            Animate all
          </button>
          <button type="button" role="radio" aria-checked={mode === "focus"} className={mode === "focus" ? "is-on" : ""} onClick={() => setMode("focus")}>
            Hover only
          </button>
        </div>
      </div>

      <div className="vo-pick-grid">
        {VOICE_ORB_OPTIONS.map((o) => {
          const isCurrent = o.id === current;
          const paused = mode === "focus" && hovered !== o.id && !isCurrent;
          return (
            <article
              key={o.id}
              className={`vo-pick-card${isCurrent ? " is-current" : ""}`}
              data-orb-card={o.id}
              onMouseEnter={() => setHovered(o.id)}
              onMouseLeave={() => setHovered((h) => (h === o.id ? null : h))}
              onFocus={() => setHovered(o.id)}
            >
              <div className="vo-pick-stage">
                <VoiceOrb orbId={o.id} state={state} level={previewLevel} paused={paused} />
                {isCurrent ? (
                  <span className="vo-pick-badge">
                    <Check size={12} aria-hidden /> Current
                  </span>
                ) : null}
              </div>
              <div className="vo-pick-meta">
                <h3 className="vo-pick-name">{o.name}</h3>
                <p className="vo-pick-blurb">{o.blurb}</p>
                <p className="vo-pick-tags">
                  <span>{o.base.toUpperCase()}</span>
                  {o.variant ? <span>Nura variant</span> : null}
                  <span>{o.license}</span>
                </p>
              </div>
              <button
                type="button"
                className={isCurrent ? "btn-secondary" : "btn-primary"}
                disabled={isCurrent || busy !== null || current === null}
                data-use-orb={o.id}
                onClick={() => void save({ orbId: o.id }, o.id)}
              >
                {isCurrent ? "In use" : busy === o.id ? "Saving\u2026" : "Use this orb"}
              </button>
            </article>
          );
        })}
      </div>

      <div className="vo-pick-sounds">
        <label className="vo-pick-toggle">
          <input
            type="checkbox"
            checked={sounds}
            disabled={busy !== null || current === null}
            data-voice-sounds
            onChange={(e) => void save({ sounds: e.target.checked }, "sounds")}
          />
          <span>
            <strong>Start and end chimes</strong>
            <span className="admin-panel-sub">
              A soft rising chime when voice mode opens and a lower, gentler one when it ends.
            </span>
          </span>
        </label>
        <div className="vo-pick-sound-actions">
          <button type="button" className="btn-secondary" onClick={() => preview("start")}>
            <Volume2 size={14} aria-hidden /> Start chime
          </button>
          <button type="button" className="btn-secondary" onClick={() => preview("end")}>
            <Volume2 size={14} aria-hidden /> End chime
          </button>
        </div>
      </div>

      {msg ? (
        <p className="admin-invite-msg" role="status">
          {msg}
        </p>
      ) : null}
      <p className="admin-panel-sub">
        All orbs are Orbkit originals, MIT licensed (c) 2026 zzzzshawn. Saved immediately; open
        voice mode to see it full size.
      </p>
    </div>
  );
}
