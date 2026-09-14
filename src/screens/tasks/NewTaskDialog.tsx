import { useRef, useState } from "react";
import { Loader2, Paperclip, X } from "lucide-react";

import { useCurrentUser } from "../../lib/hooks";
import { useToast } from "../../components/ui/Toast";
import { createTask, NewTaskAttachment } from "../../lib/services/tasks";
import { TaskPriority } from "../../lib/db/schema";
import { humanSize } from "../../lib/util";

const PRIORITIES: TaskPriority[] = ["Low", "Normal", "High", "Critical"];
const MAX_ATTACHMENTS = 5;

function fileToAttachment(file: File): Promise<NewTaskAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ filename: file.name, mime: file.type || null, sizeBytes: file.size, uri: reader.result as string });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Task-creation popup, ported from the real web app's NewTaskDialog
 *  (components/views/tasks-view.tsx) — a small centered modal, not a
 *  full-page route. */
export function NewTaskDialog({
  people,
  onClose,
  onDone,
}: {
  people: { id: string; firstName: string; lastName: string; roleName: string | null }[];
  onClose: () => void;
  onDone: () => void;
}) {
  const me = useCurrentUser();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("Normal");
  const [dueDate, setDueDate] = useState("");
  const [files, setFiles] = useState<NewTaskAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    const good: NewTaskAttachment[] = [];
    for (const f of Array.from(list)) good.push(await fileToAttachment(f));
    setFiles((prev) => [...prev, ...good].slice(0, MAX_ATTACHMENTS));
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = () => {
    if (!me || !title.trim() || !assigneeId) return;
    setBusy(true);
    setErr(null);
    try {
      createTask(me.id, {
        title: title.trim(),
        description: desc.trim() || undefined,
        assigneeId,
        reviewerId: reviewerId || undefined,
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        attachments: files,
      });
      toast.show("Task created", "success");
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create the task");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-2xl border border-hairline bg-card p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">New task</h2>
          <button type="button" onClick={onClose}>
            <X className="h-4 w-4 text-slate" />
          </button>
        </div>
        {err ? <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div> : null}
        <div className="space-y-3">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
            className="w-full rounded-lg border border-hairline px-3 py-2 text-sm text-ink outline-none focus:border-ink"
          />
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Details (optional)"
            rows={3}
            className="w-full resize-none rounded-lg border border-hairline px-3 py-2 text-sm text-ink outline-none focus:border-ink"
          />
          <label className="block text-xs font-medium text-slate">
            Assign to
            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="mt-1 w-full rounded-lg border border-hairline px-3 py-2 text-sm text-ink outline-none focus:border-ink">
              <option value="">Pick a person who reports to you</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName}
                  {p.roleName ? ` · ${p.roleName}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate">
            Reviewer (optional)
            <select value={reviewerId} onChange={(e) => setReviewerId(e.target.value)} className="mt-1 w-full rounded-lg border border-hairline px-3 py-2 text-sm text-ink outline-none focus:border-ink">
              <option value="">No reviewer</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <label className="flex-1 text-xs font-medium text-slate">
              Priority
              <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className="mt-1 w-full rounded-lg border border-hairline px-2 py-2 text-sm text-ink outline-none focus:border-ink">
                {PRIORITIES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="flex-1 text-xs font-medium text-slate">
              Due date
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1 w-full rounded-lg border border-hairline px-2 py-2 text-sm text-ink outline-none focus:border-ink" />
            </label>
          </div>

          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1.5 text-xs font-medium text-slate hover:border-ink hover:text-ink"
            >
              <Paperclip className="h-3.5 w-3.5" /> Attach PDF or image
            </button>
            <input ref={fileRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => addFiles(e.target.files)} />
            {files.map((f, i) => (
              <div key={`${f.filename}-${i}`} className="flex items-center gap-2 rounded-lg bg-background px-2.5 py-1.5 text-xs text-ink">
                <Paperclip className="h-3 w-3 shrink-0 text-slate" />
                <span className="min-w-0 flex-1 truncate">{f.filename}</span>
                {f.sizeBytes ? <span className="shrink-0 text-[10px] text-slate">{humanSize(f.sizeBytes)}</span> : null}
                <button type="button" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="shrink-0 text-slate hover:text-red-500">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={busy || !title.trim() || !assigneeId}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber px-4 py-2.5 text-sm font-bold text-ink disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create task"}
          </button>
        </div>
      </div>
    </div>
  );
}
