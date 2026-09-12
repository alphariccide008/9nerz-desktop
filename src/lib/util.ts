/** Small shared helpers. */

let counter = 0;
/** Readable unique id — fine for a local mock DB (no real UUIDs needed). */
export function uid(prefix = "id"): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

/** "1.2 MB" / "834 KB" / "12 B" — mirrors humanSize in lib/attachments-client.ts. */
export function humanSize(bytes: number | null | undefined): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function sixDigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export interface PasswordCheck {
  valid: boolean;
  message: string;
}
/** Mirrors validatePassword() in the web app's lib/data.ts. */
export function validatePassword(password: string): PasswordCheck {
  if (password.length < 8) return { valid: false, message: "Password must be at least 8 characters." };
  if (!/[A-Z]/.test(password)) return { valid: false, message: "Password must contain at least 1 uppercase letter." };
  if (!/[0-9]/.test(password)) return { valid: false, message: "Password must contain at least 1 number." };
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password))
    return { valid: false, message: "Password must contain at least 1 special character." };
  return { valid: true, message: "" };
}

const CONSUMER_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "aol.com",
  "proton.me", "protonmail.com", "live.com", "msn.com", "ymail.com", "gmx.com",
]);
export function isConsumerEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  return !!domain && CONSUMER_DOMAINS.has(domain);
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "org";
}

export function fullName(u: { firstName: string; lastName: string }): string {
  return `${u.firstName} ${u.lastName}`.trim();
}

export function initials(u: { firstName: string; lastName: string }): string {
  return `${u.firstName.charAt(0)}${u.lastName.charAt(0)}`.toUpperCase();
}

export const ONLINE_WINDOW_MS = 90_000;
export function isOnline(lastActiveAt?: string | null): boolean {
  if (!lastActiveAt) return false;
  return Date.now() - new Date(lastActiveAt).getTime() < ONLINE_WINDOW_MS;
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const d = Math.floor(hrs / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function shortDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate) return false;
  if (["Approved", "Completed", "Declined", "resolved"].includes(status)) return false;
  return new Date(dueDate).getTime() < Date.now();
}

export function overdueLabel(dueDate: string | null): string {
  if (!dueDate) return "";
  const diff = Date.now() - new Date(dueDate).getTime();
  if (diff <= 0) return "";
  const d = Math.floor(diff / 86_400_000);
  if (d === 0) return "Due today";
  if (d === 1) return "1 day overdue";
  return `${d} days overdue`;
}

/** Time-on-desk between acceptedAt and completion / now. Mirrors getTaskDeskTime(). */
export function deskTime(acceptedAt: string | null, completedAt: string | null, status: string, updatedAt: string): string | null {
  if (!acceptedAt) return null;
  const start = new Date(acceptedAt).getTime();
  const finished = status === "Completed" || status === "Approved";
  const end = completedAt
    ? new Date(completedAt).getTime()
    : finished
      ? new Date(updatedAt).getTime()
      : Date.now();
  const mins = Math.max(0, Math.floor((end - start) / 60000));
  if (mins < 1) return "< 1m";
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hrs > 0) return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
  return `${mins}m`;
}
