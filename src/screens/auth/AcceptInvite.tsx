import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Lock } from "lucide-react";

import { AuthScaffold } from "../../components/auth/AuthScaffold";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Text } from "../../components/ui/Text";
import { Banner } from "../../components/ui/Feedback";
import { inviteByToken, acceptInvite } from "../../lib/services/auth";
import { validatePassword } from "../../lib/util";
import { useToast } from "../../components/ui/Toast";
import { getDB } from "../../lib/db/store";
import { colors } from "../../lib/theme";

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const tokenParam = params.get("token") ?? "";
  const navigate = useNavigate();
  const toast = useToast();
  const [token, setToken] = useState(tokenParam);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const found = token ? inviteByToken(token) : null;

  useEffect(() => {
    if (found?.user) {
      setFirstName(found.user.firstName === "Invited" ? "" : found.user.firstName);
      setLastName(found.user.lastName === "User" ? "" : found.user.lastName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const submit = async () => {
    setError(null);
    const pw = validatePassword(password);
    if (!pw.valid) return setError(pw.message);
    setBusy(true);
    try {
      await acceptInvite({ token, firstName, lastName, password });
      toast.show("Welcome aboard", "success");
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not accept the invitation.");
    } finally {
      setBusy(false);
    }
  };

  const pendingTokens = getDB().devInvites;

  return (
    <AuthScaffold
      eyebrow="Join"
      title={found?.company ? `Join ${found.company.name}` : "Accept your invitation"}
      subtitle="Set a password to activate your account and land in the workspace."
      onBack={() => navigate("/welcome")}
    >
      {error ? <Banner tone="error">{error}</Banner> : null}
      {!tokenParam ? (
        <Input label="Invitation token" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste the token from your invite" />
      ) : null}

      {!found && token ? <Banner tone="warn">That invitation is invalid or already used.</Banner> : null}

      {found ? (
        <>
          <Banner tone="info">
            <Text variant="caption">Invited as {found.user.email}</Text>
          </Banner>
          <div className="flex flex-row gap-3">
            <Input containerClassName="flex-1" label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" />
            <Input containerClassName="flex-1" label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
          </div>
          <Input
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            secure
            icon={<Lock size={16} color={colors.mutedForeground} />}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <Button title="Join workspace" onPress={submit} loading={busy} fullWidth />
        </>
      ) : null}

      {!tokenParam && pendingTokens.length > 0 ? (
        <Banner tone="info">
          <Text variant="caption">Dev mode — pending invite tokens: {pendingTokens.map((i) => `${i.email} → ${i.token}`).join(", ")}</Text>
        </Banner>
      ) : null}
    </AuthScaffold>
  );
}
