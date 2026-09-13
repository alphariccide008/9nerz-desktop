import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowLeft, FileText, Mail, Paperclip, Send, StickyNote, X } from "lucide-react";

import { Screen } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { StatusPill, PriorityBadge } from "../../components/ui/Badge";
import { Banner, Loading } from "../../components/ui/Feedback";
import { Linkified } from "../../components/ui/Linkified";
import { useToast } from "../../components/ui/Toast";
import { useCurrentUser } from "../../lib/hooks";
import { useDB } from "../../lib/db/store";
import * as TK from "../../lib/services/tickets";
import type { NewAttachment } from "../../lib/services/tickets";
import { listUnits } from "../../lib/services/org";
import { TicketStatus } from "../../lib/db/schema";
import { humanSize, relativeTime } from "../../lib/util";
import { colors } from "../../lib/theme";
import { useSession } from "../../lib/session";
import { syncRealTicketDetail } from "../../lib/services/ticketSync";

const NEXT: Record<string, [TicketStatus, string][]> = {
  open: [["in_progress", "Start work"], ["resolved", "Resolve"]],
  in_progress: [["resolved", "Resolve"]],
  resolved: [["reopened", "Reopen"]],
  reopened: [["in_progress", "Start work"], ["resolved", "Resolve"]],
};

const PRIORITIES = ["Low", "Normal", "High", "Critical"] as const;
const MAX_ATTACHMENTS = 5;
const MAX_BYTES = 25 * 1024 * 1024;

function fileToAttachment(file: File): Promise<NewAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ filename: file.name, mime: file.type || null, sizeBytes: file.size, uri: reader.result as string });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return (
    <Screen maxWidth={900}>
      <TicketDetailContent ticketId={id} />
    </Screen>
  );
}

/** Ticket header + thread + composer. Used full-page (the /tickets/:id route, no
 *  `onClose`) and as the content of the in-list popup (TicketsIndex, with
 *  `onClose`) — mirrors the real web app's dual-mode ticket-detail component. */
