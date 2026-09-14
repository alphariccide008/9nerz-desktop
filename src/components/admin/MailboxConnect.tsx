import { useState } from "react";
import { CheckCircle2, ChevronDown, ExternalLink, Loader2, Mail, Plug, RefreshCw, Trash2, XCircle } from "lucide-react";
import { getMailboxAccount, saveMailboxAccount, testMailboxAccount, disconnectMailboxAccount, MailboxInput } from "../../lib/services/mailbox";
import { useDB } from "../../lib/db/store";
import { confirmAction } from "../../lib/confirm";
import { colors } from "../../lib/theme";
import { cn } from "../../lib/cn";

type ProviderPreset = Partial<MailboxInput> & {
  badge: string;
  badgeColor: string;
  help?: string;
  helpUrl?: string;
  helpLabel?: string;
  known?: boolean;
};

const PRESETS: Record<string, ProviderPreset> = {
  Gmail: {
    badge: "G",
    badgeColor: "#ea4335",
    known: true,
    imapHost: "imap.gmail.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    smtpSecure: true,
    help: "Google blocks your normal Gmail password here. Turn on 2-Step Verification, then create an App Password and paste it below instead.",
    helpUrl: "https://myaccount.google.com/apppasswords",
    helpLabel: "Create a Gmail App Password",
  },
  "Outlook / Microsoft 365": {
    badge: "O",
    badgeColor: "#0078d4",
    known: true,
    imapHost: "outlook.office365.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
    smtpSecure: false,
    help: "If your organization has 2-factor auth on, use an App Password instead of the normal one.",
    helpUrl: "https://account.activedirectory.windowsazure.com/AppPasswords.aspx",
    helpLabel: "Create a Microsoft App Password",
  },
  "Zoho Mail": { badge: "Z", badgeColor: "#e2711d", known: true, imapHost: "imap.zoho.com", imapPort: 993, imapSecure: true, smtpHost: "smtp.zoho.com", smtpPort: 465, smtpSecure: true },
  Yahoo: {
    badge: "Y",
    badgeColor: "#6001d2",
    known: true,
    imapHost: "imap.mail.yahoo.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "smtp.mail.yahoo.com",
    smtpPort: 465,
    smtpSecure: true,
    help: "Use a Yahoo App Password (Account security → Generate app password), not your normal Yahoo password.",
    helpUrl: "https://login.yahoo.com/account/security",
    helpLabel: "Create a Yahoo App Password",
  },
  Fastmail: { badge: "F", badgeColor: "#0891b2", known: true, imapHost: "imap.fastmail.com", imapPort: 993, imapSecure: true, smtpHost: "smtp.fastmail.com", smtpPort: 465, smtpSecure: true },
  "Other / custom": {
    badge: "…",
    badgeColor: "#5b6472",
    known: false,
    imapHost: "mail.yourdomain.com",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "mail.yourdomain.com",
    smtpPort: 587,
    smtpSecure: false,
    help: "For cPanel, GoDaddy, Hostinger and most business hosting, ask your host for the exact IMAP/SMTP server names.",
  },
};
const PROVIDER_NAMES = Object.keys(PRESETS);

const DEFAULT_FORM: MailboxInput = {
  provider: "",
  emailAddress: "",
  displayName: "",
  defaultOrgUnitId: null,
  imapHost: "",
  imapPort: 993,
  imapSecure: true,
  smtpHost: "",
  smtpPort: 587,
  smtpSecure: false,
  mailboxFolder: "INBOX",
  postAction: "seen",
};

const STATUS_STYLE: Record<string, [string, string]> = {
  ok: ["bg-emerald-100 text-emerald-700", "Connected"],
  pending: ["bg-amber-100 text-amber-700", "Not tested"],
};

