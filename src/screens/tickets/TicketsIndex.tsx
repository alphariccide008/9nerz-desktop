import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, ChevronDown, ChevronLeft, ChevronRight, Inbox, Mail, MailPlus, Search, X } from "lucide-react";

import { Screen } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/Feedback";
import { useCurrentUser, useIsAdmin } from "../../lib/hooks";
import { useDB } from "../../lib/db/store";
import { useSession } from "../../lib/session";
import { escalateOverdueTickets, listTickets, TicketListItem } from "../../lib/services/tickets";
import { listMembers, listUnits, fetchRealPlanStatus } from "../../lib/services/org";
import { colors } from "../../lib/theme";
import { cn } from "../../lib/cn";
import { TicketDetailContent } from "./TicketDetail";

const TABS = [
  ["all", "All"],
  ["mine", "Assigned to me"],
  ["unrouted", "Unrouted"],
] as const;

const STATUS_STYLE: Record<string, string> = {
  open: "bg-amber/20 text-[#8a5a12]",
  in_progress: "bg-ink/10 text-ink",
  resolved: "bg-teal/15 text-teal",
  reopened: "bg-violet-100 text-violet-700",
};
const STATUS_LABEL: Record<string, string> = { open: "Open", in_progress: "In progress", resolved: "Resolved", reopened: "Reopened" };
// Exact Tailwind palette hexes the real web app's tickets-view.tsx uses for
// these dots (bg-slate-300 / bg-sky-400 / bg-amber-500 / bg-red-500) — not
// the softer brand tones, which read too similar to each other at this size.
const PRIORITY_DOT: Record<string, string> = { Low: "#cbd5e1", Normal: "#38bdf8", High: "#f59e0b", Critical: "#ef4444" };
const STATUSES = ["open", "in_progress", "resolved", "reopened"];
const PRIORITIES = ["Low", "Normal", "High", "Critical"];
const PER_PAGE = 10;
const PRIORITY_RANK: Record<string, number> = { Critical: 0, High: 1, Normal: 2, Low: 3 };
const STATUS_RANK: Record<string, number> = { open: 0, reopened: 1, in_progress: 2, resolved: 3 };

type SortKey = "number" | "subject" | "created" | "priority" | "status";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

