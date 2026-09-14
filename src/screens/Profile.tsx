import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, HelpCircle, Lock, LogOut, Mail, Save, Send, Shield, Trash2 } from "lucide-react";

import { Screen, PageHeader } from "../components/ui/Screen";
import { Text } from "../components/ui/Text";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Banner } from "../components/ui/Feedback";
import { KeyValueList, KeyValueRow } from "../components/ui/KeyValue";
import { useToast } from "../components/ui/Toast";
import { useCurrentUser, useCompany } from "../lib/hooks";
import { useDB, resetToSeed } from "../lib/db/store";
import { changePassword, logout, updateProfile } from "../lib/services/auth";
import { askSupport, myEscalations } from "../lib/services/support";
import { fetchRealPlanStatus, RealPlanStatus } from "../lib/services/org";
import { useSession } from "../lib/session";
import { confirmAction } from "../lib/confirm";
import { fullName, shortDate } from "../lib/util";
import { colors } from "../lib/theme";
import { cn } from "../lib/cn";

/** Mirrors the real web app's Profile plan pill (components/views/profile-view.tsx):
 *  Founding member (amber) > Unlimited (ink) > Free trial, N days left (amber, red under 3 days) > Free plan (outline). */
function PlanBadge({ plan }: { plan: RealPlanStatus | null }) {
  if (!plan) return null;
  if (plan.isFounding) {
    return (
      <Badge label="Founding member" className="bg-amber text-[#202b4e]" textClassName="flex items-center gap-1 text-[#202b4e]" />
    );
  }
  if (plan.effectiveTier === "paid") {
    return <Badge label="Unlimited" className="bg-ink" textClassName="text-white" />;
  }
  if (plan.trialing) {
    const urgent = (plan.trialDaysLeft ?? 99) <= 3;
    const days = plan.trialDaysLeft ?? 0;
    return (
      <Badge
        label={`Free trial · ${days} day${days === 1 ? "" : "s"} left`}
        className={urgent ? "bg-destructive/15" : "bg-amber/20"}
        textClassName={urgent ? "text-destructive" : "text-[#8a6d1f]"}
      />
    );
  }
  return <Badge label="Free plan" className="border border-hairline bg-transparent" />;
}

