import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { SidebarContent } from "../components/shell/Sidebar";
import { useCurrentUser, useUnreadCount } from "../lib/hooks";
import { useSession } from "../lib/session";
import { onboardingStatus } from "../lib/services/org";
import { ping } from "../lib/services/auth";
import { syncRealOrgData } from "../lib/services/orgSync";
import { updateTaskbarBadge } from "../lib/badge";

const SIDEBAR_W = 248;

export default function AppLayout() {
  const { ready, userId, real } = useSession();
  const me = useCurrentUser();
  const navigate = useNavigate();
  const unread = useUnreadCount();

  useEffect(() => {
    updateTaskbarBadge(unread);
  }, [unread]);

  useEffect(() => () => updateTaskbarBadge(0), []);

  useEffect(() => {
    if (!ready) return;
    if (!userId || !me) {
      navigate("/welcome", { replace: true });
      return;
    }
    if (!me.isEmailVerified) {
      navigate(`/verify?email=${encodeURIComponent(me.email)}`, { replace: true });
      return;
    }
    if (onboardingStatus(me.id).needsOnboarding) {
      navigate("/onboarding", { replace: true });
    }
  }, [ready, userId, me, navigate]);

  useEffect(() => {
    if (!userId) return;
    ping();
    const t = setInterval(() => ping(), 30_000);
    return () => clearInterval(t);
  }, [userId]);

  useEffect(() => {
    if (!real) return;
    syncRealOrgData();
    const t = setInterval(() => syncRealOrgData(), 60_000);
    return () => clearInterval(t);
  }, [real?.user.id]);

  if (!ready || !me) return <div className="h-screen w-screen bg-background" />;

  return (
    <div className="flex h-screen w-screen flex-row bg-background">
      <div style={{ width: SIDEBAR_W }} className="shrink-0 border-r border-hairline">
        <SidebarContent />
      </div>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
