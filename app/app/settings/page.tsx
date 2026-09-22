"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppleToggle } from "@/app/components/AppleToggle";
import { PasskeySettings } from "@/app/components/PasskeySettings";
import { PasswordSettings } from "@/app/components/PasswordSettings";
import { Avatar } from "@/app/components/Avatar";
import { DeleteAccountZone } from "@/app/components/DeleteAccountZone";
import { MemoryImportDropzone } from "@/app/components/MemoryImportDropzone";
import {
  displayNameFor,
  notifyUserUpdated,
  useCurrentUser,
} from "@/app/components/useCurrentUser";
import { useToast } from "@/app/components/Toast";
import { fileToAvatarDataUrl } from "@/lib/avatar-client";
import type { AppSettings, Memory } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";

type SettingsTab = "profile" | "voice" | "memory" | "security" | "coming-soon";

const ALL_TABS: { id: SettingsTab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "voice", label: "Voice" },
  { id: "memory", label: "Memory" },
  { id: "security", label: "Security" },
  { id: "coming-soon", label: "Coming soon" },
];

function isSettingsTab(value: string | null): value is SettingsTab {
  return (
    value === "profile" ||
    value === "voice" ||
    value === "memory" ||
    value === "security" ||
    value === "coming-soon"
  );
}

function SettingsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [tab, setTab] = useState<SettingsTab>(
    isSettingsTab(tabParam) ? tabParam : "profile"
  );
  const { user, refresh: refreshUser } = useCurrentUser();
  const { toast } = useToast();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [newMemTitle, setNewMemTitle] = useState("");
  const [newMemBody, setNewMemBody] = useState("");
  const [editingMemId, setEditingMemId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [clearingMemory, setClearingMemory] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const tabs = ALL_TABS.filter((t) => t.id !== "memory" || memoryEnabled);

  useEffect(() => {
    setProfileName(user?.name ?? "");
  }, [user?.name]);

  const load = async () => {
    const res = await fetch("/api/settings");
    const data = await res.json();
    setSettings(data.settings ?? DEFAULT_SETTINGS);
    setMemories(data.memories ?? []);
    setMemoryEnabled(data.memoryEnabled !== false);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (isSettingsTab(tabParam)) setTab(tabParam);
  }, [tabParam]);

  useEffect(() => {
    if (!memoryEnabled && tab === "memory") {
      setTab("profile");
      router.replace("/app/settings?tab=profile");
    }
  }, [memoryEnabled, tab, router]);

  useEffect(() => {
    const active = document.querySelector(
      ".settings-nav-item-active"
    ) as HTMLElement | null;
    active?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [tab]);

  const save = async (next: AppSettings) => {
    setSettings(next);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_settings", settings: next }),
      });
      if (!res.ok) throw new Error("Could not save settings");
      toast("Settings saved");
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Could not save settings",
        "error"
      );
    }
  };

  const saveProfile = async () => {
    setProfileSaving(true);
    setProfileError(null);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profileName.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      notifyUserUpdated();
      await refreshUser();
      toast("Profile saved");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save";
      setProfileError(msg);
      toast(msg, "error");
    } finally {
      setProfileSaving(false);
    }
  };

  const onAvatarFile = async (file: File | null) => {
    if (!file) return;
    setAvatarBusy(true);
    setProfileError(null);
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
      await refreshUser();
      toast("Photo uploaded");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setProfileError(msg);
      toast(msg, "error");
    } finally {
      setAvatarBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeAvatar = async () => {
    setAvatarBusy(true);
    setProfileError(null);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: null }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Could not remove");
      }
      notifyUserUpdated();
      await refreshUser();
      toast("Photo removed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Remove failed";
      setProfileError(msg);
      toast(msg, "error");
    } finally {
      setAvatarBusy(false);
    }
  };

  const panelTitle = tabs.find((t) => t.id === tab)?.label ?? "Settings";
  const label = displayNameFor(user);

  return (
    <div className="settings-shell">
      <aside className="settings-sidebar">
        <div className="settings-sidebar-top">
          <Link href="/app" className="settings-back">
            ← Back
          </Link>
          <p className="settings-page-title">Settings</p>
        </div>
        <nav className="settings-nav" aria-label="Settings sections">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`settings-nav-item ${
                tab === t.id ? "settings-nav-item-active" : ""
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="settings-panel">
        <div className="settings-panel-inner">
          <h2 className="settings-panel-title">{panelTitle}</h2>

          {tab === "profile" && (
            <>
            <div className="settings-group">
              <div className="settings-row flex flex-wrap items-center gap-4">
                <Avatar
                  src={user?.avatarUrl}
                  alt={label}
                  fallback={label}
                  className="avatar-lg"
                />
                <div className="min-w-0 flex-1">
                  <p className="settings-body-text">Profile photo</p>
                  <p className="mt-1 settings-help">
                    Shown in chat and the sidebar. JPG, PNG, or WebP.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
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
                    {user?.avatarUrl && (
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={avatarBusy}
                        onClick={() => void removeAvatar()}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <label className="settings-row block">
                <span className="settings-label mb-2">
                  Display name
                </span>
                <input
                  className="field"
                  value={profileName}
                  placeholder="Your name"
                  maxLength={80}
                  onChange={(e) => setProfileName(e.target.value)}
                />
              </label>
              <div className="settings-row flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="settings-muted min-w-0 break-all">
                  {user?.email}
                </p>
                <button
                  type="button"
                  className="btn-primary w-full sm:w-auto"
                  disabled={profileSaving}
                  onClick={() => void saveProfile()}
                >
                  {profileSaving ? "Saving…" : "Save profile"}
                </button>
              </div>
              {profileError && (
                <p className="settings-row settings-body-text text-[var(--destructive)]">
                  {profileError}
                </p>
              )}
            </div>
            <PasswordSettings
              hasPassword={Boolean(user?.hasPassword)}
              email={user?.email}
              onSaved={refreshUser}
            />
            <DeleteAccountZone
              email={user?.email}
              hasPassword={Boolean(user?.hasPassword)}
            />
            </>
          )}

          {tab === "voice" && (
            <div className="settings-group">
              <div className="settings-row settings-toggle-row">
                <div className="min-w-0 flex-1">
                  <span className="settings-body-text">Auto voice</span>
                  <p className="settings-help mt-1">
                    Speak AI replies as they arrive. Pauses during a set. When
                    off, tap the speaker on a message.
                  </p>
                </div>
                <AppleToggle
                  label="Auto voice"
                  checked={settings.autoVoice}
                  onChange={(autoVoice) => void save({ ...settings, autoVoice })}
                />
              </div>
            </div>
          )}

          {tab === "memory" && memoryEnabled && (
            <div className="settings-group">
              <div className="settings-row">
                <p className="settings-lead">
                  Notes here are account-wide. Every AI agent-guided session can
                  use them. Closed sessions may add short notes automatically.
                  Intake history is saved separately and is not listed here.
                </p>
              </div>

              <MemoryImportDropzone
                onImported={() => void load()}
                toast={toast}
              />

              <div className="settings-row space-y-2">
                <p className="settings-label">
                  Notes
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    placeholder="Title"
                    className="field"
                    value={newMemTitle}
                    maxLength={120}
                    onChange={(e) => setNewMemTitle(e.target.value)}
                  />
                  <input
                    placeholder="Short note"
                    className="field"
                    value={newMemBody}
                    onChange={(e) => setNewMemBody(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="btn-primary w-full sm:w-auto"
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/settings", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "create_memory",
                          title: newMemTitle,
                          body: newMemBody,
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok) {
                        throw new Error(data.error || "Could not save note");
                      }
                      setNewMemTitle("");
                      setNewMemBody("");
                      void load();
                      toast("Note saved");
                    } catch (err) {
                      toast(
                        err instanceof Error
                          ? err.message
                          : "Could not save note",
                        "error"
                      );
                    }
                  }}
                >
                  Save note
                </button>
                {memories.length === 0 && (
                  <p className="settings-help">
                    No notes yet. Add one here, import from ChatGPT or Claude, or
                    close an AI agent-guided session to save short notes for next
                    time.
                  </p>
                )}
                {memories.map((m) => (
                  <div key={m.id} className="rounded-[6px] border border-[var(--border)] p-3">
                    {editingMemId === m.id ? (
                      <div className="space-y-2">
                        <input
                          className="field"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                        />
                        <textarea
                          className="field min-h-[4.5rem]"
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={async () => {
                              try {
                                const res = await fetch("/api/settings", {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    action: "update_memory",
                                    id: m.id,
                                    title: editTitle,
                                    body: editBody,
                                  }),
                                });
                                const data = await res.json();
                                if (!res.ok) {
                                  throw new Error(data.error || "Could not save");
                                }
                                setEditingMemId(null);
                                void load();
                                toast("Saved");
                              } catch (err) {
                                toast(
                                  err instanceof Error
                                    ? err.message
                                    : "Could not save",
                                  "error"
                                );
                              }
                            }}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setEditingMemId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="settings-body-text">{m.title}</p>
                          {m.source === "session" && (
                            <span className="settings-mem-source">From session</span>
                          )}
                          {m.source === "import" && (
                            <span className="settings-mem-source">Imported</span>
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-1 settings-help">
                          {m.body}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                              setEditingMemId(m.id);
                              setEditTitle(m.title);
                              setEditBody(m.body);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={async () => {
                              if (!window.confirm("Delete this note?")) return;
                              try {
                                const res = await fetch("/api/settings", {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    action: "delete_memory",
                                    id: m.id,
                                  }),
                                });
                                if (!res.ok) throw new Error("Could not delete");
                                void load();
                                toast("Note deleted");
                              } catch (err) {
                                toast(
                                  err instanceof Error
                                    ? err.message
                                    : "Could not delete",
                                  "error"
                                );
                              }
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="settings-row space-y-2">
                <p className="settings-label">Clear all</p>
                <p className="settings-help">
                  Deletes every note in this list. Intake history stays.
                </p>
                <button
                  type="button"
                  className="btn-danger w-full sm:w-auto"
                  disabled={clearingMemory || memories.length === 0}
                  onClick={async () => {
                    if (
                      !window.confirm(
                        "Delete every memory note? Intake history stays."
                      )
                    ) {
                      return;
                    }
                    setClearingMemory(true);
                    try {
                      const res = await fetch("/api/settings", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "clear_memories" }),
                      });
                      if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        throw new Error(data.error || "Could not clear memory");
                      }
                      void load();
                      toast("Memory cleared");
                    } catch (err) {
                      toast(
                        err instanceof Error
                          ? err.message
                          : "Could not clear memory",
                        "error"
                      );
                    } finally {
                      setClearingMemory(false);
                    }
                  }}
                >
                  {clearingMemory ? "Clearing…" : "Clear all memory"}
                </button>
              </div>
            </div>
          )}

          {tab === "security" && <PasskeySettings />}

          {tab === "coming-soon" && (
            <div className="apple-card border-dashed p-5 opacity-80">
              <p className="settings-lead">
                Additional personalization options will be added in a future
                release.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsPageContent />
    </Suspense>
  );
}
