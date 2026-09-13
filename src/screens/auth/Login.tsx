import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Mail } from "lucide-react";

import { AuthScaffold } from "../../components/auth/AuthScaffold";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Text } from "../../components/ui/Text";
import { Banner } from "../../components/ui/Feedback";
import { login } from "../../lib/services/auth";
import { colors } from "../../lib/theme";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await login(email, password);
      if (res.needsVerification) navigate(`/verify?email=${encodeURIComponent(email.trim().toLowerCase())}`, { replace: true });
      else navigate("/dashboard", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScaffold
      eyebrow="Sign in"
      title="Welcome back"
      subtitle="Enter your details to pick up where your team left off."
      onBack={() => navigate("/welcome")}
      footer={
        <>
          <button type="button" onClick={() => navigate("/reset-password")}>
            <Text variant="caption" tone="teal">
              Forgot password?
            </Text>
          </button>
          <div className="flex flex-row gap-1">
            <Text variant="caption">New here?</Text>
            <button type="button" onClick={() => navigate("/signup")}>
              <Text variant="caption" tone="teal">
                Create an organization
              </Text>
            </button>
          </div>
        </>
      }
    >
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Input
        label="Work email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        icon={<Mail size={16} color={colors.mutedForeground} />}
      />
      <Input
        label="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Your password"
        secure
        icon={<Lock size={16} color={colors.mutedForeground} />}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      <Button title="Sign in" onPress={submit} loading={busy} fullWidth />
    </AuthScaffold>
  );
}
