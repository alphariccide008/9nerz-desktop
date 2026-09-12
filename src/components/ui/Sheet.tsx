import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import { Text } from "./Text";
import { colors } from "../../lib/theme";

/** Centered modal dialog — desktop always uses the "wide" variant of the mobile bottom sheet. */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(18,23,42,0.45)" }}>
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className="relative flex max-h-[80vh] w-[440px] max-w-[92%] flex-col rounded-[18px] border bg-card"
        style={{ borderColor: colors.hairline }}
      >
        <div className="flex flex-row items-center justify-between px-4 pb-2 pt-4">
          <Text variant="heading">{title}</Text>
          <button type="button" onClick={onClose} className="p-1">
            <X size={18} color={colors.slate} />
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-4">{children}</div>
        {footer ? <div className="border-t p-4" style={{ borderColor: colors.hairline }}>{footer}</div> : null}
      </div>
    </div>
  );
}
