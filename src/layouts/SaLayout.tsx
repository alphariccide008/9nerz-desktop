import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { SaSidebar } from "../components/shell/SaShell";
import { useSession } from "../lib/session";
import { getDB } from "../lib/db/store";

export default function SaLayout() {
  const { ready, superAdminId } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ready) return;
    const valid = superAdminId && getDB().superAdmins.some((s) => s.id === superAdminId);
    if (!valid) navigate("/sa/login", { replace: true });
  }, [ready, superAdminId, navigate]);

  if (!ready) return <div className="h-screen w-screen bg-background" />;

  return (
    <div className="flex h-screen w-screen flex-row bg-background">
      <div style={{ width: 224 }} className="shrink-0">
        <SaSidebar />
      </div>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
