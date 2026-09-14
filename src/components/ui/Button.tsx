import { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Text } from "./Text";
import { cn } from "../../lib/cn";

type Variant = "primary" | "amber" | "outline" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

// `self-start` stops a button from silently stretching to fill its container's
// width — the common `<Card className="flex flex-col gap-3">` pattern used all
// over the app defaults to `align-items: stretch`, which otherwise forces every
// direct-child button to full width even though it's `inline-flex` internally.
// `fullWidth` still works: an explicit `w-full` overrides self-alignment sizing.
const base =
  "inline-flex flex-row items-center justify-center self-start rounded-md transition-all duration-200 ease-out cursor-pointer disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100";
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 gap-1.5",
  md: "h-9 px-4 gap-2",
  lg: "h-10 px-5 gap-2",
};
const variants: Record<Variant, string> = {
  primary: "bg-ink shadow-sm hover:bg-ink/90 hover:shadow-md",
  amber: "bg-amber shadow-sm hover:brightness-105 hover:shadow-md",
  outline: "border border-hairline bg-card shadow-sm hover:bg-muted hover:shadow-md",
  ghost: "bg-transparent hover:bg-muted",
  destructive: "bg-destructive shadow-sm hover:bg-destructive/90 hover:shadow-md",
};
const labelTone: Record<Variant, "inverse" | "primary"> = {
  primary: "inverse",
  amber: "primary",
  outline: "primary",
  ghost: "primary",
  destructive: "inverse",
};

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  icon,
  fullWidth,
  className,
  ...props
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "children">) {
  const isDisabled = disabled || loading;
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={isDisabled}
      className={cn(base, sizes[size], variants[variant], fullWidth && "w-full", isDisabled && "opacity-40", className)}
      {...props}
    >
      {loading ? (
        <Loader2 size={16} className={cn("animate-spin", variant === "primary" || variant === "destructive" ? "text-white" : "text-ink")} />
      ) : (
        <>
          {icon}
          <Text variant="heading" tone={labelTone[variant]} className={size === "sm" ? "text-[13px]" : undefined}>
            {title}
          </Text>
        </>
      )}
    </button>
  );
}
