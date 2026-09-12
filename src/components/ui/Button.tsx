import { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Text } from "./Text";
import { cn } from "../../lib/cn";

type Variant = "primary" | "amber" | "outline" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

const base = "inline-flex flex-row items-center justify-center rounded-xl transition-opacity cursor-pointer disabled:cursor-not-allowed";
const sizes: Record<Size, string> = {
  sm: "h-9 px-3 gap-1.5",
  md: "h-11 px-4 gap-2",
  lg: "h-12 px-5 gap-2",
};
const variants: Record<Variant, string> = {
  primary: "bg-ink hover:opacity-90",
  amber: "bg-amber hover:opacity-90",
  outline: "border border-hairline bg-card hover:bg-muted",
  ghost: "bg-transparent hover:bg-muted",
  destructive: "bg-destructive hover:opacity-90",
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
