"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  EyeOff,
  LayoutGrid,
  List,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";
import { AdminTabs, useAdminTab } from "@/app/components/admin/AdminTabs";
import { InviteForm } from "@/app/components/admin/InviteForm";
import { financeCsv } from "@/lib/admin-finance-format";
import type { AdminUserRow } from "@/lib/admin-stats";
import {
  avatarTone,
  formatJoinedAt,
  userDirectoryStatus,
  userInitials,
  userPlanChip,
  userPlanLabel,
  userRoleLabel,
  userStatusLabel,
} from "@/lib/admin-users-format";
import { fetchJson } from "@/lib/fetch-json";

const TABS = ["directory", "invite"] as const;
type Tab = (typeof TABS)[number];
const ALL_TAB_ITEMS = [
  { id: "directory", label: "Directory" },
  { id: "invite", label: "Invite" },
] as const;

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function UserMark({ user }: { user: AdminUserRow }) {
  const kind = userDirectoryStatus(user);
  const initials = userInitials(user.name, user.email);
  if (user.avatarUrl) {
    return (
      <span className="admin-users-mark-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={user.avatarUrl}
          alt=""
          className="admin-users-mark-img"
        />
        <i className={`admin-users-dot admin-users-dot-${kind}`} />
      </span>
    );
  }
  return (
    <span className="admin-users-mark-wrap">
      <span
        className={`admin-users-mark admin-users-mark-${avatarTone(user.id)}`}
        aria-hidden
      >
        {initials}
      </span>
      <i className={`admin-users-dot admin-users-dot-${kind}`} />
    </span>
  );
}

