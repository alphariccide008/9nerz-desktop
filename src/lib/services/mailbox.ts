/**
 * "Connect your own mailbox" — calls the real https://www.9nerz.com/api/org/
 * email-account* endpoints when a real (backend-authenticated) session is
 * active, the same as org.ts. Falls back to the local mock simulation
 * otherwise. The fetched real account is cached into the same local
 * `db.mailboxAccounts` array the mock path already uses, so getMailboxAccount()
 * can stay a plain synchronous read for the render path.
 */
import { getDB, mutate } from "../db/store";
import { MailboxAccount, MailboxLastStatus } from "../db/schema";
import { uid, nowISO } from "../util";
import { userById, ServiceError } from "./helpers";
import { apiRequest, ApiError } from "../api/http";
import { getSession, getAccessToken } from "../session";

export function getMailboxAccount(companyId: string): MailboxAccount | null {
  return getDB().mailboxAccounts.find((m) => m.companyId === companyId) ?? null;
}

type RealMailboxRow = {
  id: string;
  provider: string;
  email_address: string;
  display_name: string | null;
  default_org_unit_id: string | null;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  mailbox_folder: string;
  post_action: "seen" | "move";
  last_status: string | null;
  last_polled_at: string | null;
  created_at: string;
};

function realRowToLocal(companyId: string, row: RealMailboxRow): MailboxAccount {
  return {
    id: row.id,
    companyId,
    provider: row.provider,
    emailAddress: row.email_address,
    displayName: row.display_name,
    defaultOrgUnitId: row.default_org_unit_id,
    imapHost: row.imap_host,
    imapPort: row.imap_port,
    imapSecure: row.imap_secure,
    smtpHost: row.smtp_host,
    smtpPort: row.smtp_port,
    smtpSecure: row.smtp_secure,
    mailboxFolder: row.mailbox_folder,
    postAction: row.post_action,
    lastStatus: (row.last_status === "ok" ? "ok" : "pending") as MailboxLastStatus,
    lastCheckedAt: row.last_polled_at,
    createdAt: row.created_at,
    updatedAt: row.created_at,
  };
}

/** Pull the real company's connected mailbox (if any) into the local cache. */
export async function syncRealMailbox(): Promise<void> {
  const real = getSession().real;
  if (!real) return;
  const companyId = real.user.companyId;
  try {
    const { account } = await apiRequest<{ account: RealMailboxRow | null }>("GET", "/api/org/email-account", undefined, getAccessToken());
    mutate((d) => {
      d.mailboxAccounts = d.mailboxAccounts.filter((m) => m.companyId !== companyId);
      if (account) d.mailboxAccounts.push(realRowToLocal(companyId, account));
    });
  } catch (e) {
    console.warn("[mailbox] failed to sync real mailbox", e);
  }
}

export interface MailboxInput {
  provider: string;
  emailAddress: string;
  displayName?: string | null;
  defaultOrgUnitId?: string | null;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  imapPassword?: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpPassword?: string;
  mailboxFolder: string;
  postAction: "seen" | "move";
}

