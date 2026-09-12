import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Mail } from "lucide-react";

import { AuthScaffold } from "../../components/auth/AuthScaffold";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Text } from "../../components/ui/Text";
import { Banner } from "../../components/ui/Feedback";
import { saLogin } from "../../lib/services/superAdmin";
import { colors } from "../../lib/theme";

export default function SaLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await saLogin(email, password);
      navigate("/sa/overview", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScaffold eyebrow="Control plane" title="Platform owner sign in" subtitle="This realm is separate from company accounts." onBack={() => navigate("/welcome")}>
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} icon={<Mail size={16} color={colors.mutedForeground} />} />
      <Input label="Password" value={password} onChange={(e) => setPassword(e.target.value)} secure icon={<Lock size={16} color={colors.mutedForeground} />} onKeyDown={(e) => e.key === "Enter" && submit()} />
      <Button title="Sign in" onPress={submit} loading={busy} fullWidth />
      <button
        type="button"
        onClick={() => {
          setError(null);
          setEmail("owner@9nerz.app");
          setPassword("Password1!");
        }}
        className="flex w-full items-center justify-center rounded-xl border border-hairline bg-muted/40 py-2.5"
      >
        <Text variant="caption" tone="teal">
          Use demo owner — owner@9nerz.app / Password1!
        </Text>
      </button>
    </AuthScaffold>
  );
}
