import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { LogoMark } from "../brand/Logo";
import { Text } from "../ui/Text";
import { colors } from "../../lib/theme";

export function AuthScaffold({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  onBack,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  onBack?: () => void;
}) {
  const navigate = useNavigate();
  return (
    <div className="flex h-screen w-screen flex-col overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-[440px] px-5 py-8">
        <button
          type="button"
          onClick={() => (onBack ? onBack() : navigate(-1))}
          className="mb-6 flex h-9 w-9 items-center justify-center rounded-lg border border-hairline bg-card"
        >
          <ArrowLeft size={16} color={colors.ink} />
        </button>

        <div className="mb-6 flex flex-row items-center gap-2.5">
          <LogoMark size={32} />
          <span className="font-display text-[20px] tracking-tight text-ink">9nerz</span>
        </div>

        <div className="rounded-2xl border border-hairline bg-card p-5">
          <Text variant="label" tone="teal" className="uppercase tracking-[1.5px]">
            {eyebrow}
          </Text>
          <Text variant="title" className="mt-1.5 block">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" className="mt-1.5 block leading-5">
              {subtitle}
            </Text>
          ) : null}
          <div className="mt-5 flex flex-col gap-4">{children}</div>
        </div>

        {footer ? <div className="mt-5 flex flex-col items-center gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}
