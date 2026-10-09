import type { Metadata, Viewport } from "next";
import { AdminShell } from "@/app/components/nura-admin-shell";
import { ToastProvider } from "@/app/components/Toast";
/** Always load with /admin — do not rely only on client-component CSS HMR. */
import "@/app/components/admin/admin-tasks.css";
import "@/app/components/admin/admin-marketing.css";
import "@/app/components/mkt-table-type.css";
import "@/app/components/mkt-card-type.css";
import "@/app/components/admin-mkt-report.css";
import { ADMIN_MKT_REPORT_REV } from "@/app/components/admin-mkt-report-rev";
import "@/app/components/admin-overview-flow.css";

export const metadata: Metadata = {
  title: "Nura Admin",
  applicationName: "Nura Admin",
  other: { "mkt-report": ADMIN_MKT_REPORT_REV },
  manifest: "/admin/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Nura Admin",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/brand/nura-circle-variants/A-white-on-sage-128.png",
    apple: "/brand/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#3D4129",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <AdminShell>{children}</AdminShell>
    </ToastProvider>
  );
}
