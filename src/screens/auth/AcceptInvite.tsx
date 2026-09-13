import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Lock } from "lucide-react";

import { AuthScaffold } from "../../components/auth/AuthScaffold";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Text } from "../../components/ui/Text";
import { Banner } from "../../components/ui/Feedback";
import { previewInvite, startInviteAccept, confirmInviteAccept } from "../../lib/services/auth";
import { validatePassword } from "../../lib/util";
import { useToast } from "../../components/ui/Toast";
import { colors } from "../../lib/theme";

type Preview = Awaited<ReturnType<typeof previewInvite>>;

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const tokenParam = params.get("token") ?? "";
  const navigate = useNavigate();
  const toast = useToast();
  const [token, setToken] = useState(tokenParam);
  const [preview, setPreview] = useState<Preview>(null);
  const [checked, setChecked] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
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

  const submitStep1 = async () => {
    setError(null);
    const pw = validatePassword(password);
    if (!pw.valid) return setError(pw.message);
    setBusy(true);
    try {
      await startInviteAccept({ token, firstName, lastName, password });
      toast.show("Code sent to your email", "success");
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start accepting the invitation.");
    } finally {
      setBusy(false);
    }
  };

  const submitStep2 = async () => {
    setError(null);
    if (otp.trim().length !== 6) return setError("Enter the 6-digit code.");
    setBusy(true);
    try {
      await confirmInviteAccept({ token, otp });
      toast.show("Welcome aboard", "success");
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not confirm the invitation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthScaffold
      eyebrow="Join"
      title={preview?.company ? `Join ${preview.company}` : "Accept your invitation"}
      subtitle={step === 1 ? "Set a password to activate your account." : "Enter the code we emailed you to finish joining."}
      onBack={() => navigate("/welcome")}
    >
      {error ? <Banner tone="error">{error}</Banner> : null}
      {!tokenParam ? (
        <Input label="Invitation token" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste the token from your invite" />
      ) : null}

      {checked && !preview && token ? <Banner tone="warn">That invitation is invalid or already used.</Banner> : null}

      {preview && step === 1 ? (
        <>
          <Banner tone="info">
            <Text variant="caption">Invited as {preview.email}</Text>
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
            onKeyDown={(e) => e.key === "Enter" && submitStep1()}
          />
          <Button title="Continue" onPress={submitStep1} loading={busy} fullWidth />
        </>
      ) : null}

      {preview && step === 2 ? (
        <>
          <Banner tone="info">
            <Text variant="caption">We emailed a 6-digit code to {preview.email}.</Text>
          </Banner>
          <Input
            label="Verification code"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
            placeholder="123456"
            className="text-center text-[20px] tracking-[8px]"
            onKeyDown={(e) => e.key === "Enter" && submitStep2()}
          />
          <Button title="Join workspace" onPress={submitStep2} loading={busy} fullWidth disabled={otp.length !== 6} />
        </>
      ) : null}
    </AuthScaffold>
  );
}
