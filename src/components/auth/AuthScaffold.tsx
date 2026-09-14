import { ReactNode } from "react";
import { Text } from "../ui/Text";
import { AuthAside } from "./AuthAside";

/** Ported from the real web app's app/(auth)/layout.tsx + components/auth/auth-form.tsx —
 *  a two-column aside+card layout, no back-arrow affordance (the real app relies on the
 *  aside's logo link and each screen's own footer links for navigation). */
export function AuthScaffold({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  backLink,
  shadow = "lg",
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  backLink?: ReactNode;
  shadow?: "sm" | "lg";
}) {
  return (
    <div className="grid h-screen w-screen grid-cols-1 overflow-hidden bg-background lg:grid-cols-[1.05fr_1fr]">
      <AuthAside />

      <div className="relative flex flex-col overflow-y-auto bg-background">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-ink/[0.08] blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-teal/[0.08] blur-3xl" />
        </div>

        <div className="relative flex flex-1 flex-col items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-md">
            {backLink ? <div className="mb-4">{backLink}</div> : null}

            <div className={cardShadowClass(shadow) + " rounded-xl border border-hairline bg-card p-6"}>
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-teal">{eyebrow}</span>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink">{title}</h2>
              {subtitle ? (
                <Text variant="caption" className="mt-1.5 block leading-5">
                  {subtitle}
                </Text>
              ) : null}
              <div className="mt-5 flex flex-col gap-4">{children}</div>
            </div>

            {footer ? <div className="mt-5 flex flex-col items-center gap-2">{footer}</div> : null}

            <p className="mt-8 text-center text-xs text-muted-foreground">
              © {new Date().getFullYear()} 9nerz
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function cardShadowClass(shadow: "sm" | "lg") {
  return shadow === "lg" ? "shadow-lg" : "shadow-sm";
}
