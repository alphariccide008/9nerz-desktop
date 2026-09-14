import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Lock,
  MessageSquare,
  Paperclip,
  RotateCcw,
  Send,
  ShieldAlert,
  Trash2,
  UserCheck,
} from "lucide-react";

import { Screen, PageHeader } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { StatusPill } from "../../components/ui/Badge";
import { Banner, Loading } from "../../components/ui/Feedback";
import { KeyValueList, KeyValueRow } from "../../components/ui/KeyValue";
import { Sheet } from "../../components/ui/Sheet";
import { Select } from "../../components/ui/Select";
import { useToast } from "../../components/ui/Toast";
import { colors } from "../../lib/theme";
import { confirmAction } from "../../lib/confirm";
import { deskTime, fullName, humanSize, isOverdue, overdueLabel, relativeTime, shortDate } from "../../lib/util";
import { useCurrentUser } from "../../lib/hooks";
import { useDB } from "../../lib/db/store";
import * as T from "../../lib/services/tasks";
import { assignableTo } from "../../lib/services/tasks";
import type { NewTaskAttachment } from "../../lib/services/tasks";

const ACTION_LABEL: Record<string, string> = {
  created: "Task created",
  accepted: "Task accepted",
  declined: "Task declined",
  submitted_for_review: "Submitted for review",
  reverted: "Changes requested",
  approved: "Task approved",
  blocked: "Blocker raised",
  block_resolved: "Blocker resolved",
  reviewer_assigned: "Reviewer assigned",
  reviewed: "Reviewed",
  reviewer_blocked: "Reviewer sent it back",
  reassigned: "Task reassigned",
  updated: "Task updated",
};

function fileToAttachment(file: File): Promise<NewTaskAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ filename: file.name, mime: file.type || null, sizeBytes: file.size, uri: reader.result as string });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return (
    <Screen maxWidth={900}>
      <TaskDetailContent taskId={id} />
    </Screen>
  );
}

/** Task detail — used full-page (the /tasks/:id route, no `onClose`) and as the
 *  content of the in-list popup (TasksIndex, Dashboard's "My tasks", with
 *  `onClose`) — mirrors the real web app's dual-mode task-detail component. */
