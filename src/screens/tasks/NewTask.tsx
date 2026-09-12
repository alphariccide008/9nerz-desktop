import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Screen, PageHeader } from "../../components/ui/Screen";
import { Input, Textarea } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { Banner } from "../../components/ui/Feedback";
import { DateField } from "../../components/ui/DateField";
import { useCurrentUser } from "../../lib/hooks";
import { assignableTo, createTask } from "../../lib/services/tasks";
import { fullName } from "../../lib/util";
import { useToast } from "../../components/ui/Toast";
import { TaskPriority } from "../../lib/db/schema";

const PRIORITIES: TaskPriority[] = ["Low", "Normal", "High", "Critical"];

export default function NewTask() {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [reviewerId, setReviewerId] = useState<string | null>(null);
  const [priority, setPriority] = useState<TaskPriority>("Normal");
  const [due, setDue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const people = useMemo(() => (me ? assignableTo(me.id) : []), [me]);
  const opts = people.map((p) => ({ value: p.id, label: fullName(p), hint: p.roleName ?? undefined }));

  if (!me) return null;

  const submit = async () => {
    setError(null);
    if (!title.trim()) return setError("Give the task a title.");
    if (!assigneeId) return setError("Pick who this is for.");
    setBusy(true);
    try {
      const t = createTask(me.id, {
        title,
        description: desc,
        assigneeId,
        reviewerId: reviewerId ?? undefined,
        priority,
        dueDate: due,
      });
      toast.show("Task created", "success");
      navigate(`/tasks/${t.id}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the task");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen maxWidth={680}>
      <PageHeader title="New task" subtitle="Create a task for someone who reports to you." />
      {error ? <Banner tone="error">{error}</Banner> : null}
      {people.length === 0 ? <Banner tone="warn">Nobody reports to you yet, so there's no one to assign a task to.</Banner> : null}

      <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" />
      <Textarea label="Details (optional)" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Context, links, acceptance criteria…" />
      <Select label="Assign to" value={assigneeId} options={opts} onChange={setAssigneeId} placeholder="Pick a person who reports to you" />
      <Select label="Reviewer (optional)" value={reviewerId} options={opts} onChange={setReviewerId} placeholder="No reviewer" allowClear />
      <div className="flex flex-row gap-3">
        <div className="flex-1">
          <Select label="Priority" value={priority} options={PRIORITIES.map((p) => ({ value: p, label: p }))} onChange={(v) => setPriority(v as TaskPriority)} />
        </div>
        <div className="flex-1">
          <DateField label="Due date" value={due} onChange={setDue} />
        </div>
      </div>
      <Button title="Create task" onPress={submit} loading={busy} fullWidth disabled={people.length === 0} />
    </Screen>
  );
}
