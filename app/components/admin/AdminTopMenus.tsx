"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Inbox,
  ListTodo,
  Plus,
  Settings2,
  UserPlus,
  BookOpen,
} from "lucide-react";
import { displayNameFor } from "@/app/components/useCurrentUser";

type AdminTopUser = {
  email: string;
  name: string | null;
  avatarUrl?: string | null;
  role?: string;
};

const NEW_ITEMS = [
  {
    href: "/admin/users?tab=invite",
    label: "Invite a user",
    hint: "Send a create-password email",
    Icon: UserPlus,
  },
  {
    href: "/admin/tasks",
    label: "New task",
    hint: "Add something to the board",
    Icon: ListTodo,
  },
  {
    href: "/admin/resources?tab=editor",
    label: "New article",
    hint: "Write a guide",
    Icon: BookOpen,
  },
] as const;

function useDismiss(open: boolean, close: () => void) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return rootRef;
}

export function AdminNewMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useDismiss(open, () => setOpen(false));

  return (
    <div className="admin-new" ref={rootRef}>
      <button
        type="button"
        className={`admin-new-btn${open ? " admin-icon-btn-on" : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <Plus size={16} strokeWidth={2} aria-hidden />
        New
        <ChevronDown size={14} strokeWidth={2} aria-hidden />
      </button>
      {open ? (
        <div className="admin-top-menu" role="menu">
          {NEW_ITEMS.map(({ href, label, hint, Icon }) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              <span className="admin-activity-icon" aria-hidden>
                <Icon size={14} strokeWidth={2} />
              </span>
              <span>
                <strong>{label}</strong>
                <span>{hint}</span>
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AdminInboxLink({ unread }: { unread: number }) {
  return (
    <Link
      href="/admin/help?tab=inbox"
      className="admin-icon-btn"
      aria-label={unread > 0 ? `Inbox, ${unread} new` : "Inbox"}
    >
      <Inbox size={18} strokeWidth={1.75} />
      {unread > 0 ? (
        <span className="admin-activity-bell-badge">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}

function initials(label: string): string {
  const parts = label.trim().split(/\s+/).slice(0, 2);
  const letters = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return letters || "?";
}

export function AdminUserMenu({
  user,
  onLogout,
}: {
  user: AdminTopUser | null;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useDismiss(open, () => setOpen(false));
  const label = displayNameFor(
    user
      ? {
          id: "",
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl ?? null,
          role: user.role,
        }
      : null
  );
  const mark = initials(label);

  return (
    <div className="admin-user-menu" ref={rootRef}>
      <button
        type="button"
        className={`admin-user-btn${open ? " admin-icon-btn-on" : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
      >
        {user?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt="" />
        ) : (
          mark
        )}
      </button>
      {open ? (
        <div className="admin-top-menu admin-user-menu-panel" role="menu">
          <div className="admin-user-menu-head">
            <strong>{label}</strong>
            <span>{user?.role === "support" ? "Support" : "Admin"}</span>
          </div>
          <Link href="/admin/settings" role="menuitem" onClick={() => setOpen(false)}>
            <Settings2 size={16} strokeWidth={1.75} aria-hidden />
            Settings
          </Link>
          {user?.role === "platform_admin" ? (
            <Link href="/admin/platform" role="menuitem" onClick={() => setOpen(false)}>
              <Settings2 size={16} strokeWidth={1.75} aria-hidden />
              Platform
            </Link>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="admin-user-logout"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}
