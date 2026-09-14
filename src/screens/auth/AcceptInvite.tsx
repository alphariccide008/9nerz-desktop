import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Lock, Mail, RefreshCw, ShieldCheck } from "lucide-react";

import { AuthScaffold } from "../../components/auth/AuthScaffold";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Text } from "../../components/ui/Text";
import { Banner } from "../../components/ui/Feedback";
import { previewInvite, startInviteAccept, confirmInviteAccept } from "../../lib/services/auth";
import { validatePassword } from "../../lib/util";
import { colors } from "../../lib/theme";

type Preview = Awaited<ReturnType<typeof previewInvite>>;
const RESEND_COOLDOWN = 45;

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const tokenParam = params.get("token") ?? "";
  const navigate = useNavigate();
  const [token, setToken] = useState(tokenParam);
  const [preview, setPreview] = useState<Preview>(null);
  const [checked, setChecked] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwInvalid, setPwInvalid] = useState(false);
  const [otp, setOtp] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setChecked(false);
    if (!token) {
      setPreview(null);
      setChecked(true);
      return;
    }
    let cancelled = false;
    previewInvite(token).then((p) => {
      if (cancelled) return;
      setPreview(p);
      setChecked(true);
      if (p) {
        setFirstName(p.firstName || "");
        setLastName(p.lastName || "");
        if (p.passwordSet) setStep(2);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const sendCode = async (opts?: { silent?: boolean }) => {
    setError(null);
    setBusy(true);
    try {
      await startInviteAccept({ token, firstName, lastName, password });
      setStep(2);
      setCooldown(RESEND_COOLDOWN);
      if (opts?.silent) {
        setResent(true);
        setTimeout(() => setResent(false), 6000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start accepting the invitation.");
    } finally {
      setBusy(false);
    }
  };

  const submitStep1 = async () => {
    setError(null);
    const pw = validatePassword(password);
    if (!pw.valid) {
      setPwInvalid(true);
      return setError(pw.message);
    }
    if (password !== confirm) {
      setPwInvalid(true);
      return setError("Passwords do not match.");
    }
    setPwInvalid(false);
    await sendCode();
  };

  const submitStep2 = async () => {
    setError(null);
    if (otp.trim().length !== 6) return setError("Enter the 6-digit code.");
    setBusy(true);
    try {
      await confirmInviteAccept({ token, otp });
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "That code is not correct");
      setBusy(false);
    }
  };

  return (
    <AuthScaffold
      eyebrow="Join the team"
      title={preview?.company ? `Join ${preview.company}` : "Accept your invitation"}
      subtitle={
        step === 1
          ? "Set the password you'll sign in with, then we'll verify your email."
          : `Enter the 6-digit code we sent to ${preview?.email ?? "your email"}.`
      }
      shadow="sm"
    >
      {!tokenParam ? (
        <Input label="Invitation token" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste the token from your invite" />
      ) : null}

      {checked && !preview && token ? <Banner tone="warn">That invitation is invalid or already used.</Banner> : null}

      {preview ? (
        <div className="flex items-center gap-2 rounded-lg border border-hairline bg-muted px-3 py-2 text-sm">
          <Mail size={16} className="shrink-0 text-muted-foreground" />
          <span className="truncate font-medium text-ink">{preview.email}</span>
          {preview.role ? <span className="ml-auto shrink-0 text-xs text-muted-foreground">{preview.role}</span> : null}
        </div>
      ) : null}

      {error ? <Banner tone="error">{error}</Banner> : null}

      {preview && step === 1 ? (
        <>
          <div className="flex flex-row gap-3">
            <Input containerClassName="flex-1" label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" />
            <Input containerClassName="flex-1" label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
          </div>
          <Input
            label="Password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPwInvalid(false);
            }}
            placeholder="Password (min 8 characters)"
            secure
            className={pwInvalid ? "border-destructive" : undefined}
            icon={<Lock size={16} color={colors.mutedForeground} />}
          />
          <Input
            label="Confirm password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              setPwInvalid(false);
            }}
            placeholder="Confirm password"
            secure
            icon={<Lock size={16} color={colors.mutedForeground} />}
            onKeyDown={(e) => e.key === "Enter" && submitStep1()}
          />
          <Button title="Continue" onPress={submitStep1} loading={busy} disabled={password.length < 8} fullWidth />
        </>
      ) : null}

      {preview && step === 2 ? (
        <>
          <div className="flex flex-row items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck size={13} /> Code expires 5 minutes after it's sent
          </div>
          <Input
            label="Verification code"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
            placeholder="123456"
            className="text-center text-[20px] tracking-[8px]"
            onKeyDown={(e) => e.key === "Enter" && submitStep2()}
          />
          {resent ? <Banner tone="success">A new code is on its way.</Banner> : null}
          <Button title="Verify & join" onPress={submitStep2} loading={busy} fullWidth disabled={otp.length !== 6} />
          <div className="flex flex-row items-center justify-center gap-1.5">
            {cooldown > 0 ? (
              <Text variant="caption">Resend available in {cooldown}s</Text>
            ) : (
              <Button
                title="Resend code"
                variant="ghost"
                size="sm"
                onPress={() => sendCode({ silent: true })}
                icon={<RefreshCw size={14} color={colors.teal} />}
              />
            )}
          </div>
        </>
      ) : null}
    </AuthScaffold>
  );
}
