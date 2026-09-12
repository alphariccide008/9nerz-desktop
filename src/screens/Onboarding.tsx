import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Building2, Check, GitBranch, UserCheck } from "lucide-react";

import { AuthScaffold } from "../components/auth/AuthScaffold";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Text } from "../components/ui/Text";
import { Banner } from "../components/ui/Feedback";
import { Select } from "../components/ui/Select";
import { useCurrentUser } from "../lib/hooks";
import { useDB } from "../lib/db/store";
import { onboardingStatus, createUnit, createRole, finishOnboarding } from "../lib/services/org";
import { useToast } from "../components/ui/Toast";
import { colors } from "../lib/theme";

export default function Onboarding() {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const toast = useToast();
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
    if (units.length && roles.length > 1) setStep((x) => Math.max(x, 3));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, units.length, roles.length]);

  const unitOpts = useMemo(() => units.map((u) => ({ value: u.id, label: u.name })), [units]);
  const roleOpts = useMemo(() => roles.map((r) => ({ value: r.id, label: r.name })), [roles]);

  if (!me) return null;

  const addUnit = () => {
    setError(null);
    setBusy(true);
    try {
      createUnit(me.id, { name: unitName, unitType });
      setUnitName("");
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the unit");
    } finally {
      setBusy(false);
    }
  };

  const addRole = () => {
    setError(null);
    setBusy(true);
    try {
      createRole(me.id, roleName);
      setRoleName("");
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the role");
    } finally {
      setBusy(false);
    }
  };

  const finish = () => {
    setError(null);
    setBusy(true);
    try {
      finishOnboarding(me.id, pickUnit || units[0]?.id, pickRole || roles.find((r) => !r.isAdminRole)?.id || roles[0]?.id);
      toast.show("You're all set", "success");
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finish setup");
      setBusy(false);
    }
  };

  return (
    <AuthScaffold
      eyebrow={`Step ${step} of 3`}
      title="Set up your organization"
      subtitle="Three quick steps and you're in. You can change all of this later."
      onBack={() => (step > 1 ? setStep(step - 1) : navigate("/welcome"))}
    >
      <Stepper step={step} />
      {error ? <Banner tone="error">{error}</Banner> : null}

      {step === 1 && (
        <>
          <div className="flex flex-row items-center gap-2">
            <Building2 size={16} color={colors.ink} />
            <Text variant="heading">Create your first unit</Text>
          </div>
          <Text variant="caption">A Business Unit or a Department — whatever the top of your structure looks like.</Text>
          <Input value={unitName} onChange={(e) => setUnitName(e.target.value)} placeholder="e.g. Operations" autoFocus />
          <div className="flex flex-row gap-2">
            {(["business_unit", "department"] as const).map((t) => (
              <Button
                key={t}
                title={t === "business_unit" ? "Business Unit" : "Department"}
                variant={unitType === t ? "primary" : "outline"}
                size="sm"
                className="flex-1"
                onPress={() => setUnitType(t)}
              />
            ))}
          </div>
          <Button title="Continue" onPress={addUnit} loading={busy} disabled={!unitName.trim()} fullWidth icon={<ArrowRight size={15} color={colors.white} />} />
        </>
      )}

      {step === 2 && (
        <>
          <div className="flex flex-row items-center gap-2">
            <GitBranch size={16} color={colors.ink} />
            <Text variant="heading">Create a role</Text>
          </div>
          <Text variant="caption">Roles carry a rank. Add the rest, with reporting order, from the admin console later.</Text>
          <Input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="e.g. Head of Operations" autoFocus />
          {roles.filter((r) => !r.isAdminRole).length > 0 ? (
            <Text variant="caption">Created: {roles.filter((r) => !r.isAdminRole).map((r) => r.name).join(", ")}</Text>
          ) : null}
          <Button title="Continue" onPress={addRole} loading={busy} disabled={!roleName.trim()} fullWidth icon={<ArrowRight size={15} color={colors.white} />} />
        </>
      )}

      {step === 3 && (
        <>
          <div className="flex flex-row items-center gap-2">
            <UserCheck size={16} color={colors.ink} />
            <Text variant="heading">Place yourself</Text>
          </div>
          <Select label="Unit" value={pickUnit || unitOpts[0]?.value || null} options={unitOpts} onChange={setPickUnit} />
          <Select label="Role" value={pickRole || roleOpts[0]?.value || null} options={roleOpts} onChange={setPickRole} />
          <Button title="Finish setup" onPress={finish} loading={busy} fullWidth icon={<Check size={15} color={colors.white} />} />
        </>
      )}
    </AuthScaffold>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex flex-row items-center justify-center gap-1.5">
      {[1, 2, 3].map((n) => (
        <div key={n} className="flex flex-row items-center gap-1.5">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ backgroundColor: step > n ? colors.teal : step === n ? colors.ink : colors.hairline }}
          >
            {step > n ? (
              <Check size={13} color="#fff" />
            ) : (
              <span className="text-[11px] font-bold" style={{ color: step === n ? "#fff" : colors.slate }}>
                {n}
              </span>
            )}
          </div>
          {n < 3 ? <div className="h-0.5 w-8" style={{ backgroundColor: step > n ? colors.teal : colors.hairline }} /> : null}
        </div>
      ))}
    </div>
  );
}
