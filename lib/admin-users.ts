import { isValidUserRole, type UserRole } from "@/lib/roles";
import { deleteUserAccount } from "@/lib/delete-account";
import {
  ensureSchemaReady,
  getPool,
} from "@/lib/db";
import { getUserById, type UserStatus } from "@/lib/users";

export async function deleteAdminUser(
  targetId: string,
  actorId: string
): Promise<
  | {
      ok: true;
      user: NonNullable<Awaited<ReturnType<typeof getUserById>>>;
      stripe: {
        attempted: boolean;
        canceled: boolean;
        hadSubscription: boolean;
      };
    }
  | { error: string }
> {
  const result = await deleteUserAccount({
    targetId,
    actorId,
    mode: "admin",
  });
  if ("error" in result) return result;
  return {
    ok: true,
    user: result.user,
    stripe: result.stripe,
  };
}

export async function updateAdminUser(
  targetId: string,
  actorId: string,
  patch: { name?: string; role?: UserRole; status?: UserStatus }
): Promise<{ ok: true } | { error: string }> {
  await ensureSchemaReady();

  const target = await getUserById(targetId);
  if (!target) return { error: "User not found" };

  if (
    targetId === actorId &&
    patch.role !== undefined &&
    patch.role !== target.role
  ) {
    return { error: "You cannot change your own role" };
  }

  if (patch.role !== undefined && !isValidUserRole(patch.role)) {
    return { error: "Invalid role" };
  }

  if (patch.status !== undefined && patch.status !== target.status) {
    if (targetId === actorId) {
      return { error: "You cannot disable your own account" };
    }
  }

  if (patch.role && patch.role !== target.role) {
    if (target.role === "platform_admin" && patch.role !== "platform_admin") {
      const { rows } = await getPool().query<{ c: number }>(
        "SELECT COUNT(*)::int AS c FROM users WHERE role = 'platform_admin'"
      );
      if ((rows[0]?.c ?? 0) <= 1) {
        return { error: "Cannot demote the last platform admin" };
      }
    }
  }

  const name =
    patch.name !== undefined ? patch.name.trim() || null : target.name;
  const role = patch.role ?? target.role;
  const status = patch.status ?? target.status;

  await getPool().query(
    `UPDATE users SET name = $1, role = $2, status = $3, updated_at = NOW() WHERE id = $4`,
    [name, role, status, targetId]
  );

  return { ok: true };
}

export async function setUserStatsExcluded(
  targetId: string,
  excluded: boolean
): Promise<{ ok: true } | { error: string }> {
  await ensureSchemaReady();
  const target = await getUserById(targetId);
  if (!target) return { error: "User not found" };
  await getPool().query(
    `UPDATE users SET stats_excluded = $1, updated_at = NOW() WHERE id = $2`,
    [excluded, targetId]
  );
  return { ok: true };
}
