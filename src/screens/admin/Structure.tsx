import { useMemo, useState } from "react";
import { Building2, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";

import { Screen, PageHeader } from "../../components/ui/Screen";
import { Text } from "../../components/ui/Text";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Sheet } from "../../components/ui/Sheet";
import { useToast } from "../../components/ui/Toast";
import { AdminGuard } from "../../components/admin/AdminGuard";
import { useCurrentUser } from "../../lib/hooks";
import { useDB } from "../../lib/db/store";
import { createUnit, deleteUnit, listUnits, renameUnit, UnitView } from "../../lib/services/org";
import { confirmAction } from "../../lib/confirm";
import { colors } from "../../lib/theme";

export default function Structure() {
  const me = useCurrentUser();
  const toast = useToast();
  const tick = useDB((db) => db.orgUnits.map((u) => u.id + u.name).join(","));
  const [creating, setCreating] = useState<{ parentId: string | null } | null>(null);
  const [name, setName] = useState("");
  const [unitType, setUnitType] = useState<"business_unit" | "department">("business_unit");
  const [renaming, setRenaming] = useState<UnitView | null>(null);
  const [renameVal, setRenameVal] = useState("");

  const { tree } = useMemo(() => (me ? listUnits(me.companyId) : { tree: [] as UnitView[] }), [me, tick]);

  if (!me) return null;

  const submitCreate = async () => {
    try {
      await createUnit(me.id, { name, unitType, parentUnitId: creating?.parentId ?? null });
      toast.show("Unit created", "success");
      setCreating(null);
      setName("");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  const submitRename = () => {
    if (!renaming) return;
    try {
      renameUnit(me.id, renaming.id, renameVal);
      toast.show("Renamed", "success");
      setRenaming(null);
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  const remove = (u: UnitView) =>
    confirmAction(
      `Delete "${u.name}"?`,
      "This can't be undone.",
      () => {
        try {
          deleteUnit(me.id, u.id);
          toast.show("Deleted", "success");
        } catch (e) {
          toast.show(e instanceof Error ? e.message : "Failed", "error");
        }
      },
      "Delete",
      true,
    );

  const Node = ({ u, depth }: { u: UnitView; depth: number }) => (
    <div>
      <div className="flex flex-row items-center gap-2 py-2" style={{ paddingLeft: depth * 18 }}>
        {depth > 0 ? <ChevronRight size={13} color={colors.mutedForeground} /> : null}
        <Building2 size={15} color={colors.slate} />
        <span className="text-[13px] font-medium text-ink">{u.name}</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-slate">{u.unitType === "business_unit" ? "Business Unit" : "Department"}</span>
        <Text variant="caption">
          {u.memberCount} member{u.memberCount === 1 ? "" : "s"}
        </Text>
        <div className="ml-auto flex flex-row gap-1">
          <button
            type="button"
            onClick={() => {
              setCreating({ parentId: u.id });
              setUnitType("department");
            }}
            className="p-1"
          >
            <Plus size={14} color={colors.slate} />
          </button>
          <button
            type="button"
            onClick={() => {
              setRenaming(u);
              setRenameVal(u.name);
            }}
            className="p-1"
          >
            <Pencil size={13} color={colors.slate} />
          </button>
          <button type="button" onClick={() => remove(u)} className="p-1">
            <Trash2 size={13} color={colors.destructive} />
          </button>
        </div>
      </div>
      {u.children.map((c) => (
        <Node key={c.id} u={c} depth={depth + 1} />
      ))}
    </div>
  );

  return (
    <AdminGuard>
      <Screen>
        <PageHeader
          title="Structure"
          subtitle="Business units and departments, nest them however your company works."
          right={
            <Button
              title="New unit"
              size="sm"
              icon={<Plus size={14} color={colors.white} />}
              onPress={() => {
                setCreating({ parentId: null });
                setUnitType("business_unit");
              }}
            />
          }
        />

        <Card className="p-2">
          {tree.length === 0 ? (
            <Text variant="caption" className="block p-4 text-center">
              No units yet. Create your first one.
            </Text>
          ) : (
            tree.map((u) => <Node key={u.id} u={u} depth={0} />)
          )}
        </Card>

        <Sheet visible={!!creating} onClose={() => setCreating(null)} title={creating?.parentId ? "New sub-unit" : "New top-level unit"} footer={<Button title="Create" fullWidth onPress={submitCreate} disabled={!name.trim()} />}>
          <Input label="Unit name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Operations" autoFocus />
          <div className="mt-3 flex flex-row gap-2">
            {(["business_unit", "department"] as const).map((t) => (
              <Button key={t} title={t === "business_unit" ? "Business Unit" : "Department"} size="sm" variant={unitType === t ? "primary" : "outline"} className="flex-1" onPress={() => setUnitType(t)} />
            ))}
          </div>
        </Sheet>

        <Sheet visible={!!renaming} onClose={() => setRenaming(null)} title="Rename unit" footer={<Button title="Save" fullWidth onPress={submitRename} disabled={!renameVal.trim()} />}>
          <Input label="Name" value={renameVal} onChange={(e) => setRenameVal(e.target.value)} autoFocus />
        </Sheet>
      </Screen>
    </AdminGuard>
  );
}
