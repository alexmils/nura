import { AppProvider } from "@/app/components/AppProvider";
import { ConsoleShell } from "@/app/components/ConsoleShell";

/**
 * /app, /app/resources and resource articles share ONE AppProvider and one
 * sidebar, so moving between them keeps the open session, the Recent list and
 * the drawer state instead of remounting and refetching (that flashed
 * "No sessions yet"). Auth, onboarding, settings and billing stay outside.
 */
export default function ConsoleGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppProvider>
      <ConsoleShell>{children}</ConsoleShell>
    </AppProvider>
  );
}
