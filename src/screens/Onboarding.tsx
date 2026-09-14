import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Building2, Check, GitBranch, Loader2, UserCheck } from "lucide-react";

import { Select } from "./../components/ui/Select";
import { useCurrentUser } from "../lib/hooks";
import { useDB } from "../lib/db/store";
import { onboardingStatus, createUnit, createRole, finishOnboarding } from "../lib/services/org";

const UNIT_TYPES = [
  { value: "business_unit", label: "Business Unit" },
  { value: "department", label: "Department" },
] as const;

export default function Onboarding() {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [unitName, setUnitName] = useState("");
  const [unitType, setUnitType] = useState<"business_unit" | "department">("business_unit");
  const [roleName, setRoleName] = useState("");
  const [pickUnit, setPickUnit] = useState("");
  const [pickRole, setPickRole] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const units = useDB((db) => db.orgUnits.filter((u) => u.companyId === me?.companyId));
  const roles = useDB((db) => db.roles.filter((r) => r.companyId === me?.companyId));

  useEffect(() => {
    if (!me) return;
    const s = onboardingStatus(me.id);
    if (!s.needsOnboarding) navigate("/dashboard", { replace: true });
    if (units.length) setStep((x) => Math.max(x, 2));
    if (units.length && roles.some((r) => !r.isAdminRole)) setStep((x) => Math.max(x, 3));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, units.length, roles.length]);

  const unitOpts = useMemo(() => units.map((u) => ({ value: u.id, label: u.name })), [units]);
  const roleOpts = useMemo(() => roles.map((r) => ({ value: r.id, label: r.name })), [roles]);
  const createdRoles = roles.filter((r) => !r.isAdminRole);

  if (!me) return null;

  const addUnit = async () => {
    setError(null);
    setBusy(true);
    try {
      await createUnit(me.id, { name: unitName, unitType });
      setUnitName("");
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the unit");
    } finally {
      setBusy(false);
    }
  };

  const addRole = async () => {
    setError(null);
    setBusy(true);
    try {
      await createRole(me.id, roleName);
      setRoleName("");
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the role");
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setError(null);
    setBusy(true);
    try {
      await finishOnboarding(me.id, pickUnit || units[0]?.id, pickRole || createdRoles[0]?.id || roles[0]?.id);
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finish setup");
      setBusy(false);
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg rounded-2xl border border-hairline bg-card p-8 shadow-sm">
        <h1 className="text-center text-xl font-bold text-ink">Set up your organization</h1>
        <p className="mb-6 mt-1 text-center text-sm text-muted-foreground">
          Three quick steps and you're in. You can change all of this later.
        </p>

        <Stepper step={step} />

        {error ? <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}

        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Building2 size={16} /> Create your first unit
            </div>
            <p className="text-xs text-muted-foreground">
              A Business Unit or a Department, whatever the top of your structure looks like. Add more later.
            </p>
            <input
              autoFocus
              value={unitName}
              onChange={(e) => setUnitName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addUnit()}
              placeholder="e.g. Operations"
              className="w-full rounded-lg border border-hairline px-3 py-2 text-sm text-ink outline-none focus:border-ink"
            />
            <div className="flex gap-2">
              {UNIT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setUnitType(t.value)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    unitType === t.value ? "border-ink bg-ink text-white" : "border-hairline text-muted-foreground hover:border-ink"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={addUnit}
              disabled={busy || !unitName.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber px-4 py-2.5 text-sm font-bold text-ink transition hover:brightness-95 disabled:opacity-40"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : (<>Continue <ArrowRight size={16} /></>)}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <GitBranch size={16} /> Create a role
            </div>
            <p className="text-xs text-muted-foreground">
              Roles carry a rank (seniority). Your first role sits at the top. Add the rest, with their reporting order, from Settings.
            </p>
            <input
              autoFocus
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addRole()}
              placeholder="e.g. Head of Operations"
              className="w-full rounded-lg border border-hairline px-3 py-2 text-sm text-ink outline-none focus:border-ink"
            />
            {createdRoles.length > 0 ? (
              <p className="text-xs text-muted-foreground">Created: {createdRoles.map((r) => r.name).join(", ")}</p>
            ) : null}
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(1)} className="rounded-lg border border-hairline px-4 py-2.5 text-sm font-medium text-muted-foreground">
                Back
              </button>
              <button
                type="button"
                onClick={addRole}
                disabled={busy || !roleName.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-amber px-4 py-2.5 text-sm font-bold text-ink transition hover:brightness-95 disabled:opacity-40"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : (<>Continue <ArrowRight size={16} /></>)}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <UserCheck size={16} /> Place yourself
            </div>
            <p className="text-xs text-muted-foreground">Which unit and role are you?</p>
            <Select label="Unit" value={pickUnit || unitOpts[0]?.value || null} options={unitOpts} onChange={setPickUnit} />
            <Select label="Role" value={pickRole || roleOpts[0]?.value || null} options={roleOpts} onChange={setPickRole} />
            <button
              type="button"
              onClick={finish}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-status-done px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-95 disabled:opacity-40"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : (<>Finish setup <Check size={16} /></>)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-2">
      {[1, 2, 3].map((n) => (
        <div key={n} className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
              step > n ? "bg-status-done text-white" : step === n ? "bg-ink text-white" : "bg-hairline text-muted-foreground"
            }`}
          >
            {step > n ? <Check size={16} /> : n}
          </div>
          {n < 3 ? <div className={`h-0.5 w-10 ${step > n ? "bg-status-done" : "bg-hairline"}`} /> : null}
        </div>
      ))}
    </div>
  );
}
