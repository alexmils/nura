import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import { loadMarketingSection } from "@/lib/marketing-sections-db";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const visual = await loadMarketingSection("auth-login");

  return (
    <Suspense>
      <LoginForm visual={visual} editableVisual />
    </Suspense>
  );
}
