import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AuthAside } from "./AuthAside";
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
    <div className="grid h-screen w-screen grid-cols-1 overflow-hidden bg-background lg:grid-cols-[1.05fr_1fr]">
      <AuthAside />

      <div className="relative flex flex-col overflow-y-auto bg-background">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-ink/[0.08] blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-teal/[0.08] blur-3xl" />
        </div>

        <div className="relative flex flex-1 flex-col items-center justify-center px-10 py-10">
          <div className="w-full max-w-[620px]">
            <button
              type="button"
              onClick={() => (onBack ? onBack() : navigate(-1))}
              className="mb-6 flex h-9 w-9 items-center justify-center rounded-lg border border-hairline bg-card"
            >
              <ArrowLeft size={16} color={colors.ink} />
            </button>

            <div className="rounded-2xl border border-hairline bg-card p-6 shadow-lg">
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

            <p className="mt-8 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} 9nerz</p>
          </div>
        </div>
      </div>
    </div>
  );
}
