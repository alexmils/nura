"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AdminPageHeader } from "@/app/components/admin/AdminPageHeader";

type Item = {
  id: string;
  userId: string;
  score: number;
  comment: string | null;
  source: string;
  adminSeenAt: string | null;
  createdAt: string;
  userEmail?: string;
  userName?: string | null;
};

function sourceLabel(source: string): string {
  if (source === "trial_end_email") return "Trial end email";
  if (source === "review_email") return "Review request email";
  if (source === "page") return "Feedback page";
  if (source === "session_end") return "After session";
  if (source === "forced") return "Forced";
  if (source === "days_elapsed") return "Days elapsed";
  return source;
}

export default function AdminFeedbackPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/feedback");
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error ?? "Could not load feedback");
      return;
    }
    setItems(data.items ?? []);
    setUnread(data.unread ?? 0);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (unread <= 0) return;
    void fetch("/api/admin/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_seen" }),
    }).then(() => setUnread(0));
  }, [unread]);

  return (
    <div className="admin-page">
      <AdminPageHeader
        title="Feedback"
        subtitle="NPS scores, trial emails, and member notes (suggestions and bugs)."
      />
      <main className="admin-main">
        {msg ? <p className="admin-inline-msg">{msg}</p> : null}
        {items.length === 0 ? (
          <p className="admin-muted">No feedback yet.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Member</th>
                  <th>Score</th>
                  <th>Comment</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {new Date(item.createdAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                    <td>
                      <Link href={`/admin/users/${item.userId}`}>
                        {item.userName?.trim() || item.userEmail || item.userId}
                      </Link>
                      {item.userEmail ? (
                        <div className="admin-muted">{item.userEmail}</div>
                      ) : null}
                    </td>
                    <td>
                      <strong>{item.score}</strong>
                      <span className="admin-muted"> / 10</span>
                    </td>
                    <td className="admin-feedback-comment">
                      {item.comment?.trim() || (
                        <span className="admin-muted">—</span>
                      )}
                    </td>
                    <td>{sourceLabel(item.source)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
