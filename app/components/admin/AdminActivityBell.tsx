"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  CreditCard,
  MessageSquareQuote,
  UserRound,
  Volume2,
  VolumeX,
} from "lucide-react";
import { fetchJson } from "@/lib/fetch-json";
import type { AdminActivityItem } from "@/lib/admin-activity-format";
import {
  isAdminNotificationSoundMuted,
  playAdminNotificationBeep,
  setAdminNotificationSoundMuted,
} from "@/lib/admin-notification-sound";

const POLL_MS = 20_000;
const SEEN_KEY = "nura-admin-activity-seen";
const DROPDOWN_LIMIT = 10;

function readSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "[]");
    return new Set(Array.isArray(raw) ? (raw as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeSeen(ids: string[]) {
  window.localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(0, 80)));
}

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

export function AdminActivityBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AdminActivityItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [soundMuted, setSoundMuted] = useState(() =>
    typeof window !== "undefined" ? isAdminNotificationSoundMuted() : false
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const seededRef = useRef(false);
  const prevUnreadRef = useRef(0);

  const poll = useCallback(async () => {
    try {
      const data = await fetchJson<{ items: AdminActivityItem[] }>(
        `/api/admin/activity?limit=${DROPDOWN_LIMIT}`
      );
      const next = data.items ?? [];
      setItems(next);
      const seen = readSeen();
      if (!seededRef.current) {
        seededRef.current = true;
        const ids = next.map((item) => item.id);
        writeSeen([...ids, ...seen].slice(0, 80));
        setUnread(0);
        prevUnreadRef.current = 0;
        return;
      }
      const newUnread = next.filter((item) => !seen.has(item.id)).length;
      if (newUnread > prevUnreadRef.current) {
        playAdminNotificationBeep();
      }
      prevUnreadRef.current = newUnread;
      setUnread(newUnread);
    } catch {
      // Next poll retries.
    }
  }, []);

  useEffect(() => {
    const kickoff = window.setTimeout(() => void poll(), 0);
    const id = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(id);
    };
  }, [poll]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggleSound = () => {
    const next = !soundMuted;
    setSoundMuted(next);
    setAdminNotificationSoundMuted(next);
    if (!next) {
      playAdminNotificationBeep();
    }
  };

  const markSeen = () => {
    const seen = readSeen();
    const ids = items.map((item) => item.id);
    writeSeen([...ids, ...seen]);
    prevUnreadRef.current = 0;
    setUnread(0);
  };

  return (
    <div className="admin-activity-bell" ref={rootRef}>
      <button
        type="button"
        className={`admin-icon-btn${open ? " admin-icon-btn-on" : ""}`}
        aria-label={unread > 0 ? `Activity, ${unread} new` : "Activity"}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          setOpen((value) => {
            const next = !value;
            if (next) markSeen();
            return next;
          });
          void poll();
        }}
      >
        <Bell size={18} strokeWidth={1.75} />
        {unread > 0 ? (
          <span className="admin-activity-bell-badge">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="admin-activity-menu" role="menu">
          <p className="admin-activity-menu-title">Activity</p>
          <div className="admin-activity-menu-scroll">
            {items.length === 0 ? (
              <p className="admin-activity-empty">Nothing yet.</p>
            ) : (
              <ul>
                {items.map((item) => (
                  <li key={item.id}>
                    <Link href={item.href} onClick={() => setOpen(false)}>
                      <span className="admin-activity-icon" aria-hidden>
                        {item.kind === "billing" ? (
                          <CreditCard size={14} strokeWidth={2} />
                        ) : item.kind === "feedback" ? (
                          <MessageSquareQuote size={14} strokeWidth={2} />
                        ) : (
                          <UserRound size={14} strokeWidth={2} />
                        )}
                      </span>
                      <span className="admin-activity-copy">
                        <span className="admin-activity-row">
                          <strong>{item.title}</strong>
                          <time dateTime={item.at}>{ago(item.at)}</time>
                        </span>
                        <span className="admin-activity-detail">
                          {item.detail}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="admin-activity-menu-footer">
            <button
              type="button"
              className="admin-activity-sound-toggle"
              aria-pressed={!soundMuted}
              onClick={toggleSound}
            >
              {soundMuted ? (
                <VolumeX size={16} strokeWidth={2} aria-hidden />
              ) : (
                <Volume2 size={16} strokeWidth={2} aria-hidden />
              )}
              {soundMuted ? "Sound off" : "Sound on"}
            </button>
            <Link
              href="/admin/activity"
              className="admin-activity-see-all"
              onClick={() => setOpen(false)}
            >
              See all
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
