import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HelpCircle, Lock, LogOut, Save, Send, Trash2 } from "lucide-react";

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
import { confirmAction } from "../lib/confirm";
import { fullName, shortDate } from "../lib/util";
import { colors } from "../lib/theme";
import { cn } from "../lib/cn";

export default function Profile() {
  const me = useCurrentUser();
  const company = useCompany();
  const navigate = useNavigate();
  const toast = useToast();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ text: string; escalated: boolean } | null>(null);
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

  if (!me) return null;

  const saveName = () => {
    try {
      updateProfile(me.id, { firstName, lastName });
      toast.show("Profile updated", "success");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "Failed", "error");
    }
  };

  const savePassword = () => {
    setPwError(null);
    if (next !== confirm) return setPwError("New passwords do not match.");
    try {
      changePassword(me.id, cur, next);
      setCur("");
      setNext("");
      setConfirm("");
      toast.show("Password changed", "success");
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
    <Screen maxWidth={620}>
      <PageHeader title="Profile" subtitle="Manage your account." />

      <Card className="flex flex-row items-center gap-3 p-4">
        <Avatar name={fullName(me)} size="lg" tone="primary" />
        <div className="flex-1">
          <Text variant="heading">{fullName(me)}</Text>
          <Text variant="caption">{me.email}</Text>
          <div className="mt-1.5 flex flex-row flex-wrap gap-1.5">
            {role ? <Badge label={role} /> : null}
            {unit ? <Badge label={unit} /> : null}
            {me.isCompanyAdmin ? <Badge label="Admin" className="bg-ink" textClassName="text-white" /> : null}
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <Text variant="heading">Personal information</Text>
        <div className="flex flex-row gap-3">
          <Input containerClassName="flex-1" label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <Input containerClassName="flex-1" label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <Input label="Email" value={me.email} disabled />
        <Button title="Save changes" size="sm" icon={<Save size={14} color={colors.white} />} onPress={saveName} />
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <Text variant="heading">Change password</Text>
        {pwError ? <Banner tone="error">{pwError}</Banner> : null}
        <Input label="Current password" value={cur} onChange={(e) => setCur(e.target.value)} secure icon={<Lock size={15} color={colors.mutedForeground} />} />
        <Input label="New password" value={next} onChange={(e) => setNext(e.target.value)} secure hint="Min 8 chars, 1 uppercase, 1 number, 1 special." icon={<Lock size={15} color={colors.mutedForeground} />} />
        <Input label="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} secure icon={<Lock size={15} color={colors.mutedForeground} />} />
        <Button title="Change password" size="sm" variant="outline" onPress={savePassword} disabled={!cur || !next || !confirm} />
      </Card>

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

      <KeyValueList>
        <KeyValueRow label="Organization" value={company?.name ?? "—"} />
        <KeyValueRow label="Plan" value={company?.subscriptionTier === "paid" ? "Paid" : "Free"} />
        <KeyValueRow label="Account created" value={shortDate(me.createdAt)} />
        <KeyValueRow label="Email verified" value={me.isEmailVerified ? "Verified" : "Not verified"} last />
      </KeyValueList>

      <Button title="Sign out" variant="outline" icon={<LogOut size={15} color={colors.ink} />} onPress={doLogout} fullWidth />
      <Button
        title="Reset demo data"
        variant="ghost"
        icon={<Trash2 size={15} color={colors.destructive} />}
        onPress={() => confirmAction("Reset demo data?", "This wipes local data and restores the seed. You'll be signed out.", doReset, "Reset", true)}
        fullWidth
      />
    </Screen>
  );
}