export default function Profile() {
  const me = useCurrentUser();
  const company = useCompany();
  const { real } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ text: string; escalated: boolean } | null>(null);
  const [plan, setPlan] = useState<RealPlanStatus | null>(null);
  const escTick = useDB((db) => db.supportEscalations.length);
  const myEsc = useMemo(() => (me ? myEscalations(me.id) : []), [me, escTick]);

  const role = useDB((db) => db.roles.find((r) => r.id === me?.roleId)?.name ?? null);
  const unit = useDB((db) => {
    const link = db.userOrgUnits.find((l) => l.userId === me?.id);
    return db.orgUnits.find((u) => u.id === link?.orgUnitId)?.name ?? null;
  });

  useEffect(() => {
    if (me) {
      setFirstName(me.firstName);
      setLastName(me.lastName);
    }
  }, [me?.id]);

  useEffect(() => {
    if (!real) return;
    fetchRealPlanStatus().then(setPlan);
  }, [real]);

  if (!me) return null;

  const saveName = async () => {
    if (!firstName.trim() || !lastName.trim()) return;
    try {
      await updateProfile(me.id, { firstName: firstName.trim(), lastName: lastName.trim() });
      setSavedMsg("Profile updated successfully.");
      toast.show("Profile updated successfully.", "success");
      setTimeout(() => setSavedMsg(null), 3000);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update profile.";
      setSavedMsg(msg);
      toast.show(msg, "error");
      setTimeout(() => setSavedMsg(null), 3000);
    }
  };

  const savePassword = async () => {
    setPwError(null);
    setPwSuccess(null);
    if (next !== confirm) return setPwError("New passwords do not match.");
    try {
      await changePassword(me.id, cur, next);
      setCur("");
      setNext("");
      setConfirm("");
      setPwSuccess("Password changed successfully.");
      toast.show("Password changed successfully.", "success");
      setTimeout(() => setPwSuccess(null), 3000);
    } catch (e) {
      setPwError(e instanceof Error ? e.message : "Failed to change password.");
    }
  };

  const doLogout = async () => {
    await logout();
    navigate("/welcome", { replace: true });
  };

  const doReset = async () => {
    await resetToSeed();
    toast.show("Demo data reset", "success");
    await logout();
    navigate("/welcome", { replace: true });
  };

  return (
    <Screen maxWidth={840}>
      <PageHeader title="Profile" subtitle="Manage your account information." />

      <Card className="flex flex-row items-center gap-4 p-6">
        <div className="rounded-full ring-2 ring-hairline">
          <Avatar name={fullName(me)} size="xl" tone="muted" />
        </div>
        <div className="flex-1">
          <Text variant="heading" className="text-[16px]">
            {fullName(me)}
          </Text>
          <div className="mt-1.5 flex flex-row flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1">
              <Mail size={11} color={colors.mutedForeground} />
              <Badge label={me.email} />
            </span>
            {role ? (
              <span className="inline-flex items-center gap-1">
                <Shield size={11} color={colors.mutedForeground} />
                <Badge label={role} />
              </span>
            ) : null}
            {unit ? (
              <span className="inline-flex items-center gap-1">
                <Building2 size={11} color={colors.mutedForeground} />
                <Badge label={unit} />
              </span>
            ) : null}
            <PlanBadge plan={plan} />
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <Text variant="heading">Personal Information</Text>
        <div className="flex flex-row gap-3">
          <Input containerClassName="flex-1" label="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <Input containerClassName="flex-1" label="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <Input label="Email" value={me.email} disabled hint="Email cannot be changed." />
        {savedMsg ? (
          <Text variant="caption" tone={savedMsg.includes("successfully") ? undefined : "danger"} className={savedMsg.includes("successfully") ? "font-medium text-teal" : undefined}>
            {savedMsg}
          </Text>
        ) : null}
        <Button title="Save Changes" size="sm" icon={<Save size={14} color={colors.white} />} onPress={saveName} disabled={!firstName.trim() || !lastName.trim()} />
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <div className="flex flex-row items-center gap-1.5">
          <Lock size={15} color={colors.ink} />
          <Text variant="heading">Change Password</Text>
        </div>
        {pwError ? <Banner tone="error">{pwError}</Banner> : null}
        <Input label="Current Password" value={cur} onChange={(e) => setCur(e.target.value)} secure icon={<Lock size={15} color={colors.mutedForeground} />} />
        <Input
          label="New Password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          secure
          hint="Min 8 chars, 1 uppercase, 1 number, 1 special character."
          icon={<Lock size={15} color={colors.mutedForeground} />}
        />
        <Input label="Confirm New Password" value={confirm} onChange={(e) => setConfirm(e.target.value)} secure icon={<Lock size={15} color={colors.mutedForeground} />} />
        {pwSuccess ? (
          <Text variant="caption" className="font-medium text-teal">
            {pwSuccess}
          </Text>
        ) : null}
        <Button title="Change Password" size="sm" icon={<Lock size={14} color={colors.white} />} onPress={savePassword} disabled={!cur || !next || !confirm} />
      </Card>

      <div className="flex flex-col gap-2">
        <Text variant="heading" className="px-1">
          Account Information
        </Text>
        <KeyValueList>
          <KeyValueRow label="Department" value={unit ?? "—"} />
          <KeyValueRow label="Role" value={role ?? "—"} />
          <KeyValueRow label="Account Created" value={shortDate(me.createdAt)} />
          <KeyValueRow label="Status" value={<Badge label={me.status === "active" ? "Active" : "Inactive"} className={me.status === "active" ? "bg-ink" : "bg-muted"} textClassName={me.status === "active" ? "text-white" : undefined} />} />
          <KeyValueRow label="Email Verified" value={<Badge label={me.isEmailVerified ? "Verified" : "Not Verified"} className={me.isEmailVerified ? "bg-ink" : undefined} textClassName={me.isEmailVerified ? "text-white" : undefined} />} last />
        </KeyValueList>
      </div>

      <Card className="flex flex-col gap-3 p-4">
        <div className="flex flex-row items-center gap-1.5">
          <HelpCircle size={15} color={colors.ink} />
          <Text variant="heading">Ask for help</Text>
        </div>
        <div className="flex flex-row items-end gap-2">
          <Input containerClassName="flex-1" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="How do I…?" />
          <Button
            title=""
            size="sm"
            icon={<Send size={14} color={colors.white} />}
            disabled={!question.trim()}
            onPress={() => {
              const r = askSupport(me.id, question);
              setAnswer(r.matched ? { text: r.answer!, escalated: false } : { text: "I couldn't find that in the help docs — sent to our team, we'll follow up.", escalated: true });
              setQuestion("");
            }}
          />
        </div>
        {answer ? <Banner tone={answer.escalated ? "warn" : "success"}>{answer.text}</Banner> : null}
        {myEsc.length > 0 ? (
          <div className="flex flex-col gap-1.5 border-t border-hairline/60 pt-2">
            <Text variant="caption" className="font-semibold uppercase tracking-wide">
              Your questions sent to our team
            </Text>
            {myEsc.slice(0, 5).map((e) => (
              <div key={e.id} className="flex flex-row items-center justify-between">
                <span className="flex-1 truncate text-[12px] text-ink">{e.question}</span>
                <Badge label={e.status} className={e.status === "resolved" ? "bg-teal/15" : "bg-amber/20"} />
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      <div className="flex flex-row items-center justify-between gap-2 pt-1">
        {!real ? (
          <Button
            title="Reset demo data"
            variant="ghost"
            size="sm"
            icon={<Trash2 size={14} color={colors.destructive} />}
            onPress={() => confirmAction("Reset demo data?", "This wipes local data and restores the seed. You'll be signed out.", doReset, "Reset", true)}
          />
        ) : (
          <span />
        )}
        <Button title="Sign out" variant="outline" size="sm" icon={<LogOut size={14} color={colors.ink} />} onPress={doLogout} />
      </div>
    </Screen>
  );
}
