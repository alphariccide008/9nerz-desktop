import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Mail } from "lucide-react";

import { AuthScaffold } from "../../components/auth/AuthScaffold";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Text } from "../../components/ui/Text";
import { Banner } from "../../components/ui/Feedback";
import { requestPasswordReset, resetPassword } from "../../lib/services/auth";
import { validatePassword } from "../../lib/util";
import { useToast } from "../../components/ui/Toast";
import { colors } from "../../lib/theme";

export default function ResetPassword() {
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sendCode = () => {
    setError(null);
    if (!email.trim()) return setError("Enter your email.");
    const { devCode } = requestPasswordReset(email);
    setDevCode(devCode || null);
    setStep(2);
    toast.show("If that email exists, a code is on its way", "info");
  };

  const finish = async () => {
    setError(null);
    if (!code) return setError("Enter the code.");
    const pw = validatePassword(password);
    if (!pw.valid) return setError(pw.message);
    if (password !== confirm) return setError("Passwords do not match.");
    setBusy(true);
    try {
      await resetPassword(email, code, password);
      toast.show("Password changed — sign in", "success");
      navigate("/login", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScaffold
      eyebrow="Reset"
      title={step === 1 ? "Forgot your password?" : "Set a new password"}
      subtitle={step === 1 ? "Enter your email and we'll send a reset code." : `Enter the code sent to ${email} and choose a new password.`}
      onBack={() => navigate("/login")}
      footer={
        <button type="button" onClick={() => navigate("/login")}>
          <Text variant="caption" tone="teal">
            Back to sign in
          </Text>
        </button>
      }
    >
      {error ? <Banner tone="error">{error}</Banner> : null}
      {step === 1 ? (
        <>
          <Input
            label="Work email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            icon={<Mail size={16} color={colors.mutedForeground} />}
            onKeyDown={(e) => e.key === "Enter" && sendCode()}
          />
          <Button title="Send reset code" onPress={sendCode} fullWidth />
        </>
      ) : (
        <>
          {devCode ? (
            <Banner tone="info">
              <Text variant="caption">
                Dev mode — your reset code is <span className="font-bold text-ink">{devCode}</span>.
              </Text>
            </Banner>
          ) : null}
          <Input
            label="Reset code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
            placeholder="123456"
            className="text-center text-[18px] tracking-[6px]"
          />
          <Input label="New password" value={password} onChange={(e) => setPassword(e.target.value)} secure icon={<Lock size={16} color={colors.mutedForeground} />} />
          <Input
            label="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            secure
            icon={<Lock size={16} color={colors.mutedForeground} />}
            onKeyDown={(e) => e.key === "Enter" && finish()}
          />
          <Button title="Change password" onPress={finish} loading={busy} fullWidth />
        </>
      )}
    </AuthScaffold>
  );
}
