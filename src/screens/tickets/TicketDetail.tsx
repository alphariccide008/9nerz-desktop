import { useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { FileText, Mail, Paperclip, Send, StickyNote, X } from "lucide-react";

import { Screen, PageHeader } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { StatusPill } from "../../components/ui/Badge";
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
  const me = useCurrentUser();
  const toast = useToast();
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
  if (!view) return (
    <Screen>
      <Loading />
    </Screen>
  );

  const { ticket, messages, canManage, canRespond, isAdmin, unitMembers } = view;

  const act = (fn: () => void, msg: string) => {
    try {
      fn();
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

  const send = () => {
    if (!draft.trim() && files.length === 0) return;
    try {
      TK.reply(me.id, id, draft, internal, files);
      setDraft("");
      setFiles([]);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Could not send", "error");
    }
  };

  return (
    <Screen maxWidth={640}>
      <input ref={imageInput} type="file" accept="image/*" multiple hidden onChange={(e) => pickFiles(e.target.files)} />
      <input ref={pdfInput} type="file" accept="application/pdf" multiple hidden onChange={(e) => pickFiles(e.target.files)} />

      <div className="flex flex-row items-center gap-2">
        {ticket.ref ? (
          <div className="rounded bg-ink/[0.06] px-1.5 py-0.5">
            <span className="text-[11px] font-bold tracking-[0.3px] text-ink">{ticket.ref}</span>
          </div>
        ) : null}
        <StatusPill status={ticket.status} />
      </div>
      <PageHeader title={ticket.subject} />
      <Text variant="caption">
        {ticket.requesterName || ticket.requesterEmail}
        {ticket.sourceInbox ? ` · via ${ticket.sourceInbox}` : ""}
      </Text>

      {canManage || (NEXT[ticket.status] && canRespond) ? (
        <Card className="flex flex-col gap-3 p-3">
          {isAdmin ? (
            <Select
              label="Department"
              value={ticket.orgUnitId}
              options={units.map((u) => ({ value: u.id, label: u.name }))}
              onChange={(v) => act(() => TK.moveQueue(me.id, id, v || null), "Queue updated")}
              placeholder="Unrouted"
              allowClear
            />
          ) : null}
          {canManage ? (
            <Select
              label="Priority"
              value={ticket.priority}
              options={PRIORITIES.map((p) => ({ value: p, label: p }))}
              onChange={(v) => v && act(() => TK.setPriority(me.id, id, v as (typeof PRIORITIES)[number]), "Priority updated")}
            />
          ) : null}
          {canManage && ticket.orgUnitId ? (
            <Select
              label="Assign to"
              value={ticket.assigneeId}
              options={unitMembers.map((m) => ({ value: m.id, label: `${m.firstName} ${m.lastName}` }))}
              onChange={(v) => act(() => TK.assign(me.id, id, v || null), "Assignment updated")}
              placeholder="Unassigned"
              allowClear
            />
          ) : null}
          {canRespond ? (
            <div className="flex flex-row flex-wrap gap-2">
              {(NEXT[ticket.status] || []).map(([s, label]) => (
                <Button key={s} title={label} size="sm" onPress={() => act(() => TK.setStatus(me.id, id, s), "Status updated")} />
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}

      <div className="flex flex-col gap-2.5">
        {messages.map((m) => (
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
        ))}
      </div>

      {!canRespond ? (
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
      )}
    </Screen>
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
