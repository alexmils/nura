"use client";

import { useEffect, useRef, useState } from "react";
import { AdminPageHeader } from "@/app/components/admin/AdminPageHeader";
import { Avatar } from "@/app/components/Avatar";
import {
  displayNameFor,
  notifyUserUpdated,
  useCurrentUser,
} from "@/app/components/useCurrentUser";
import { fileToAvatarDataUrl } from "@/lib/avatar-client";

export default function AdminSettingsPage() {
  const { user, refresh } = useCurrentUser();
  const [profileName, setProfileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const label = displayNameFor(user);

  useEffect(() => {
    setProfileName(user?.name ?? "");
  }, [user?.name]);

  const saveProfile = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profileName.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      notifyUserUpdated();
      await refresh();
      setMsg("Profile saved.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const onAvatarFile = async (file: File | null) => {
    if (!file) return;
    setAvatarBusy(true);
    setMsg("");
    try {
      const avatarUrl = await fileToAvatarDataUrl(file);
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not upload");
      notifyUserUpdated();
      await refresh();
      setMsg("Photo uploaded.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setAvatarBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeAvatar = async () => {
    setAvatarBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not remove");
      notifyUserUpdated();
      await refresh();
      setMsg("Photo removed.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not remove");
    } finally {
      setAvatarBusy(false);
    }
  };

  return (
    <div className="admin-page">
      <AdminPageHeader
        title="Settings"
        subtitle="Your admin profile photo and display name."
      />
      <main className="admin-main">
        <section className="admin-panel admin-form-stack">
          <h2 className="admin-panel-title">Profile</h2>
          <div className="admin-profile-row">
            <Avatar
              src={user?.avatarUrl}
              alt={label}
              fallback={label}
              className="avatar-lg"
            />
            <div className="min-w-0 flex-1">
              <p className="admin-field-label" style={{ marginBottom: "0.35rem" }}>
                Profile photo
              </p>
              <p className="admin-panel-sub">
                Shown in the admin sidebar. JPG, PNG, or WebP.
              </p>
              <div className="admin-actions-row" style={{ marginTop: "0.65rem" }}>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) =>
                    void onAvatarFile(e.target.files?.[0] ?? null)
                  }
                />
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={avatarBusy}
                  onClick={() => fileRef.current?.click()}
                >
                  {avatarBusy ? "Uploading…" : "Upload photo"}
                </button>
                {user?.avatarUrl ? (
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={avatarBusy}
                    onClick={() => void removeAvatar()}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <label className="admin-field-label">
            Display name
            <input
              type="text"
              className="field"
              value={profileName}
              placeholder="First and last name"
              maxLength={80}
              onChange={(e) => setProfileName(e.target.value)}
            />
          </label>
          <p className="admin-panel-sub">{user?.email ?? "…"}</p>

          <div className="admin-actions-row">
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => void saveProfile()}
            >
              {busy ? "Saving…" : "Save profile"}
            </button>
          </div>
          {msg ? <p className="admin-invite-msg">{msg}</p> : null}
        </section>
        <section className="admin-panel admin-form-stack">
          <h2 className="admin-panel-title">Voice orb</h2>
          <p className="admin-panel-sub">
            Pick the orb shown in voice mode and turn the start / end chimes on
            or off in Platform &rarr; Voice orb.
          </p>
          <a className="btn-secondary w-fit" href="/admin/platform?tab=voice-orb">
            Open the voice orb picker
          </a>
        </section>
      </main>
    </div>
  );
}
