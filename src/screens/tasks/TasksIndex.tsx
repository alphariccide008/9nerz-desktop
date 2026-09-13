import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Clock, Plus } from "lucide-react";

import { Screen, PageHeader } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Segmented } from "../../components/ui/Segmented";
import { StatusPill } from "../../components/ui/Badge";
import { EmptyState } from "../../components/ui/Feedback";
import { useCurrentUser } from "../../lib/hooks";
import { useDB } from "../../lib/db/store";
import { listTasks, TaskScope } from "../../lib/services/tasks";
import { fullName, isOverdue, shortDate } from "../../lib/util";
import { colors } from "../../lib/theme";
import { TaskDetailContent } from "./TaskDetail";

const TABS: { value: TaskScope; label: string }[] = [
  { value: "mine", label: "My tasks" },
  { value: "assigned", label: "Assigned by me" },
  { value: "team", label: "My team" },
];

export default function TasksIndex() {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TaskScope>("mine");
  const [openId, setOpenId] = useState<string | null>(null);
  const tick = useDB((db) => db.tasks.map((t) => t.updatedAt).join(","));

  const tasks = useMemo(() => (me ? listTasks(me.id, tab) : []), [me, tab, tick]);

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  if (!me) return null;

  return (
    <>
    <Screen>
      <PageHeader title="Tasks" right={<Button title="New task" size="sm" icon={<Plus size={15} color={colors.white} />} onPress={() => navigate("/tasks/new")} />} />
      <Segmented options={TABS} value={tab} onChange={setTab} />

      {tasks.length === 0 ? (
        <EmptyState title="Nothing here yet" body={tab === "assigned" ? "Tasks you create for your reports will show up here." : "You're all caught up."} />
      ) : (
        <Card>
          {tasks.map((t, i) => {
            const overdue = isOverdue(t.dueDate, t.status);
            const other = tab === "mine" ? t.assigner : t.assignee;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setOpenId(t.id)}
                className={`flex w-full flex-row items-center gap-3 px-4 py-3 text-left ${i > 0 ? "border-t border-hairline/60" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-row items-center gap-1.5">
                    <span className="flex-1 truncate text-[13px] font-medium text-ink">{t.title}</span>
                    {t.blockedAt ? <AlertTriangle size={13} color={colors.destructive} /> : null}
                  </div>
                  <Text variant="caption" className="block truncate">
                    {tab === "mine" ? "from " : "to "}
                    {other ? fullName(other) : "—"}
                    {t.reviewer ? ` · review: ${fullName(t.reviewer)}` : ""}
                  </Text>
                </div>
                {t.dueDate ? (
                  <div className="flex flex-row items-center gap-1 shrink-0">
                    <Clock size={11} color={overdue ? colors.destructive : colors.mutedForeground} />
                    <span className="text-[11px]" style={{ color: overdue ? colors.destructive : colors.mutedForeground }}>
                      {shortDate(t.dueDate)}
                    </span>
                  </div>
                ) : null}
                <StatusPill status={t.status} />
              </button>
            );
          })}
        </Card>
      )}
    </Screen>

    {openId ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(18,23,42,0.45)" }}>
        <div className="absolute inset-0" onClick={() => setOpenId(null)} />
        <div className="relative w-[96vw] max-w-[1152px] overflow-hidden rounded-2xl border border-hairline bg-card shadow-xl">
          <TaskDetailContent taskId={openId} onClose={() => setOpenId(null)} />
        </div>
      </div>
    ) : null}
    </>
  );
}
