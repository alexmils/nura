"use client";

import { Suspense, useEffect, useState } from "react";
import { AdminPageHeader } from "@/app/components/admin/AdminPageHeader";
import { AdminTabs, useAdminTab } from "@/app/components/admin/AdminTabs";
import { CloudinaryPicker } from "@/app/components/admin/CloudinaryPicker";
import "./media.css";

const TABS = ["library", "settings"] as const;

type Status = {
  cloudName: string;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  configured: boolean;
  source: "settings" | "env" | "none";
  problem?: string | null;
};

function MediaPageInner() {
  const [tab, setTab] = useAdminTab(TABS, "library");
  return (
    <div className="admin-page">
      <AdminPageHeader
        title="Media"
        subtitle="Pictures and clips on the site. New files go to Cloudinary."
      />
      <main className="admin-main">
        <AdminTabs
          tabs={[
            { id: "library", label: "Library" },
            { id: "settings", label: "Settings" },
          ]}
          value={tab}
          onChange={(id) => setTab(id as "library" | "settings")}
        />
        {tab === "settings" ? <MediaSettings /> : <MediaLibrary />}
      </main>
    </div>
  );
}

function MediaLibrary() {
  const [kind, setKind] = useState<"image" | "video">("image");

  return (
    <div className="admin-media">
      <div className="admin-media-kind" role="tablist" aria-label="Media type">
        {(["image", "video"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={kind === value}
            className={kind === value ? "is-active" : ""}
            onClick={() => setKind(value)}
          >
            {value === "image" ? "Images" : "Videos"}
          </button>
        ))}
      </div>

      {/* The same picker the editors use, in manage mode: folders, labels,
          drag to move, and upload. No "Use image" button. */}
      <CloudinaryPicker
        manage
        embedded
        mediaType={kind}
        used={[]}
        defaultFolder="nura/admin"
        onClose={() => undefined}
      />
    </div>
  );
}

function MediaSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [cloudName, setCloudName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/admin/cloudinary")
      .then((res) => res.json())
      .then((body: Status) => {
        setStatus(body);
        setCloudName(body.cloudName || "");
      })
      .catch(() => setMessage("Could not load settings."));
  }, []);

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/cloudinary", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cloudName,
          ...(apiKey.trim() ? { apiKey } : {}),
          ...(apiSecret.trim() ? { apiSecret } : {}),
        }),
      });
      const body = (await res.json().catch(() => null)) as Status & { error?: string };
      if (!res.ok) throw new Error(body?.error || "Could not save.");
      setStatus(body);
      setApiKey("");
      setApiSecret("");
      setMessage("Saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/cloudinary", { method: "POST" });
      const body = (await res.json().catch(() => null)) as { count?: number; error?: string } | null;
      if (!res.ok) throw new Error(body?.error || "Connection failed.");
      setMessage(`Connected. ${body?.count ?? 0} images in the library.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Connection failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-media-settings">
      <p>
        Cloud name, API key, and API secret are on the Cloudinary dashboard under Product Environment Credentials.
        The secret is never shown again. Leave a field blank to keep the stored value.
      </p>
      <label>
        Cloud name
        <input
          value={cloudName}
          onChange={(event) => setCloudName(event.target.value)}
          placeholder="e.g. dxyz123ab (not your email)"
          autoComplete="off"
        />
      </label>
      {status?.problem ? <p className="admin-media-error">{status.problem}</p> : null}
      <p>
        <small>Tip: paste the dashboard&apos;s API environment variable (cloudinary://...) into any field to fill all three.</small>
      </p>
      <label>
        API key
        <input
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={status?.hasApiKey ? "Stored" : ""}
          autoComplete="off"
        />
      </label>
      <label>
        API secret
        <input
          type="password"
          value={apiSecret}
          onChange={(event) => setApiSecret(event.target.value)}
          placeholder={status?.hasApiSecret ? "Stored" : ""}
          autoComplete="new-password"
        />
      </label>
      {status?.source === "env" ? <p>A server environment variable is filling in the missing values.</p> : null}
      {message ? <p>{message}</p> : null}
      <div>
        <button type="button" disabled={busy} onClick={() => void save()}>
          Save
        </button>
        <button type="button" disabled={busy || !status?.configured} onClick={() => void test()}>
          Test connection
        </button>
      </div>
    </div>
  );
}

export default function AdminMediaPage() {
  return (
    <Suspense>
      <MediaPageInner />
    </Suspense>
  );
}
