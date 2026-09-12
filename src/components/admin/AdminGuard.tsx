import { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { Screen } from "../ui/Screen";
import { EmptyState } from "../ui/Feedback";
import { useIsAdmin } from "../../lib/hooks";
import { colors } from "../../lib/theme";

/** Gates admin console screens — non-admins see a notice instead. */
export function AdminGuard({ children }: { children: ReactNode }) {
  const isAdmin = useIsAdmin();
  if (isAdmin) return <>{children}</>;
  return (
    <Screen>
      <EmptyState
        icon={<ShieldAlert size={22} color={colors.slate} />}
        title="Admins only"
        body="This part of the workspace is limited to company admins."
      />
    </Screen>
  );
}