export async function saveMailboxAccount(actorId: string, companyId: string, input: MailboxInput): Promise<MailboxAccount> {
  const real = getSession().real;
  if (real) {
    try {
      const { account } = await apiRequest<{ account: RealMailboxRow }>(
        "PUT",
        "/api/org/email-account",
        {
          email_address: input.emailAddress.trim(),
          display_name: input.displayName?.trim() || null,
          default_org_unit_id: input.defaultOrgUnitId || null,
          imap_host: input.imapHost,
          imap_port: input.imapPort,
          imap_secure: input.imapSecure,
          imap_password: input.imapPassword || undefined,
          smtp_host: input.smtpHost,
          smtp_port: input.smtpPort,
          smtp_secure: input.smtpSecure,
          smtp_password: input.smtpPassword || undefined,
          mailbox_folder: input.mailboxFolder || "INBOX",
          post_action: input.postAction,
        },
        getAccessToken(),
      );
      const record = realRowToLocal(companyId, account);
      mutate((d) => {
        d.mailboxAccounts = [...d.mailboxAccounts.filter((m) => m.companyId !== companyId), record];
      });
      return record;
    } catch (e) {
      throw new ServiceError(e instanceof ApiError ? e.message : "Could not save the mailbox.");
    }
  }

  const db = getDB();
  if (!userById(db, actorId)?.isCompanyAdmin) throw new ServiceError("Admins only.", "forbidden");
  if (!input.emailAddress.trim()) throw new ServiceError("Enter the mailbox's email address.");

  const existing = getMailboxAccount(companyId);
  const ts = nowISO();
  const record: MailboxAccount = {
    id: existing?.id ?? uid("mbx"),
    companyId,
    provider: input.provider,
    emailAddress: input.emailAddress.trim(),
    displayName: input.displayName?.trim() || null,
    defaultOrgUnitId: input.defaultOrgUnitId || null,
    imapHost: input.imapHost,
    imapPort: input.imapPort,
    imapSecure: input.imapSecure,
    smtpHost: input.smtpHost,
    smtpPort: input.smtpPort,
    smtpSecure: input.smtpSecure,
    mailboxFolder: input.mailboxFolder || "INBOX",
    postAction: input.postAction,
    lastStatus: "ok",
    lastCheckedAt: ts,
    createdAt: existing?.createdAt ?? ts,
    updatedAt: ts,
  };
  mutate((d) => {
    d.mailboxAccounts = [...d.mailboxAccounts.filter((m) => m.companyId !== companyId), record];
  });
  return record;
}

export async function testMailboxAccount(companyId: string, form?: Partial<MailboxInput>): Promise<{ imapOk: boolean; smtpOk: boolean }> {
  const real = getSession().real;
  if (real) {
    try {
      const body = form
        ? {
            email_address: form.emailAddress,
            imap_host: form.imapHost,
            imap_port: form.imapPort,
            imap_secure: form.imapSecure,
            imap_password: form.imapPassword || undefined,
            smtp_host: form.smtpHost,
            smtp_port: form.smtpPort,
            smtp_secure: form.smtpSecure,
            smtp_password: form.smtpPassword || undefined,
            mailbox_folder: form.mailboxFolder,
          }
        : {};
      const result = await apiRequest<{ imap: { ok: boolean }; smtp: { ok: boolean }; ok: boolean }>("POST", "/api/org/email-account/test", body, getAccessToken());
      return { imapOk: result.imap.ok, smtpOk: result.smtp.ok };
    } catch (e) {
      throw new ServiceError(e instanceof ApiError ? e.message : "Could not test the connection.");
    }
  }

  mutate((d) => {
    d.mailboxAccounts = d.mailboxAccounts.map((m) => (m.companyId === companyId ? { ...m, lastStatus: "ok" as MailboxLastStatus, lastCheckedAt: nowISO() } : m));
  });
  return { imapOk: true, smtpOk: true };
}

export async function disconnectMailboxAccount(actorId: string, companyId: string): Promise<void> {
  const real = getSession().real;
  if (real) {
    try {
      await apiRequest("DELETE", "/api/org/email-account", undefined, getAccessToken());
      mutate((d) => {
        d.mailboxAccounts = d.mailboxAccounts.filter((m) => m.companyId !== companyId);
      });
      return;
    } catch (e) {
      throw new ServiceError(e instanceof ApiError ? e.message : "Could not disconnect the mailbox.");
    }
  }

  if (!userById(getDB(), actorId)?.isCompanyAdmin) throw new ServiceError("Admins only.", "forbidden");
  mutate((d) => {
    d.mailboxAccounts = d.mailboxAccounts.filter((m) => m.companyId !== companyId);
  });
}
