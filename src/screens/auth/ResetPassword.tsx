import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, KeyRound, Lock, Mail } from "lucide-react";

import { AuthScaffold } from "../../components/auth/AuthScaffold";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Banner } from "../../components/ui/Feedback";
import { requestPasswordReset, resetPassword } from "../../lib/services/auth";
import { validatePassword } from "../../lib/util";
import { colors } from "../../lib/theme";

type Step = "email" | "otp" | "newPassword";

const TITLES: Record<Step, string> = {
  email: "Reset password",
  otp: "Verify your identity",
  newPassword: "Set new password",
};

export default function ResetPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const subtitle =
    step === "email"
      ? "Enter your email to receive a verification code."
      : step === "otp"
        ? `Enter the 6-digit code sent to ${email}`
        : "Create a strong new password.";

  const sendCode = async () => {
    setError(null);
    setBusy(true);
    try {
      await requestPasswordReset(email.trim().toLowerCase());
      setSuccessMsg("Verification code sent to your email.");
      setStep("otp");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send reset code.");
    } finally {
      setBusy(false);
    }
  };

  const submitOtp = () => {
    setError(null);
    if (code.length < 6) return setError("Please enter the full 6-digit code.");
    setStep("newPassword");
  };

  const finish = async () => {
    setError(null);
    const pw = validatePassword(password);
    if (!pw.valid) return setError(pw.message);
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    try {
      await resetPassword(email.trim().toLowerCase(), code, password);
      navigate("/login", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reset password. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScaffold
      eyebrow="Reset"
      title={TITLES[step]}
      subtitle={subtitle}
      shadow="sm"
      backLink={
        <button type="button" onClick={() => navigate("/login")} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-ink">
          <ArrowLeft size={15} />
          Back to login
        </button>
      }
    >
      <div className="-mt-1 mb-1 flex justify-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ink/10">
          <KeyRound size={22} color={colors.ink} />
        </div>
      </div>

      {step === "email" ? (
        <>
          <Input
            label="Company email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            icon={<Mail size={16} color={colors.mutedForeground} />}
            onKeyDown={(e) => e.key === "Enter" && sendCode()}
          />
          {error ? <Banner tone="error">{error}</Banner> : null}
          <Button title={busy ? "Sending..." : "Send verification code"} onPress={sendCode} loading={busy} fullWidth />
        </>
      ) : step === "otp" ? (
        <>
          {successMsg ? <Banner tone="success">{successMsg}</Banner> : null}
          <Input
            label="Verification code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
            placeholder="123456"
            className="text-center text-[18px] tracking-[6px]"
            onKeyDown={(e) => e.key === "Enter" && submitOtp()}
          />
          {error ? <Banner tone="error">{error}</Banner> : null}
          <Button title="Verify code" onPress={submitOtp} fullWidth disabled={code.length < 6} />
        </>
      ) : (
        <>
          <Input label="New password" value={password} onChange={(e) => setPassword(e.target.value)} secure placeholder="Min 8 chars, 1 uppercase, 1 number, 1 special" icon={<Lock size={16} color={colors.mutedForeground} />} />
          <Input
            label="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            secure
            placeholder="Confirm your new password"
            icon={<Lock size={16} color={colors.mutedForeground} />}
            onKeyDown={(e) => e.key === "Enter" && finish()}
          />
          {error ? <Banner tone="error">{error}</Banner> : null}
          <Button title={busy ? "Resetting..." : "Reset password"} onPress={finish} loading={busy} fullWidth />
        </>
      )}
    </AuthScaffold>
  );
}