function AdminUsersPageInner() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<string>("user");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [view, setView] = useState<"list" | "grid">("list");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<string[]>([]);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingUser, setEditingUser] = useState<AdminUserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<"user" | "platform_admin" | "support">("user");
  const [editBusy, setEditBusy] = useState(false);
  const [editMsg, setEditMsg] = useState("");
  const menuRef = useRef<HTMLDivElement | null>(null);

  const canWrite = myRole === "platform_admin";
  const tabItems = canWrite
    ? ALL_TAB_ITEMS
    : ALL_TAB_ITEMS.filter((t) => t.id === "directory");
  const [tab, setTab] = useAdminTab(
    canWrite ? TABS : (["directory"] as const),
    "directory"
  );

  const load = useCallback(async () => {
    const me = await fetchJson<{ user?: { id?: string; role?: string } }>(
      "/api/auth/me"
    );
    setMeId(me.user?.id ?? null);
    setMyRole(me.user?.role ?? "user");
    const usersRes = await fetchJson<{ users: AdminUserRow[] }>(
      "/api/admin/users?limit=200"
    );
    setUsers(usersRes.users ?? []);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } catch (err) {
        console.error(err);
        setError("Could not load users.");
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  useEffect(() => {
    if (!menuFor) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuFor(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuFor(null);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuFor]);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const q = search.trim().toLowerCase();
      const kind = userDirectoryStatus(u);
      const matchesSearch =
        !q ||
        u.email.toLowerCase().includes(q) ||
        (u.name ?? "").toLowerCase().includes(q);
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      const matchesStatus = statusFilter === "all" || kind === statusFilter;
      const matchesPlan = planFilter === "all" || u.plan === planFilter;
      return matchesSearch && matchesRole && matchesStatus && matchesPlan;
    });
  }, [users, search, roleFilter, statusFilter, planFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, statusFilter, planFilter, pageSize]);

  const allVisibleSelected =
    paged.length > 0 && paged.every((u) => selected.includes(u.id));

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      const hide = new Set(paged.map((u) => u.id));
      setSelected((ids) => ids.filter((id) => !hide.has(id)));
    } else {
      setSelected((ids) => [...new Set([...ids, ...paged.map((u) => u.id)])]);
    }
  };

  const exportUsers = (rows: AdminUserRow[]) => {
    downloadCsv(
      `nura-users.csv`,
      financeCsv([
        ["name", "email", "role", "plan", "status", "joined"],
        ...rows.map((u) => [
          u.name ?? "",
          u.email,
          userRoleLabel(u.role),
          userPlanLabel(u.plan),
          userStatusLabel(userDirectoryStatus(u)),
          u.createdAt,
        ]),
      ])
    );
  };

  const deleteUser = async (u: AdminUserRow) => {
    setMenuFor(null);
    if (
      !window.confirm(
        `Delete ${u.email}? All their sessions and data will be removed. An active Stripe subscription must cancel successfully first.`
      )
    ) {
      return;
    }
    try {
      await fetchJson(`/api/admin/users?id=${encodeURIComponent(u.id)}`, {
        method: "DELETE",
      });
      setSelected((ids) => ids.filter((id) => id !== u.id));
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const setStatsExcluded = async (u: AdminUserRow, statsExcluded: boolean) => {
    setMenuFor(null);
    try {
      await fetchJson(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statsExcluded }),
      });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed");
    }
  };

  const setUserStatus = async (u: AdminUserRow, status: "active" | "disabled") => {
    setMenuFor(null);
    try {
      await fetchJson(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed");
    }
  };

  const resendInvite = async (u: AdminUserRow) => {
    setMenuFor(null);
    try {
      await fetchJson(`/api/admin/users/${u.id}/resend-invite`, {
        method: "POST",
      });
      alert("Invite sent.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Resend failed");
    }
  };

  const openEditUser = (u: AdminUserRow) => {
    setMenuFor(null);
    setEditingUser(u);
    setEditName(u.name ?? "");
    setEditRole(
      u.role === "platform_admin"
        ? "platform_admin"
        : u.role === "support"
          ? "support"
          : "user"
    );
    setEditMsg("");
  };

  const saveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditBusy(true);
    setEditMsg("");
    try {
      await fetchJson("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingUser.id,
          name: editName,
          role: editRole,
        }),
      });
      setEditingUser(null);
      await load();
    } catch (err) {
      setEditMsg(err instanceof Error ? err.message : "Update failed");
    } finally {
      setEditBusy(false);
    }
  };

  const actionsFor = (u: AdminUserRow) => {
    const kind = userDirectoryStatus(u);
    const isSelf = u.id === meId;
    return (
      <div className="admin-users-actions" ref={menuFor === u.id ? menuRef : undefined}>
        <button
          type="button"
          className="admin-users-kebab"
          aria-label={`Actions for ${u.name || u.email}`}
          aria-expanded={menuFor === u.id}
          onClick={() => setMenuFor((id) => (id === u.id ? null : u.id))}
        >
          <MoreHorizontal size={16} strokeWidth={1.8} />
        </button>
        {menuFor === u.id && (
          <div className="admin-users-menu" role="menu">
            <Link href={`/admin/users/${u.id}`} role="menuitem">
              View
            </Link>
            {canWrite && (
              <button type="button" role="menuitem" onClick={() => openEditUser(u)}>
                Edit
              </button>
            )}
            {canWrite && (
              <button
                type="button"
                role="menuitem"
                onClick={() => void setStatsExcluded(u, !u.statsExcluded)}
              >
                {u.statsExcluded ? "Count in stats" : "Ignore in stats"}
              </button>
            )}
            {canWrite && kind === "pending" && (
              <button type="button" role="menuitem" onClick={() => void resendInvite(u)}>
                Resend invite
              </button>
            )}
            {canWrite && !isSelf && kind !== "disabled" && (
              <button
                type="button"
                role="menuitem"
                onClick={() => void setUserStatus(u, "disabled")}
              >
                Disable
              </button>
            )}
            {canWrite && !isSelf && kind === "disabled" && (
              <button
                type="button"
                role="menuitem"
                onClick={() => void setUserStatus(u, "active")}
              >
                Enable
              </button>
            )}
            {canWrite && !isSelf && (
              <button
                type="button"
                role="menuitem"
                className="admin-users-menu-danger"
                onClick={() => void deleteUser(u)}
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="admin-page flex min-h-screen items-center justify-center">
        <p className="text-[var(--text-secondary)]">Loading users…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page flex min-h-screen items-center justify-center p-6">
        <p className="text-[var(--destructive)]">{error}</p>
      </div>
    );
  }

  return (
    <div className="admin-page admin-users">
      <header className="admin-users-header">
        <div className="admin-users-header-row">
          <div>
            <h1 className="admin-page-title">Users</h1>
            <p className="admin-page-subtitle">
              Find someone, then use Actions to view, invite, disable, or delete.
            </p>
          </div>
          <div className="admin-users-header-actions">
            <label className="admin-users-search">
              <Search size={15} strokeWidth={1.8} />
              <input
                type="search"
                placeholder="Search users…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search users"
              />
            </label>
            <button
              type="button"
              className="admin-fin-ghost"
              aria-pressed={!filtersOpen}
              onClick={() => setFiltersOpen((open) => !open)}
            >
              <EyeOff size={14} strokeWidth={1.75} />
              {filtersOpen ? "Hide" : "Show"}
            </button>
            <button
              type="button"
              className="admin-fin-ghost"
              onClick={() =>
                exportUsers(
                  selected.length
                    ? users.filter((u) => selected.includes(u.id))
                    : filtered
                )
              }
            >
              <Download size={14} strokeWidth={1.75} />
              Export
            </button>
            {canWrite && (
              <button
                type="button"
                className="admin-users-add"
                onClick={() => setTab("invite")}
              >
                <Plus size={15} strokeWidth={2} />
                Add user
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="admin-main admin-users-main">
        <AdminTabs
          tabs={tabItems}
          value={tab}
          onChange={(id) => setTab(id as Tab)}
        />

        {tab === "invite" && canWrite && (
          <section className="admin-fin-card">
            <h2 className="admin-fin-card-title">Add user</h2>
            <p className="admin-fin-hint">
              Sends an invite email with a create-password link.
            </p>
            <InviteForm onSuccess={() => void load()} />
          </section>
        )}

        {tab === "directory" && (
          <section className="admin-fin-card admin-users-card">
            <div className="admin-users-toolbar">
              {filtersOpen && (
                <div className="admin-users-filters">
                  <label>
                    Role
                    <select
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                    >
                      <option value="all">All</option>
                      <option value="user">User</option>
                      <option value="support">Support</option>
                      <option value="platform_admin">Admin</option>
                    </select>
                  </label>
                  <label>
                    Status
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="all">All</option>
                      <option value="active">Active</option>
                      <option value="pending">Pending invite</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </label>
                </div>
              )}
              <div className="admin-users-toolbar-end">
                {filtersOpen && (
                  <label className="admin-users-plan-filter">
                    Plan
                    <select
                      value={planFilter}
                      onChange={(e) => setPlanFilter(e.target.value)}
                    >
                      <option value="all">All</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                      <option value="free">Free</option>
                      <option value="legacy">Legacy</option>
                    </select>
                  </label>
                )}
                <div className="admin-users-view">
                  <button
                    type="button"
                    className={view === "list" ? "is-active" : ""}
                    aria-label="List view"
                    onClick={() => setView("list")}
                  >
                    <List size={15} />
                  </button>
                  <button
                    type="button"
                    className={view === "grid" ? "is-active" : ""}
                    aria-label="Grid view"
                    onClick={() => setView("grid")}
                  >
                    <LayoutGrid size={15} />
                  </button>
                </div>
              </div>
            </div>

            <p className="admin-users-selected">
              {selected.length} selected
            </p>

            {editingUser && canWrite && (
              <form className="admin-users-edit" onSubmit={(e) => void saveUser(e)}>
                <p className="admin-fin-hint">Edit {editingUser.email}</p>
                <div className="admin-users-edit-row">
                  <input
                    type="text"
                    placeholder="Name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="field"
                  />
                  <select
                    value={editRole}
                    onChange={(e) =>
                      setEditRole(
                        e.target.value as "user" | "platform_admin" | "support"
                      )
                    }
                    className="field"
                    disabled={editingUser.id === meId}
                  >
                    <option value="user">User</option>
                    <option value="support">Support</option>
                    <option value="platform_admin">Admin</option>
                  </select>
                  <button type="submit" disabled={editBusy} className="btn-primary">
                    {editBusy ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setEditingUser(null)}
                  >
                    Cancel
                  </button>
                </div>
                {editingUser.id === meId && (
                  <p className="admin-invite-msg">You cannot change your own role.</p>
                )}
                {editMsg && <p className="admin-invite-msg">{editMsg}</p>}
              </form>
            )}

            {view === "list" ? (
              <div className="admin-table-wrap">
                <table className="admin-users-table">
                  <thead>
                    <tr>
                      <th className="admin-users-check">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleAllVisible}
                          aria-label="Select page"
                        />
                      </th>
                      <th>User</th>
                      <th>Role / plan</th>
                      <th>Plan</th>
                      <th>Status</th>
                      <th>Joined date</th>
                      <th className="admin-users-actions-head">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="admin-table-empty">
                          No users match these filters.
                        </td>
                      </tr>
                    ) : (
                      paged.map((u) => {
                        const kind = userDirectoryStatus(u);
                        return (
                          <tr key={u.id}>
                            <td className="admin-users-check">
                              <input
                                type="checkbox"
                                checked={selected.includes(u.id)}
                                onChange={() =>
                                  setSelected((ids) =>
                                    ids.includes(u.id)
                                      ? ids.filter((id) => id !== u.id)
                                      : [...ids, u.id]
                                  )
                                }
                                aria-label={`Select ${u.email}`}
                              />
                            </td>
                            <td>
                              <Link href={`/admin/users/${u.id}`} className="admin-users-person">
                                <UserMark user={u} />
                                <span>
                                  <strong>{u.name || u.email.split("@")[0]}</strong>
                                  <em>{u.email}</em>
                                  {u.statsExcluded ? (
                                    <em className="admin-users-ignored">Ignored in stats</em>
                                  ) : null}
                                </span>
                              </Link>
                            </td>
                            <td>
                              <p className="admin-users-role">{userRoleLabel(u.role)}</p>
                              <p className="admin-fin-hint">{userPlanLabel(u.plan)}</p>
                            </td>
                            <td>
                              <span className="admin-users-chip" title={userPlanLabel(u.plan)}>
                                {userPlanChip(u.plan)}
                              </span>
                            </td>
                            <td>
                              <span className={`admin-users-status admin-users-status-${kind}`}>
                                {userStatusLabel(kind)}
                              </span>
                            </td>
                            <td className="admin-users-joined">
                              {formatJoinedAt(u.createdAt)}
                            </td>
                            <td>{actionsFor(u)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <ul className="admin-users-grid">
                {paged.length === 0 ? (
                  <li className="admin-users-grid-empty">
                    No users match these filters.
                  </li>
                ) : (
                  paged.map((u) => {
                    const kind = userDirectoryStatus(u);
                    return (
                      <li key={u.id} className="admin-users-card-item">
                        <div className="admin-users-grid-top">
                          <Link href={`/admin/users/${u.id}`} className="admin-users-person">
                            <UserMark user={u} />
                            <span>
                              <strong>{u.name || u.email.split("@")[0]}</strong>
                              <em>{u.email}</em>
                            </span>
                          </Link>
                          {actionsFor(u)}
                        </div>
                        <p className="admin-users-role">{userRoleLabel(u.role)}</p>
                        <span className={`admin-users-status admin-users-status-${kind}`}>
                          {userStatusLabel(kind)}
                        </span>
                      </li>
                    );
                  })
                )}
              </ul>
            )}

            <div className="admin-users-pager">
              <label>
                Rows per page
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </label>
              <p>
                Page {safePage} of {pageCount}
              </p>
              <div className="admin-users-pages">
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={safePage <= 1}
                  onClick={() => setPage((n) => Math.max(1, n - 1))}
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: pageCount }, (_, i) => i + 1)
                  .slice(Math.max(0, safePage - 3), safePage + 2)
                  .map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={n === safePage ? "is-active" : ""}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  ))}
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={safePage >= pageCount}
                  onClick={() => setPage((n) => Math.min(pageCount, n + 1))}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense
      fallback={
        <div className="admin-page flex min-h-screen items-center justify-center">
          <p className="text-[var(--text-secondary)]">Loading users…</p>
        </div>
      }
    >
      <AdminUsersPageInner />
    </Suspense>
  );
}