export function MailboxConnect({ companyId, actorId, units }: { companyId: string; actorId: string; units: { id: string; name: string }[] }) {
  const tick = useDB((db) => JSON.stringify(db.mailboxAccounts.find((m) => m.companyId === companyId)));
  const account = getMailboxAccount(companyId);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<MailboxInput>(account ? { ...account } : DEFAULT_FORM);
  const [provider, setProvider] = useState<string | null>(account?.provider || null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState<{ imapOk: boolean; smtpOk: boolean } | null>(null);
  const [password, setPassword] = useState("");
  const [samePassword, setSamePassword] = useState(true);
  const [smtpPassword, setSmtpPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof MailboxInput>(k: K, v: MailboxInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const startEdit = () => {
    setForm(account ? { ...account } : DEFAULT_FORM);
    setProvider(account?.provider || null);
    setTest(null);
    setError(null);
    setPassword("");
    setSmtpPassword("");
    setSamePassword(true);
    setEditing(true);
  };

  const pick = (name: string) => {
    const p = PRESETS[name];
    setProvider(name);
    set("provider", name);
    set("imapHost", p.imapHost!);
    set("imapPort", p.imapPort!);
    set("imapSecure", p.imapSecure!);
    set("smtpHost", p.smtpHost!);
    set("smtpPort", p.smtpPort!);
    set("smtpSecure", p.smtpSecure!);
    if (!p.known) setAdvancedOpen(true);
  };

  const runTest = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await testMailboxAccount(companyId, {
        ...form,
        imapPassword: password || undefined,
        smtpPassword: (samePassword ? password : smtpPassword) || undefined,
      });
      setTest(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not test the connection.");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await saveMailboxAccount(actorId, companyId, {
        ...form,
        imapPassword: password || undefined,
        smtpPassword: (samePassword ? password : smtpPassword) || undefined,
      });
      setEditing(false);
      setTest(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the mailbox.");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = () =>
    confirmAction("Disconnect this mailbox?", "Existing tickets stay; new email stops coming in.", async () => {
      try {
        await disconnectMailboxAccount(actorId, companyId);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not disconnect the mailbox.");
      }
    });

  const preset = provider ? PRESETS[provider] : null;
  const input = "w-full rounded-lg border border-hairline px-2.5 py-1.5 text-sm text-ink outline-none focus:border-ink";

  return (
    <section className="rounded-xl border border-hairline bg-card">
      <header className="flex flex-row items-center justify-between border-b border-hairline px-4 py-2.5">
        <span className="flex flex-row items-center gap-1.5 text-sm font-semibold text-ink">
          <Plug size={15} /> Connect your own mailbox
        </span>
        {account && !editing ? <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold", STATUS_STYLE[account.lastStatus][0])}>{STATUS_STYLE[account.lastStatus][1]}</span> : null}
      </header>

      <div className="flex flex-col gap-3 p-4">
        {account && !editing ? (
          <div className="flex flex-col gap-2 text-sm">
            <p className="text-ink">
              <Mail size={13} className="mr-1.5 inline" />
              <span className="font-medium">{account.emailAddress}</span>
              {account.displayName ? <span className="text-muted-foreground"> · {account.displayName}</span> : null}
            </p>
            <p className="text-xs text-muted-foreground">
              IMAP {account.imapHost}:{account.imapPort} · SMTP {account.smtpHost}:{account.smtpPort}
              {account.lastCheckedAt ? ` · last checked ${new Date(account.lastCheckedAt).toLocaleTimeString()}` : ""}
            </p>
            <div className="flex flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={async () => {
                  setBusy(true);
                  try {
                    await testMailboxAccount(companyId);
                  } catch {
                    // surfaced via the account's lastStatus on refresh
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-lg border border-hairline px-2.5 py-1.5 text-xs font-medium text-ink hover:border-ink disabled:opacity-40"
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Check now
              </button>
              <button type="button" onClick={startEdit} className="rounded-lg border border-hairline px-2.5 py-1.5 text-xs font-medium text-ink hover:border-ink">
                Edit
              </button>
              <button type="button" onClick={disconnect} className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10">
                <Trash2 size={13} /> Disconnect
              </button>
            </div>
          </div>
        ) : account || editing ? (
          <div className="flex flex-col gap-4">
            {error ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div> : null}
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Choose your email provider</p>
              <div className="flex flex-row flex-wrap gap-2">
                {PROVIDER_NAMES.map((name) => {
                  const p = PRESETS[name];
                  const active = provider === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => pick(name)}
                      className={cn("flex flex-row items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition", active ? "border-ink bg-ink/[0.04] text-ink" : "border-hairline text-slate hover:border-ink hover:text-ink")}
                    >
                      <span className="grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold text-white" style={{ background: p.badgeColor }}>
                        {p.badge}
                      </span>
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>

            {preset?.help ? (
              <div className="rounded-lg border border-amber/40 bg-amber/10 px-3 py-2 text-xs text-[#8a5a12]">
                <p>{preset.help}</p>
                {preset.helpUrl ? (
                  <a
                    onClick={(e) => {
                      e.preventDefault();
                      window.nerz?.openExternal(preset.helpUrl!);
                    }}
                    href={preset.helpUrl}
                    className="mt-1 inline-flex cursor-pointer items-center gap-1 font-semibold underline underline-offset-2"
                  >
                    {preset.helpLabel} <ExternalLink size={11} />
                  </a>
                ) : null}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <label className="col-span-2 text-xs font-medium text-muted-foreground">
                Email address
                <input className={input} value={form.emailAddress} onChange={(e) => set("emailAddress", e.target.value)} placeholder="support@yourcompany.com" />
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                Display name <span className="font-normal text-muted-foreground/70">(optional)</span>
                <input className={input} value={form.displayName ?? ""} onChange={(e) => set("displayName", e.target.value)} placeholder="Acme Support" />
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                Default queue <span className="font-normal text-muted-foreground/70">(optional)</span>
                <select className={input} value={form.defaultOrgUnitId ?? ""} onChange={(e) => set("defaultOrgUnitId", e.target.value || null)}>
                  <option value="">Unrouted</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="col-span-2 text-xs font-medium text-muted-foreground">
                Password{preset?.helpLabel ? " (App Password)" : ""}
                {account ? <span className="font-normal text-muted-foreground/70">, leave blank to keep the current one</span> : null}
                <input
                  type="password"
                  className={input}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (samePassword) setSmtpPassword(e.target.value);
                  }}
                  placeholder={account ? "••••••••" : "Paste your password here"}
                />
              </label>
            </div>

            <button type="button" onClick={() => setAdvancedOpen((v) => !v)} className="flex flex-row items-center gap-1 text-xs font-medium text-muted-foreground hover:text-ink">
              <ChevronDown size={14} className={cn("transition-transform", advancedOpen && "rotate-180")} />
              Advanced settings (server, port, custom logins)
            </button>

            {advancedOpen ? (
              <div className="flex flex-col gap-3 rounded-lg border border-hairline bg-background p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Receiving (IMAP)</p>
                <div className="grid grid-cols-4 gap-2">
                  <label className="col-span-2 text-xs font-medium text-muted-foreground">
                    Host
                    <input className={input} value={form.imapHost} onChange={(e) => set("imapHost", e.target.value)} placeholder="imap.gmail.com" />
                  </label>
                  <label className="text-xs font-medium text-muted-foreground">
                    Port
                    <input type="number" className={input} value={form.imapPort} onChange={(e) => set("imapPort", Number(e.target.value))} />
                  </label>
                  <label className="flex items-end gap-1 pb-1.5 text-xs font-medium text-muted-foreground">
                    <input type="checkbox" checked={form.imapSecure} onChange={(e) => set("imapSecure", e.target.checked)} /> SSL
                  </label>
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sending (SMTP)</p>
                <div className="grid grid-cols-4 gap-2">
                  <label className="col-span-2 text-xs font-medium text-muted-foreground">
                    Host
                    <input className={input} value={form.smtpHost} onChange={(e) => set("smtpHost", e.target.value)} placeholder="smtp.gmail.com" />
                  </label>
                  <label className="text-xs font-medium text-muted-foreground">
                    Port
                    <input type="number" className={input} value={form.smtpPort} onChange={(e) => set("smtpPort", Number(e.target.value))} />
                  </label>
                  <label className="flex items-end gap-1 pb-1.5 text-xs font-medium text-muted-foreground">
                    <input type="checkbox" checked={form.smtpSecure} onChange={(e) => set("smtpSecure", e.target.checked)} /> SSL
                  </label>
                  <label className="col-span-2 text-xs font-medium text-muted-foreground">
                    Password{" "}
                    <span className="font-normal text-muted-foreground/70">{samePassword ? "(same as above)" : account ? "(blank = keep)" : ""}</span>
                    <input
                      type="password"
                      className={input}
                      value={samePassword ? password : smtpPassword}
                      onChange={(e) => {
                        setSmtpPassword(e.target.value);
                        setSamePassword(false);
                      }}
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Folder to watch
                    <input className={input} value={form.mailboxFolder} onChange={(e) => set("mailboxFolder", e.target.value)} />
                  </label>
                  <label className="text-xs font-medium text-muted-foreground">
                    After processing
                    <select className={input} value={form.postAction} onChange={(e) => set("postAction", e.target.value as "seen" | "move")}>
                      <option value="seen">Mark as read</option>
                      <option value="move">Move to a "processed" folder</option>
                    </select>
                  </label>
                </div>
              </div>
            ) : null}

            {test ? (
              <div className="flex flex-col gap-1 rounded-lg border border-hairline bg-background p-2 text-xs">
                <p className="flex flex-row items-center gap-1.5">
                  {test.imapOk ? <CheckCircle2 size={13} className="text-emerald-600" /> : <XCircle size={13} color={colors.destructive} />} IMAP connected
                </p>
                <p className="flex flex-row items-center gap-1.5">
                  {test.smtpOk ? <CheckCircle2 size={13} className="text-emerald-600" /> : <XCircle size={13} color={colors.destructive} />} SMTP connected
                </p>
              </div>
            ) : null}

            <div className="flex flex-row gap-2 pt-1">
              <button type="button" onClick={runTest} disabled={busy || !form.emailAddress.trim()} className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-2 text-sm font-medium text-ink hover:border-ink disabled:opacity-40">
                {busy ? <Loader2 size={15} className="animate-spin" /> : "Test connection"}
              </button>
              <button type="button" onClick={save} disabled={busy || !form.emailAddress.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-amber px-3 py-2 text-sm font-bold text-ink disabled:opacity-40">
                {busy ? <Loader2 size={15} className="animate-spin" /> : "Save & connect"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setTest(null);
                }}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Point 9nerz at an existing support inbox (e.g. <code>support@yourcompany.com</code>). We check it for new mail every couple of minutes and send replies from that same address. Pick
              your provider below: Gmail, Outlook, Zoho, Yahoo and most business hosting all work with just an email and a password.
            </p>
            <button type="button" onClick={startEdit} className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white hover:brightness-110">
              <Plug size={15} /> Connect a mailbox
            </button>
          </>
        )}
      </div>
    </section>
  );
}
