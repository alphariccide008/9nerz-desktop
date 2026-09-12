import { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

type Variant = "display" | "title" | "heading" | "body" | "label" | "caption" | "mono";
type Tone = "default" | "muted" | "primary" | "teal" | "danger" | "inverse" | "amber";

const variantClass: Record<Variant, string> = {
  display: "font-display text-[26px] leading-8 text-ink",
  title: "font-display text-[20px] leading-7 text-ink",
  heading: "font-semibold text-[15px] leading-5 text-ink",
  body: "font-sans text-[14px] leading-5 text-ink",
  label: "font-medium text-[12px] leading-4 text-slate",
  caption: "font-sans text-[11px] leading-4 text-muted-foreground",
  mono: "font-sans text-[12px] leading-4 text-slate",
};

const toneClass: Record<Tone, string> = {
  default: "",
  muted: "text-muted-foreground",
  primary: "text-ink",
  teal: "text-teal",
  danger: "text-destructive",
  inverse: "text-white",
  amber: "text-amber",
};

export function Text({
  variant = "body",
  tone = "default",
  className,
  children,
  onPress,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: Variant; tone?: Tone; children?: ReactNode; onPress?: () => void }) {
  return (
    <span
      className={cn(variantClass[variant], toneClass[tone], className)}
      onClick={onPress}
      {...props}
    >
      {children}
    </span>
  );
}
