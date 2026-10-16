"use client";

import { Suspense, useEffect, useState } from "react";
import { AdminPageHeader } from "@/app/components/admin/AdminPageHeader";
import { AdminTabs, useAdminTab } from "@/app/components/admin/AdminTabs";
import "./media.css";

const TABS = ["library", "settings"] as const;

type Asset = {
  url: string;
  publicId: string;
  resource: "image" | "video";
};

type SiteFile = { path: string; kind: "image" | "video" };

type Status = {
  cloudName: string;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  configured: boolean;
  source: "settings" | "env" | "none";
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
          onChange={setTab}
        />
        {tab === "settings" ? <MediaSettings /> : <MediaLibrary />}
      </main>
    </div>
  );
}

function MediaLibrary() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [site, setSite] = useState<SiteFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/cloudinary/assets");
    const body = (await res.json().catch(() => null)) as {
      assets?: Asset[];
      site?: SiteFile[];
      error?: string;
    } | null;
    if (!res.ok) {
      setError(body?.error || "Could not load media.");
      return;
    }
    setError(null);
    setAssets(body?.assets ?? []);
    setSite(body?.site ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function importFile(filePath: string) {
    setBusy(filePath);
    setError(null);
    try {
      const form = new FormData();
      form.set("source", filePath);
      const res = await fetch("/api/admin/marketing-media", { method: "POST", body: form });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error || "Import failed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="admin-media">
      {error ? <p className="admin-media-error">{error}</p> : null}
      <h2>Cloudinary</h2>
      {assets.length === 0 ? <p>No Cloudinary files yet.</p> : null}
      <div className="admin-media-grid">
        {assets.map((asset) => (
          <figure key={asset.publicId}>
            {asset.resource === "video" ? (
              <video src={asset.url} muted playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={asset.url} alt="" />
            )}
            <figcaption>{asset.publicId}</figcaption>
          </figure>
        ))}
      </div>
      <h2>On the site</h2>
      <ul className="admin-media-site">
        {site.map((file) => (
          <li key={file.path}>
            {file.kind === "video" ? (
              <video src={file.path} muted playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={file.path} alt="" />
            )}
            <span>{file.path}</span>
            <button type="button" disabled={busy === file.path} onClick={() => void importFile(file.path)}>
              {busy === file.path ? "Importing…" : "Import to Cloudinary"}
            </button>
          </li>
        ))}
      </ul>
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
        <input value={cloudName} onChange={(event) => setCloudName(event.target.value)} autoComplete="off" />
      </label>
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
