import { forwardRef, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Text } from "./Text";
import { cn } from "../../lib/cn";
import { colors } from "../../lib/theme";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string | null;
  hint?: string;
  icon?: ReactNode;
  secure?: boolean;
  containerClassName?: string;
};

export const Input = forwardRef<HTMLInputElement, FieldProps>(function Input(
  { label, error, hint, icon, secure, containerClassName, className, type, ...props },
  ref,
) {
  const [hidden, setHidden] = useState(!!secure);
  return (
    <div className={cn("flex flex-col gap-1.5", containerClassName)}>
      {label ? <Text variant="label">{label}</Text> : null}
      <div
        className={cn(
          "flex flex-row items-center rounded-xl border bg-card px-3",
          error ? "border-destructive" : "border-hairline",
        )}
      >
        {icon ? <div className="mr-2">{icon}</div> : null}
        <input
          ref={ref}
          type={secure ? (hidden ? "password" : "text") : type ?? "text"}
          className={cn(
            "flex-1 py-2.5 text-[14px] text-ink bg-transparent outline-none placeholder:text-muted-foreground",
            className,
          )}
          {...props}
        />
        {secure ? (
          <button type="button" onClick={() => setHidden((h) => !h)} className="ml-2 shrink-0">
            {hidden ? <EyeOff size={16} color={colors.mutedForeground} /> : <Eye size={16} color={colors.mutedForeground} />}
          </button>
        ) : null}
      </div>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption">{hint}</Text>
      ) : null}
    </div>
  );
});

export function Textarea({
  label,
  error,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string | null }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label ? <Text variant="label">{label}</Text> : null}
      <textarea
        className={cn(
          "min-h-[88px] rounded-xl border bg-card px-3 py-2.5 text-[14px] text-ink outline-none placeholder:text-muted-foreground",
          error ? "border-destructive" : "border-hairline",
          className,
        )}
        {...props}
      />
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}
    </div>
  );
}
