import { Suspense } from "react";
import { CreateAccountForm } from "./CreateAccountForm";
import { loadMarketingSection } from "@/lib/marketing-sections-db";

export const dynamic = "force-dynamic";

export default async function CreateAccountPage() {
  const visual = await loadMarketingSection("auth-login");

  return (
    <Suspense>
      <CreateAccountForm visual={visual} />
    </Suspense>
  );
}
