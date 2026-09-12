/**
 * "Connect your own mailbox" — desktop-only addition (not part of the ported
 * mobile service layer, since mobile never had this screen). There is no
 * backend here, so this simulates the real web app's IMAP/SMTP connect flow
 * locally: saving "connects" it, testing always reports success. It exists so
 * the desktop app's Routing screen can match the real template visually
 * without a fake button that silently does nothing.
 */
import { getDB, mutate } from "../db/store";
import { MailboxAccount, MailboxLastStatus } from "../db/schema";
import { uid, nowISO } from "../util";
import { userById, ServiceError } from "./helpers";

export function getMailboxAccount(companyId: string): MailboxAccount | null {
  return getDB().mailboxAccounts.find((m) => m.companyId === companyId) ?? null;
}

export interface MailboxInput {
  provider: string;
  emailAddress: string;
  displayName?: string | null;
  defaultOrgUnitId?: string | null;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  mailboxFolder: string;
  postAction: "seen" | "move";
}

export function saveMailboxAccount(actorId: string, companyId: string, input: MailboxInput): MailboxAccount {
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

/** Always reports success — there's nothing real to reach. */
export function testMailboxAccount(companyId: string): { imapOk: boolean; smtpOk: boolean } {
  mutate((d) => {
    d.mailboxAccounts = d.mailboxAccounts.map((m) => (m.companyId === companyId ? { ...m, lastStatus: "ok" as MailboxLastStatus, lastCheckedAt: nowISO() } : m));
  });
  return { imapOk: true, smtpOk: true };
}

export function disconnectMailboxAccount(actorId: string, companyId: string): void {
  if (!userById(getDB(), actorId)?.isCompanyAdmin) throw new ServiceError("Admins only.", "forbidden");
  mutate((d) => {
    d.mailboxAccounts = d.mailboxAccounts.filter((m) => m.companyId !== companyId);
  });
}
