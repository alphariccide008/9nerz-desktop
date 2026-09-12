import { createContext, ReactNode, useCallback, useContext, useState } from "react";
import { CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { Text } from "./Text";
import { colors } from "../../lib/theme";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; kind: ToastKind; message: string };

const ToastCtx = createContext<{ show: (message: string, kind?: ToastKind) => void }>({ show: () => {} });

export function useToast() {
  return useContext(ToastCtx);
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, kind: ToastKind = "info") => {
    const id = nextId++;
    setItems((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);

  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed left-0 right-0 top-4 z-[100] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <ToastCard key={t.id} item={t} />
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

function ToastCard({ item }: { item: ToastItem }) {
  const Icon = item.kind === "success" ? CheckCircle2 : item.kind === "error" ? TriangleAlert : Info;
  const color = item.kind === "success" ? colors.teal : item.kind === "error" ? colors.destructive : colors.ink;
  return (
    <div className="w-full max-w-[520px] animate-[toast-in_0.2s_ease-out]">
      <div className="flex flex-row items-center gap-2.5 rounded-xl border border-hairline bg-card px-3.5 py-3 shadow-lg">
        <Icon size={18} color={color} />
        <Text variant="body" className="flex-1 text-[13px]">
          {item.message}
        </Text>
      </div>
    </div>
  );
}
