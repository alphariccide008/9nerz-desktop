import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";

import { AuthScaffold } from "../../components/auth/AuthScaffold";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Text } from "../../components/ui/Text";
import { Banner } from "../../components/ui/Feedback";
import { verifyEmail, resendVerification } from "../../lib/services/auth";
import { useToast } from "../../components/ui/Toast";
import { colors } from "../../lib/theme";

export default function Verify() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const email = (params.get("email") ?? "").toLowerCase();
  const toast = useToast();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await verifyEmail(email, code);
      toast.show("Email verified", "success");
      navigate("/onboarding", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      await resendVerification(email);
      setCooldown(30);
      toast.show("New code sent", "success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resend.");
    }
  };

  return (
    <AuthScaffold
      eyebrow="Verify"
      title="Check your inbox"
      subtitle={`We sent a 6-digit code to ${email || "your email"}. Enter it below to finish setting up.`}
      onBack={() => navigate("/welcome")}
    >
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Input
        label="Verification code"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
        placeholder="123456"
        className="text-center text-[20px] tracking-[8px]"
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      <Button title="Verify email" onPress={submit} loading={busy} fullWidth disabled={code.length !== 6} />
      <div className="flex flex-row items-center justify-center gap-1.5">
        <Button
          title={cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          variant="ghost"
          size="sm"
          disabled={cooldown > 0}
          onPress={resend}
          icon={<RefreshCw size={14} color={colors.ink} />}
        />
      </div>
    </AuthScaffold>
  );
}
