"use client";

import { PlatformHealthCard } from "@/app/components/admin/PlatformHealthCard";

/** Side-column health card. Own module so Overview picks up a fresh chunk URL. */
export function OverviewSideHealth() {
  return <PlatformHealthCard />;
}
