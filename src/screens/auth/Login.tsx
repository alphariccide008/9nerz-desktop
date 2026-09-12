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
import { cn } from "../../lib/cn";

const DEMO_PASSWORD = "Password1!";
const DEMO_ACCOUNTS = [
  { label: "Admin", email: "ada@acme.test" },
  { label: "Head of Business", email: "bode@acme.test" },
  { label: "Manager", email: "chidi@acme.test" },
  { label: "Senior Associate", email: "dara@acme.test" },
  { label: "Associate", email: "hauwa@acme.test" },
];

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const useDemo = (demoEmail: string) => {
    setError(null);
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
  };

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

      <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-muted/40 p-3">
        <Text variant="label" className="uppercase tracking-[1px]">
          Try a demo account
        </Text>
        <div className="flex flex-row flex-wrap gap-2">
          {DEMO_ACCOUNTS.map((d) => {
            const active = email === d.email;
            return (
              <button
                key={d.email}
                type="button"
                onClick={() => useDemo(d.email)}
                className={cn("rounded-full border px-3 py-1.5", active ? "border-teal bg-teal/10" : "border-hairline bg-card")}
              >
                <Text variant="caption" tone={active ? "teal" : "default"}>
                  {d.label}
                </Text>
              </button>
            );
          })}
        </div>
        <Text variant="caption" className="text-muted-foreground">
          Fills the form — every demo account uses the password <span className="font-semibold">{DEMO_PASSWORD}</span>.
        </Text>
      </div>
    </AuthScaffold>
  );
}
