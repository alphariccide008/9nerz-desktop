import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Lock, Mail, User } from "lucide-react";

import { AuthScaffold } from "../../components/auth/AuthScaffold";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Text } from "../../components/ui/Text";
import { Banner } from "../../components/ui/Feedback";
import { signup } from "../../lib/services/auth";
import { validatePassword } from "../../lib/util";
import { colors } from "../../lib/theme";

export default function Signup() {
  const navigate = useNavigate();
  const [org, setOrg] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!org || !firstName || !lastName || !email || !password) return setError("Please fill out all fields.");
    const pw = validatePassword(password);
    if (!pw.valid) return setError(pw.message);
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    try {
      await signup({ organizationName: org, firstName, lastName, email, password });
      navigate(`/verify?email=${encodeURIComponent(email.trim().toLowerCase())}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Signup failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScaffold
      eyebrow="Get started"
      title="Create your organization"
      subtitle="You'll be the first admin. Add your structure and invite your team once you're in."
      onBack={() => navigate("/welcome")}
      footer={
        <div className="flex flex-row gap-1">
          <Text variant="caption">Already have an account?</Text>
          <button type="button" onClick={() => navigate("/login")}>
            <Text variant="caption" tone="teal">
              Sign in
            </Text>
          </button>
        </div>
      }
    >
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Input label="Organization name" value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Acme Inc." icon={<Building2 size={16} color={colors.mutedForeground} />} />
      <div className="flex flex-row gap-3">
        <Input containerClassName="flex-1" label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" icon={<User size={16} color={colors.mutedForeground} />} />
        <Input containerClassName="flex-1" label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
      </div>
      <Input
        label="Work email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        icon={<Mail size={16} color={colors.mutedForeground} />}
        hint="Consumer providers like Gmail or Yahoo aren't allowed."
      />
      <Input
        label="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Min 8 chars, 1 uppercase, 1 number, 1 special"
        secure
        icon={<Lock size={16} color={colors.mutedForeground} />}
      />
      <Input
        label="Confirm password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="Confirm your password"
        secure
        icon={<Lock size={16} color={colors.mutedForeground} />}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      <Button title="Create organization" onPress={submit} loading={busy} fullWidth />
    </AuthScaffold>
  );
}