export default function TicketsIndex() {
  const me = useCurrentUser();
  const isAdmin = useIsAdmin();
  const navigate = useNavigate();
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("all");
  const tick = useDB((db) => db.tickets.map((t) => t.updatedAt).join(","));
  const tickets = useMemo(() => (me ? listTickets(me.id, tab) : []), [me, tab, tick]);
  const members = useMemo(() => (me ? listMembers(me.companyId) : []), [me, tick]);
  const units = useMemo(() => (me ? listUnits(me.companyId).units : []), [me, tick]);

  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fPriority, setFPriority] = useState("");
  const [fQueue, setFQueue] = useState("");
  const [fAssignee, setFAssignee] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "number", dir: "desc" });
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const { real } = useSession();
  const [freePlan, setFreePlan] = useState(false);

  useEffect(() => {
    if (!real) return;
    fetchRealPlanStatus().then((plan) => setFreePlan(plan?.tier === "free"));
  }, [real]);

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "subject" ? "asc" : "desc" }));
  const clearFilters = () => {
    setQ("");
    setFStatus("");
    setFPriority("");
    setFQueue("");
    setFAssignee("");
  };
  const activeFilters = [q, fStatus, fPriority, fQueue, fAssignee].filter(Boolean).length;

  const rows = useMemo(() => {
    let out = tickets.slice();
    const needle = q.trim().toLowerCase();
    if (needle) {
      out = out.filter((t) => t.subject.toLowerCase().includes(needle) || t.requesterEmail.toLowerCase().includes(needle) || (t.requesterName || "").toLowerCase().includes(needle) || (t.ref || "").toLowerCase().includes(needle));
    }
    if (fStatus) out = out.filter((t) => t.status === fStatus);
    if (fPriority) out = out.filter((t) => t.priority === fPriority);
    if (fQueue === "none") out = out.filter((t) => !t.orgUnit);
    else if (fQueue) out = out.filter((t) => t.orgUnit?.id === fQueue);
    if (fAssignee === "none") out = out.filter((t) => !t.assignee);
    else if (fAssignee) out = out.filter((t) => t.assignee?.id === fAssignee);

    const dir = sort.dir === "asc" ? 1 : -1;
    out.sort((a, b) => {
      switch (sort.key) {
        case "number":
          return ((a.ticketNumber ?? 0) - (b.ticketNumber ?? 0)) * dir;
        case "created":
          return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
        case "priority":
          return ((PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9)) * dir;
        case "status":
          return ((STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9)) * dir;
        case "subject":
          return a.subject.localeCompare(b.subject) * dir;
        default:
          return 0;
      }
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets, q, fStatus, fPriority, fQueue, fAssignee, sort]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PER_PAGE;
  const pageRows = rows.slice(pageStart, pageStart + PER_PAGE);

  useMemo(() => {
    if (me) escalateOverdueTickets(me.companyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.companyId]);

  if (!me) return null;

  const selectCls = "rounded-lg border border-hairline bg-card px-2 py-1.5 text-xs text-ink outline-none focus:border-ink";

  return (
    <>
    <Screen contentClassName="gap-3 px-2 py-5">
      <div className="flex flex-row items-center justify-between">
        <h1 className="flex flex-row items-center gap-2 font-display text-lg font-bold text-ink">
          <Inbox size={18} /> Tickets
        </h1>
        <div className="flex flex-row items-center gap-2">
          <Text variant="caption">
            {rows.length}
            {rows.length !== tickets.length ? ` of ${tickets.length}` : ""}
          </Text>
          {isAdmin ? <Button title="Simulate inbound" size="sm" variant="outline" icon={<MailPlus size={13} color={colors.ink} />} onPress={() => navigate("/tickets/simulate-inbound")} /> : null}
        </div>
      </div>

      {freePlan ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber/40 bg-amber/10 px-3 py-2.5 text-xs text-ink">
          <span>
            <Mail className="mr-1 inline h-3.5 w-3.5" />
            Email-to-ticket is an Unlimited feature, inbound email won&apos;t create tickets on the Free plan. Existing tickets stay here and can still be worked.
          </span>
          <button type="button" onClick={() => navigate("/billing")} className="shrink-0 rounded-full bg-amber px-3 py-1 font-bold text-ink hover:brightness-95">
            Upgrade
          </button>
        </div>
      ) : null}

      <div className="flex flex-row gap-1 border-b border-hairline">
        {TABS.map(([v, l]) => (
          <button key={v} type="button" onClick={() => setTab(v)} className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium transition", tab === v ? "border-ink text-ink" : "border-transparent text-slate hover:text-ink")}>
            {l}
          </button>
        ))}
      </div>

      <div className="flex flex-row flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} color={colors.slate} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search number, subject, requester…" className="w-64 rounded-lg border border-hairline bg-card py-1.5 pl-8 pr-2 text-xs text-ink outline-none focus:border-ink" />
        </div>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={selectCls}>
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select value={fPriority} onChange={(e) => setFPriority(e.target.value)} className={selectCls}>
          <option value="">Any priority</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select value={fQueue} onChange={(e) => setFQueue(e.target.value)} className={selectCls}>
          <option value="">Any queue</option>
          <option value="none">Unrouted</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select value={fAssignee} onChange={(e) => setFAssignee(e.target.value)} className={selectCls}>
          <option value="">Anyone</option>
          <option value="none">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.firstName} {m.lastName}
            </option>
          ))}
        </select>
        {activeFilters > 0 ? (
          <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 rounded-lg border border-hairline px-2 py-1.5 text-xs font-medium text-slate hover:border-ink hover:text-ink">
            <X size={12} /> Clear
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-hairline bg-card">
        {rows.length === 0 ? (
          <EmptyState icon={<Mail size={22} color={colors.slate} />} title={tickets.length === 0 ? "No tickets in this view" : "No tickets match these filters"} />
        ) : (
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-hairline text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Th label="Key" sortKey="number" sort={sort} onSort={toggleSort} />
                <Th label="Summary" sortKey="subject" sort={sort} onSort={toggleSort} className="w-full" />
                <Th label="Created" sortKey="created" sort={sort} onSort={toggleSort} />
                <th className="whitespace-nowrap px-1 py-1.5">Requester</th>
                <th className="whitespace-nowrap px-1 py-1.5">Queue</th>
                <Th label="Priority" sortKey="priority" sort={sort} onSort={toggleSort} />
                <th className="whitespace-nowrap px-1 py-1.5">Assignee</th>
                <Th label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {pageRows.map((t: TicketListItem) => (
                <tr key={t.id} onClick={() => setOpenId(t.id)} className="cursor-pointer border-b border-hairline/70 last:border-0 hover:bg-background">
                  <td className="whitespace-nowrap px-1 py-1.5 font-mono text-[11px] font-semibold text-ink">{t.ref ?? "—"}</td>
                  <td className="px-1 py-1.5">
                    <span className="block max-w-[20rem] truncate font-medium text-ink">{t.subject}</span>
                  </td>
                  <td className="whitespace-nowrap px-1 py-1.5 text-muted-foreground">
                    <span className="text-ink">{fmtDate(t.createdAt)}</span>
                    <span className="ml-1.5 text-[11px]">{fmtTime(t.createdAt)}</span>
                  </td>
                  <td className="px-1 py-1.5 text-muted-foreground">
                    <span className="block max-w-[9rem] truncate">{t.requesterName || t.requesterEmail}</span>
                  </td>
                  <td className="whitespace-nowrap px-1 py-1.5 text-muted-foreground">{t.orgUnit?.name || <span className="text-muted-foreground/60">Unrouted</span>}</td>
                  <td className="whitespace-nowrap px-1 py-1.5">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: PRIORITY_DOT[t.priority] ?? colors.hairline }} />
                      {t.priority}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-1 py-1.5">{t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : <span className="text-muted-foreground/60">Unassigned</span>}</td>
                  <td className="whitespace-nowrap px-1 py-1.5">
                    <span className={cn("inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold", STATUS_STYLE[t.status] || "bg-muted text-slate")}>{STATUS_LABEL[t.status] || t.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {rows.length > 0 ? (
        <div className="flex flex-row flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            Showing {pageStart + 1}–{Math.min(pageStart + PER_PAGE, rows.length)} of {rows.length}
          </span>
          <div className="flex flex-row items-center gap-1">
            <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1} className="inline-flex items-center gap-1 rounded-lg border border-hairline px-2 py-1.5 font-medium text-ink hover:border-ink disabled:opacity-40">
              <ChevronLeft size={14} /> Prev
            </button>
            <span className="px-2 tabular-nums">
              Page {currentPage} / {pageCount}
            </span>
            <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pageCount} className="inline-flex items-center gap-1 rounded-lg border border-hairline px-2 py-1.5 font-medium text-ink hover:border-ink disabled:opacity-40">
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      ) : null}
    </Screen>

    {openId ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(18,23,42,0.45)" }}>
        <div className="absolute inset-0" onClick={() => setOpenId(null)} />
        <div className="relative w-[96vw] max-w-[1152px] overflow-hidden rounded-2xl border border-hairline bg-card shadow-xl">
          <TicketDetailContent ticketId={openId} onClose={() => setOpenId(null)} />
        </div>
      </div>
    ) : null}
    </>
  );
}

function Th({ label, sortKey, sort, onSort, className = "" }: { label: string; sortKey: SortKey; sort: { key: SortKey; dir: "asc" | "desc" }; onSort: (k: SortKey) => void; className?: string }) {
  const active = sort.key === sortKey;
  return (
    <th className={cn("px-1 py-1.5 truncate", className)}>
      <button type="button" onClick={() => onSort(sortKey)} className={cn("inline-flex items-center gap-1 truncate uppercase tracking-wide transition hover:text-ink", active && "text-ink")}>
        {label}
        {active ? sort.dir === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} /> : <ChevronDown size={11} className="opacity-40" />}
      </button>
    </th>
  );
}
