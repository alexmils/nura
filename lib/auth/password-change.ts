import { validatePassword } from "@/lib/auth/password";

export type PasswordChangeCheck = {
  /** True when the account already has a password to authorise the change with. */
  hasPassword: boolean;
  currentPassword?: string | null;
  /** Result of verifying currentPassword against the stored hash, when known. */
  currentPasswordMatches?: boolean;
  newPassword: string;
};

/**
 * Guard for setting or changing a password from Settings.
 * Returns an error message to show the user, or null when the change may proceed.
 *
 * Accounts created with Google have no password yet, so the session itself is the
 * proof of ownership and no current password is required.
 */
export function passwordChangeError(input: PasswordChangeCheck): string | null {
  const pwError = validatePassword(input.newPassword);
  if (pwError) return pwError;

  if (!input.hasPassword) return null;

  if (!input.currentPassword) {
    return "Enter your current password";
  }

  if (input.currentPasswordMatches === false) {
    return "Current password is incorrect";
  }

  if (input.currentPassword === input.newPassword) {
    return "New password must be different from your current one";
  }

  return null;
}
