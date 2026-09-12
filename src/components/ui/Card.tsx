import { ButtonHTMLAttributes, HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border border-hairline bg-card", className)} {...props} />;
}

export function PressableCard({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn("rounded-xl border border-hairline bg-card text-left hover:bg-muted/60 transition-colors", className)}
      {...props}
    />
  );
}

export function CardRow({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-row items-center gap-3 px-4 py-3", className)} {...props} />;
}