export function TaskDetailContent({ taskId, onClose }: { taskId: string; onClose?: () => void }) {
  const modal = typeof onClose === "function";
  const navigate = useNavigate();
  const me = useCurrentUser();
  const toast = useToast();
  const tick = useDB((db) => `${db.tasks.find((t) => t.id === taskId)?.updatedAt ?? ""}:${db.taskComments.filter((c) => c.taskId === taskId).length}`);
  const [comment, setComment] = useState("");
  const [prompt, setPrompt] = useState<null | { kind: "revert" | "block" | "reviewerBlock" | "decline"; text: string }>(null);
  const [reviewerSheet, setReviewerSheet] = useState(false);
  const [reassignSheet, setReassignSheet] = useState(false);
  const [editSheet, setEditSheet] = useState(false);
  const [edit, setEdit] = useState({ title: "", description: "" });
  const [pendingPerson, setPendingPerson] = useState<string | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const task = useMemo(() => {
    try {
      return me && taskId ? T.getTask(me.id, taskId) : null;
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, taskId, tick]);

  const people = useMemo(() => (me ? assignableTo(me.id) : []), [me, tick]);

  if (!me) return null;
  if (!task) return <Loading />;

  const isAssignee = task.assigneeId === me.id;
  const isAssigner = task.assignerId === me.id || me.isCompanyAdmin;
  const isReviewer = task.reviewerId === me.id;
  const overdue = isOverdue(task.dueDate, task.status);
  const desk = deskTime(task.acceptedAt, task.completedAt, task.status, task.updatedAt);

  const run = (fn: () => void, msg: string) => {
    try {
      fn();
      toast.show(msg, "success");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Something went wrong", "error");
    }
  };

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const atts = await Promise.all(Array.from(files).slice(0, 5).map(fileToAttachment));
      T.addTaskAttachments(me.id, taskId, atts);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Could not attach file", "error");
    }
  };

  const submitPrompt = () => {
    if (!prompt) return;
    const text = prompt.text.trim();
    try {
      if (prompt.kind === "revert") T.revertTask(me.id, taskId, text);
      if (prompt.kind === "block") T.blockTask(me.id, taskId, text);
      if (prompt.kind === "reviewerBlock") T.reviewerBlock(me.id, taskId, text);
      if (prompt.kind === "decline") T.declineTask(me.id, taskId, text || undefined);
      toast.show("Done", "success");
      setPrompt(null);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Something went wrong", "error");
    }
  };

  const body = (
    <>
      <input ref={imageInput} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
      <input ref={fileInput} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} />

      {modal ? (
        <button type="button" onClick={onClose} className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-ink">
          <ArrowLeft size={14} /> Close
        </button>
      ) : null}
      <PageHeader title={task.title} />

      <div className="flex flex-row flex-wrap items-center gap-2">
        <StatusPill status={task.status} />
        <span className="rounded border border-hairline px-1.5 py-0.5 text-[11px] text-muted-foreground">{task.priority}</span>
        {overdue ? (
          <div className="flex flex-row items-center gap-1 rounded-md bg-destructive px-1.5 py-0.5">
            <AlertTriangle size={11} color="#fff" />
            <span className="text-[11px] font-semibold text-white">{overdueLabel(task.dueDate)}</span>
          </div>
        ) : null}
      </div>

      {task.blockedComment && task.status === "Pending" ? (
        <div className="rounded-lg bg-destructive px-3.5 py-3">
          <div className="mb-1 flex flex-row items-center gap-1.5">
            <ShieldAlert size={14} color="#fff" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-white">Active blocker</span>
          </div>
          <p className="text-[13px] text-white">{task.blockedComment}</p>
        </div>
      ) : null}
      {task.revertComment && task.status === "Pending" ? (
        <Banner tone="warn">
          <div className="flex flex-row items-start gap-1.5">
            <RotateCcw size={13} color="#B45309" />
            <div className="flex-1">
              <Text variant="caption" className="block font-semibold text-[#B45309]">
                Changes requested
              </Text>
              <Text variant="caption" className="mt-0.5 block text-ink">
                {task.revertComment}
              </Text>
            </div>
          </div>
        </Banner>
      ) : null}
      {task.reviewerBlockedComment ? (
        <Banner tone="error">
          <div className="flex flex-row items-start gap-1.5">
            <ShieldAlert size={13} color={colors.destructive} />
            <div className="flex-1">
              <Text variant="caption" className="block font-semibold text-destructive">
                Reviewer blocker
              </Text>
              <Text variant="caption" className="mt-0.5 block text-ink">
                {task.reviewerBlockedComment}
              </Text>
            </div>
          </div>
        </Banner>
      ) : null}
      {task.unitLocked ? (
        <Banner tone="warn">
          <div className="flex flex-row items-center gap-1.5">
            <Lock size={13} color={colors.ink} />
            <Text variant="caption">This task's unit is frozen over the free-tier limit — reassigning or moving it elsewhere is blocked until it's unfrozen.</Text>
          </div>
        </Banner>
      ) : null}

      {task.description ? (
        <Card className="p-4">
          <Text variant="label">Description</Text>
          <Text variant="body" className="mt-1 block text-[13px] leading-5">
            {task.description}
          </Text>
        </Card>
      ) : null}

      <div>
        <div className="mb-2 flex flex-row items-center justify-between">
          <div className="flex flex-row items-center gap-1.5">
            <Paperclip size={14} color={colors.ink} />
            <Text variant="heading">Attachments</Text>
          </div>
          <div className="flex flex-row gap-1.5">
            <Button title="Photo" size="sm" variant="ghost" onPress={() => imageInput.current?.click()} />
            <Button title="File" size="sm" variant="ghost" onPress={() => fileInput.current?.click()} />
          </div>
        </div>
        <TaskAttachments items={task.attachments} />
      </div>

      <div className="flex flex-row flex-wrap gap-2">
        {isAssignee && task.status === "Pending" && !task.blockedComment ? (
          <>
            <Button title="Accept" size="sm" icon={<CheckCircle2 size={14} color="#fff" />} onPress={() => run(() => T.acceptTask(me.id, taskId), "Task accepted")} />
            <Button title="Decline" size="sm" variant="outline" className="!border-red-300 !text-red-600 hover:!bg-red-50" onPress={() => setPrompt({ kind: "decline", text: "" })} />
          </>
        ) : null}
        {(isAssignee || isAssigner) && task.blockedComment && task.status === "Pending" ? (
          <Button title="Resolve blocker" size="sm" icon={<CheckCircle2 size={14} color="#fff" />} onPress={() => run(() => T.resolveBlock(me.id, taskId), "Blocker cleared")} />
        ) : null}
        {isAssignee && task.status === "In Progress" ? (
          <>
            <Button title="Submit for review" size="sm" icon={<Send size={14} color="#fff" />} onPress={() => run(() => T.submitForReview(me.id, taskId), "Sent for review")} />
            <Button title="Raise blocker" size="sm" variant="outline" className="!border-red-300 !text-red-600 hover:!bg-red-50" onPress={() => setPrompt({ kind: "block", text: "" })} />
          </>
        ) : null}
        {isReviewer && task.status === "Review" ? (
          <>
            <Button title="Mark reviewed" size="sm" variant="ghost" className="!bg-emerald-600 !text-white hover:!bg-emerald-700" icon={<CheckCircle2 size={14} color="#fff" />} onPress={() => run(() => T.markReviewed(me.id, taskId), "Marked reviewed")} />
            <Button title="Send back" size="sm" variant="outline" className="!border-red-300 !text-red-600 hover:!bg-red-50" onPress={() => setPrompt({ kind: "reviewerBlock", text: "" })} />
          </>
        ) : null}
        {isAssigner && task.status === "Review" ? (
          <>
            <Button title="Approve" size="sm" variant="ghost" className="!bg-emerald-600 !text-white hover:!bg-emerald-700" icon={<CheckCircle2 size={14} color="#fff" />} onPress={() => run(() => T.approveTask(me.id, taskId), "Task approved")} />
            <Button title="Request changes" size="sm" variant="outline" className="!border-red-300 !text-red-600 hover:!bg-red-50" onPress={() => setPrompt({ kind: "revert", text: "" })} />
            {!task.reviewerId ? <Button title="Assign reviewer" size="sm" variant="ghost" onPress={() => setReviewerSheet(true)} /> : null}
          </>
        ) : null}
        {isAssigner && !["Approved", "Completed", "Declined"].includes(task.status) ? (
          <>
            <Button title="Reassign" size="sm" variant="ghost" icon={<UserCheck size={14} color={colors.ink} />} onPress={() => setReassignSheet(true)} />
            <Button
              title="Edit"
              size="sm"
              variant="ghost"
              onPress={() => {
                setEdit({ title: task.title, description: task.description ?? "" });
                setEditSheet(true);
              }}
            />
            <Button
              title="Delete"
              size="sm"
              variant="ghost"
              icon={<Trash2 size={14} color={colors.destructive} />}
              onPress={() =>
                confirmAction("Delete this task?", "This can't be undone.", () => {
                  try {
                    T.deleteTask(me.id, taskId);
                    if (modal) onClose?.();
                    else navigate(-1);
                  } catch (e) {
                    toast.show(e instanceof Error ? e.message : "Could not delete", "error");
                  }
                })
              }
            />
          </>
        ) : null}
      </div>

      <KeyValueList>
        <KeyValueRow label="Assignee" value={task.assigneeName ?? "Unassigned"} />
        <KeyValueRow label="Created by" value={task.assignerName ?? "Unknown"} />
        {task.reviewerName ? <KeyValueRow label="Reviewer" value={task.reviewerName} /> : null}
        <KeyValueRow label="Deadline" value={<span className="text-[13px]" style={{ color: overdue ? colors.destructive : colors.ink }}>{task.dueDate ? shortDate(task.dueDate) : "—"}</span>} />
        {task.orgUnitName ? <KeyValueRow label="Unit" value={task.orgUnitName} /> : null}
        {desk ? <KeyValueRow label="Time on desk" value={desk} last /> : <KeyValueRow label="Created" value={relativeTime(task.createdAt)} last />}
      </KeyValueList>

      <div>
        <div className="mb-2 flex flex-row items-center gap-1.5">
          <MessageSquare size={14} color={colors.ink} />
          <Text variant="heading">Comments</Text>
        </div>
        {task.comments.length === 0 ? (
          <Text variant="caption" className="block pb-2">
            No comments yet.
          </Text>
        ) : (
          <div className="flex flex-col gap-2">
            {task.comments.map((c) => (
              <Card key={c.id} className="p-3">
                <div className="flex flex-row items-center justify-between">
                  <Text variant="caption" className="font-semibold text-ink">
                    {c.authorName}
                  </Text>
                  <Text variant="caption">{relativeTime(c.createdAt)}</Text>
                </div>
                <Text variant="body" className="mt-1 block text-[13px] leading-5">
                  {c.body}
                </Text>
              </Card>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-row items-end gap-2">
          <Input
            containerClassName="flex-1"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && comment.trim()) {
                T.addComment(me.id, taskId, comment);
                setComment("");
              }
            }}
          />
          <Button
            title="Post"
            size="sm"
            onPress={() => {
              if (!comment.trim()) return;
              T.addComment(me.id, taskId, comment);
              setComment("");
            }}
          />
        </div>
      </div>

      <div>
        <Text variant="heading" className="mb-2 block">
          History
        </Text>
        <div className="flex flex-col gap-2">
          {task.revisions.map((r) => (
            <div key={r.id} className="flex flex-row gap-2.5">
              <div className="mt-1 h-2 w-2 rounded-full bg-hairline" />
              <div className="flex-1 border-b border-hairline/50 pb-2">
                <div className="flex flex-row items-center justify-between">
                  <Text variant="caption" className="font-semibold text-ink">
                    {ACTION_LABEL[r.action] ?? r.action}
                  </Text>
                  <Text variant="caption">{relativeTime(r.createdAt)}</Text>
                </div>
                <Text variant="caption">by {r.actorName}</Text>
                {r.note ? (
                  <Text variant="caption" className="mt-0.5 block text-ink">
                    "{r.note}"
                  </Text>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  const overlays = (
    <>
      <Sheet
        visible={!!prompt}
        onClose={() => setPrompt(null)}
        title={prompt?.kind === "revert" ? "Request changes" : prompt?.kind === "block" ? "Raise a blocker" : prompt?.kind === "reviewerBlock" ? "Send back to assignee" : "Decline task"}
        footer={<Button title="Submit" fullWidth onPress={submitPrompt} disabled={prompt?.kind !== "decline" && !prompt?.text.trim()} />}
      >
        <Input value={prompt?.text ?? ""} onChange={(e) => setPrompt((p) => (p ? { ...p, text: e.target.value } : p))} placeholder={prompt?.kind === "decline" ? "Reason (optional)" : "Add a note so they know what to change"} />
      </Sheet>

      <Sheet
        visible={reviewerSheet}
        onClose={() => setReviewerSheet(false)}
        title="Assign a reviewer"
        footer={
          <Button
            title="Assign"
            fullWidth
            disabled={!pendingPerson}
            onPress={() => {
              if (pendingPerson) run(() => T.assignReviewer(me.id, taskId, pendingPerson), "Reviewer assigned");
              setReviewerSheet(false);
            }}
          />
        }
      >
        <Select label="Reviewer" value={pendingPerson} options={people.map((p) => ({ value: p.id, label: fullName(p), hint: p.roleName ?? undefined }))} onChange={setPendingPerson} />
      </Sheet>

      <Sheet
        visible={reassignSheet}
        onClose={() => setReassignSheet(false)}
        title="Reassign task"
        footer={
          <Button
            title="Reassign"
            fullWidth
            disabled={!pendingPerson}
            onPress={() => {
              if (pendingPerson) run(() => T.reassignTask(me.id, taskId, pendingPerson), "Task reassigned");
              setReassignSheet(false);
            }}
          />
        }
      >
        <Select label="New assignee" value={pendingPerson} options={people.map((p) => ({ value: p.id, label: fullName(p), hint: p.roleName ?? undefined }))} onChange={setPendingPerson} />
      </Sheet>

      <Sheet
        visible={editSheet}
        onClose={() => setEditSheet(false)}
        title="Edit task"
        footer={
          <Button
            title="Save"
            fullWidth
            disabled={!edit.title.trim()}
            onPress={() => {
              run(() => T.updateTask(me.id, taskId, { title: edit.title, description: edit.description }), "Task updated");
              setEditSheet(false);
            }}
          />
        }
      >
        <div className="flex flex-col gap-3">
          <Input label="Title" value={edit.title} onChange={(e) => setEdit((s) => ({ ...s, title: e.target.value }))} />
          <Input label="Description" value={edit.description} onChange={(e) => setEdit((s) => ({ ...s, description: e.target.value }))} />
        </div>
      </Sheet>
    </>
  );

  if (modal) {
    return (
      <div className="max-h-[85vh] overflow-y-auto p-4">
        {body}
        {overlays}
      </div>
    );
  }

  return (
    <Screen maxWidth={900}>
      {body}
      {overlays}
    </Screen>
  );
}

function TaskAttachments({ items }: { items: T.TaskAttachmentView[] }) {
  if (!items.length) return <Text variant="caption">No attachments yet.</Text>;
  const images = items.filter((a) => a.kind === "image");
  const files = items.filter((a) => a.kind !== "image");
  return (
    <div className="flex flex-col gap-2">
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
          <FileText size={16} color={colors.slate} />
          <span className="flex-1 truncate text-[13px] text-ink">{a.filename}</span>
          {a.sizeBytes ? <Text variant="caption">{humanSize(a.sizeBytes)}</Text> : null}
        </a>
      ))}
    </div>
  );
}
