import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Clock, RefreshCw, ShieldCheck } from "lucide-react";

import { AuthScaffold } from "../../components/auth/AuthScaffold";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Text } from "../../components/ui/Text";
import { Banner } from "../../components/ui/Feedback";
import { verifyEmail, resendVerification } from "../../lib/services/auth";
import { colors } from "../../lib/theme";

const OTP_EXPIRY_SECONDS = 300;
const RESEND_COOLDOWN_SECONDS = 60;

export default function Verify() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const email = (params.get("email") ?? "").toLowerCase();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [expirySecondsLeft, setExpirySecondsLeft] = useState(OTP_EXPIRY_SECONDS);
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  useEffect(() => {
    if (expirySecondsLeft <= 0) return;
    const t = setInterval(() => setExpirySecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [expirySecondsLeft]);

  const formatSeconds = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };
  const isExpired = expirySecondsLeft === 0;

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await verifyEmail(email, code);
      navigate("/onboarding", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid or expired code. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!email || cooldown > 0) return;
    setError(null);
    setResendSuccess(false);
    try {
      await resendVerification(email);
      setCode("");
      setExpirySecondsLeft(OTP_EXPIRY_SECONDS);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 6000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to resend code. Please try again.");
    }
  };

  return (
    <AuthScaffold
      eyebrow="Verify"
      title="Verify your email"
      subtitle=""
      shadow="sm"
    >
      <div className="-mt-1 flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink/10">
          <ShieldCheck size={22} color={colors.ink} />
        </div>
        <Text variant="caption" className="leading-5">
          Enter the 6-digit code sent to <span className="font-medium text-ink">{email || "your email"}</span>
        </Text>
      </div>

      <div className={`flex items-center justify-center gap-1.5 text-xs ${isExpired ? "text-destructive" : "text-muted-foreground"}`}>
        <Clock size={13} />
        {isExpired ? (
          <span className="font-medium">Code expired. Please request a new one.</span>
        ) : (
          <span>
            Code expires in <span className="font-medium tabular-nums">{formatSeconds(expirySecondsLeft)}</span>
          </span>
        )}
      </div>

      {error ? <Banner tone="error">{error}</Banner> : null}
      {resendSuccess ? <Banner tone="success">A new verification code has been sent to your email.</Banner> : null}

      <Input
        label="Verification code"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
        placeholder="123456"
        className="text-center text-[20px] tracking-[8px]"
        onKeyDown={(e) => e.key === "Enter" && submit()}
        disabled={isExpired}
      />
      <Button title={busy ? "Verifying..." : "Verify email"} onPress={submit} loading={busy} fullWidth disabled={code.length !== 6 || isExpired} />
      <div className="flex flex-row items-center justify-center gap-1.5">
        {cooldown > 0 ? (
          <Text variant="caption">
            Resend available in <span className="font-medium tabular-nums">{cooldown}s</span>
          </Text>
        ) : (
          <Button title="Resend code" variant="ghost" size="sm" onPress={resend} icon={<RefreshCw size={14} color={colors.ink} />} />
        )}
      </div>

      <p className="mt-1 text-center text-xs text-muted-foreground">
        Your workspace is created only after this code is verified. Nothing is saved until then.
      </p>
    </AuthScaffold>
  );
}