export function TicketDetailContent({ ticketId: id, onClose }: { ticketId: string; onClose?: () => void }) {
  const modal = typeof onClose === "function";
  const me = useCurrentUser();
  const { real } = useSession();
  const toast = useToast();

  useEffect(() => {
    if (!real) return;
    syncRealTicketDetail(id);
  }, [real, id]);
  const [draft, setDraft] = useState("");
  const [internal, setInternal] = useState(false);
  const [files, setFiles] = useState<NewAttachment[]>([]);
  const imageInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const tick = useDB((db) => `${db.tickets.find((t) => t.id === id)?.updatedAt}:${db.ticketMessages.filter((m) => m.ticketId === id).length}`);
  const units = useDB(() => (me ? listUnits(me.companyId).units : []));

  const view = useMemo(() => {
    try {
      return me && id ? TK.getTicket(me.id, id) : null;
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, id, tick]);

  if (!me || !id) return null;
  if (!view) return <Loading />;

  const { ticket, messages, canManage, canRespond, isAdmin, unitMembers } = view;

  const act = async (fn: () => unknown, msg: string) => {
    try {
      await fn();
      toast.show(msg, "success");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  const addFile = (f: NewAttachment) => {
    if ((f.sizeBytes ?? 0) > MAX_BYTES) {
      toast.show(`${f.filename} is over 25 MB.`, "error");
      return;
    }
    setFiles((cur) => [...cur, f].slice(0, MAX_ATTACHMENTS));
  };

  const pickFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    for (const f of Array.from(fileList)) addFile(await fileToAttachment(f));
  };

  const send = async () => {
    if (!draft.trim() && files.length === 0) return;
    try {
      await TK.reply(me.id, id, draft, internal, files);
      setDraft("");
      setFiles([]);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Could not send", "error");
    }
  };

  const attachmentInputs = (
    <>
      <input ref={imageInput} type="file" accept="image/*" multiple hidden onChange={(e) => pickFiles(e.target.files)} />
      <input ref={pdfInput} type="file" accept="application/pdf" multiple hidden onChange={(e) => pickFiles(e.target.files)} />
    </>
  );

  const header = (
    <>
      {modal ? (
        <button type="button" onClick={onClose} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-ink">
          <ArrowLeft size={14} /> Close
        </button>
      ) : null}
      <div className={modal ? "pr-8" : ""}>
        <div className="flex flex-row flex-wrap items-center gap-2">
          {ticket.ref ? <span className="rounded bg-ink/[0.06] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink">{ticket.ref}</span> : null}
          <h1 className="min-w-0 break-words font-display text-lg font-bold text-ink">{ticket.subject}</h1>
          <StatusPill status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
        </div>
        <Text variant="caption" className="mt-1 block">
          {ticket.requesterName || ticket.requesterEmail}
          {ticket.sourceInbox ? ` · via ${ticket.sourceInbox}` : ""} · opened {new Date(ticket.createdAt).toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </Text>
      </div>
    </>
  );

  const controls =
    canManage || (NEXT[ticket.status] && canRespond) ? (
      <Card className="flex flex-row flex-wrap items-center gap-3 p-3">
          {isAdmin ? (
            <label className="flex flex-row items-center gap-1.5 text-[11px] text-muted-foreground">
              Department
              <select value={ticket.orgUnitId ?? ""} onChange={(e) => act(() => TK.moveQueue(me.id, id, e.target.value || null), "Queue updated")} className="rounded border border-hairline bg-card px-2 py-1.5 text-xs text-ink outline-none focus:border-ink">
                <option value="">Unrouted</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {canManage ? (
            <label className="flex flex-row items-center gap-1.5 text-[11px] text-muted-foreground">
              Priority
              <select value={ticket.priority} onChange={(e) => act(() => TK.setPriority(me.id, id, e.target.value as (typeof PRIORITIES)[number]), "Priority updated")} className="rounded border border-hairline bg-card px-2 py-1.5 text-xs text-ink outline-none focus:border-ink">
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {canManage && ticket.orgUnitId ? (
            <label className="flex flex-row items-center gap-1.5 text-[11px] text-muted-foreground">
              Assign to
              <select value={ticket.assigneeId ?? ""} onChange={(e) => act(() => TK.assign(me.id, id, e.target.value || null), "Assignment updated")} className="rounded border border-hairline bg-card px-2 py-1.5 text-xs text-ink outline-none focus:border-ink">
                <option value="">Unassigned</option>
                {unitMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.firstName} {m.lastName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {canRespond ? (
            <div className="ml-auto flex flex-row flex-wrap gap-1.5">
              {(NEXT[ticket.status] || []).map(([s, label]) => (
                <Button key={s} title={label} size="sm" onPress={() => act(() => TK.setStatus(me.id, id, s), "Status updated")} />
              ))}
            </div>
          ) : null}
        </Card>
      ) : null;

  const thread = (
    <div className="flex flex-col gap-2.5">
      {messages.length === 0 ? (
        <Text variant="caption" className="block py-8 text-center">
          No messages yet.
        </Text>
      ) : (
        messages.map((m) => (
          <div
            key={m.id}
            className="rounded-xl border p-3"
            style={{
              borderColor: m.direction === "internal" ? "#FDE68A" : m.direction === "outbound" ? "rgba(32,43,78,0.15)" : colors.hairline,
              backgroundColor: m.direction === "internal" ? "rgba(254,243,199,0.5)" : m.direction === "outbound" ? "rgba(32,43,78,0.03)" : colors.card,
            }}
          >
            <div className="mb-1 flex flex-row items-center gap-1.5">
              {m.direction === "internal" ? <StickyNote size={12} color={colors.slate} /> : <Mail size={12} color={colors.slate} />}
              <Text variant="caption" className="flex-1 font-semibold">
                {m.direction === "inbound" ? m.fromEmail : m.direction === "internal" ? `${m.authorName ?? "Someone"} · internal note` : `${m.authorName ?? "Team"} → ${ticket.requesterEmail}`}
              </Text>
              <Text variant="caption">{relativeTime(m.createdAt)}</Text>
            </div>
            {m.body && m.body !== "(see attachment)" ? <Linkified text={m.body} /> : null}
            <MessageAttachments items={m.attachments} />
          </div>
        ))
      )}
    </div>
  );

  const composer = !canRespond ? (
    <Banner tone="info">{ticket.assigneeId ? "Assigned to someone else — only they or the department manager can respond." : "Waiting to be assigned by the department manager."}</Banner>
  ) : (
        <Card className="flex flex-col gap-2 p-3">
          <div className="flex flex-row gap-1">
            <button type="button" onClick={() => setInternal(false)} className={`rounded px-2 py-1 ${!internal ? "bg-ink" : ""}`}>
              <span className={`text-[12px] font-medium ${!internal ? "text-white" : "text-slate"}`}>Reply to customer</span>
            </button>
            <button type="button" onClick={() => setInternal(true)} className={`rounded px-2 py-1 ${internal ? "bg-amber" : ""}`}>
              <span className={`text-[12px] font-medium ${internal ? "text-white" : "text-slate"}`}>Internal note</span>
            </button>
          </div>
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={internal ? "Note for your team (not sent to the customer)…" : "Type your reply — it will be emailed to the customer…"} />

          {files.length > 0 ? (
            <div className="flex flex-row flex-wrap gap-1.5">
              {files.map((f, i) => (
                <div key={i} className="flex flex-row items-center gap-1.5 rounded-md border border-hairline bg-muted px-2 py-1">
                  <FileText size={12} color={colors.slate} />
                  <span className="max-w-[140px] truncate text-[11px] text-muted-foreground">{f.filename}</span>
                  {f.sizeBytes ? <Text variant="caption">{humanSize(f.sizeBytes)}</Text> : null}
                  <button type="button" onClick={() => setFiles((cur) => cur.filter((_, idx) => idx !== i))}>
                    <X size={12} color={colors.slate} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="flex flex-row items-center gap-2">
            <Button title="Photo" size="sm" variant="outline" icon={<Paperclip size={13} color={colors.ink} />} disabled={files.length >= MAX_ATTACHMENTS} onPress={() => imageInput.current?.click()} />
            <Button title="PDF" size="sm" variant="outline" icon={<FileText size={13} color={colors.ink} />} disabled={files.length >= MAX_ATTACHMENTS} onPress={() => pdfInput.current?.click()} />
            <Button title={internal ? "Add note" : "Send reply"} size="sm" className="ml-auto" icon={<Send size={14} color={colors.white} />} onPress={send} />
          </div>
        </Card>
      );

  if (modal) {
    return (
      <div className="flex max-h-[85vh] flex-col">
        {attachmentInputs}
        <div className="shrink-0 space-y-3 border-b border-hairline p-4">{header}</div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-background p-4">
          {controls}
          {thread}
        </div>
        <div className="shrink-0 border-t border-hairline bg-card p-4">{composer}</div>
      </div>
    );
  }

  return (
    <>
      {attachmentInputs}
      <div className="flex flex-col gap-4">
        {header}
        {controls}
        {thread}
        {composer}
      </div>
    </>
  );
}

function MessageAttachments({ items }: { items: TK.AttachmentView[] }) {
  if (!items.length) return null;
  const images = items.filter((a) => a.kind === "image");
  const files = items.filter((a) => a.kind !== "image");
  return (
    <div className="mt-2 flex flex-col gap-2">
      {images.length > 0 ? (
        <div className="flex flex-row flex-wrap gap-2">
          {images.map((a) => (
            <a key={a.id} href={a.uri} target="_blank" rel="noreferrer">
              <img src={a.uri} style={{ width: 104, height: 104, objectFit: "cover", borderRadius: 10, borderWidth: 1, borderColor: colors.hairline, borderStyle: "solid" }} />
            </a>
          ))}
        </div>
      ) : null}
      {files.map((a) => (
        <a key={a.id} href={a.uri} target="_blank" rel="noreferrer" className="flex flex-row items-center gap-2 rounded-lg border border-hairline bg-card px-2.5 py-2">
          <FileText size={15} color={colors.destructive} />
          <span className="flex-1 truncate text-[12px] font-medium text-ink">{a.filename}</span>
          {a.sizeBytes ? <Text variant="caption">{humanSize(a.sizeBytes)}</Text> : null}
        </a>
      ))}
    </div>
  );
}
