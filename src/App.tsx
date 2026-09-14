import { ReactNode, useEffect, useState } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { hydrate } from "./lib/db/store";
import { loadSession, useSession } from "./lib/session";
import { ToastProvider } from "./components/ui/Toast";
import { ChatWidget } from "./components/chat/ChatWidget";
import Splash from "./screens/Splash";

/** Mounted globally (works logged-out too, like the real site) — hidden only
 *  on the super-admin panel, mirroring the real web app's ChatWidget which
 *  checks `pathname.startsWith("/super-admin")`. */
function ChatWidgetGate() {
  const location = useLocation();
  if (location.pathname.startsWith("/sa")) return null;
  return <ChatWidget />;
}

/** Welcome/Login/Signup are for logged-out visitors only — a returning user
 *  with a valid session should land straight on their dashboard, not see the
 *  marketing page or sign-in form again on every launch (mirrors the real web
 *  app's middleware, which redirects logged-in users away from these same
 *  routes). */
function PublicOnly({ children }: { children: ReactNode }) {
  const { userId } = useSession();
  if (userId) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

import AppLayout from "./layouts/AppLayout";
import SaLayout from "./layouts/SaLayout";

import Welcome from "./screens/Welcome";
import Login from "./screens/auth/Login";
import Signup from "./screens/auth/Signup";
import Verify from "./screens/auth/Verify";
import ResetPassword from "./screens/auth/ResetPassword";
import AcceptInvite from "./screens/auth/AcceptInvite";
import Onboarding from "./screens/Onboarding";

import Dashboard from "./screens/Dashboard";
import TasksIndex from "./screens/tasks/TasksIndex";
import TaskDetail from "./screens/tasks/TaskDetail";
import TicketsIndex from "./screens/tickets/TicketsIndex";
import TicketDetail from "./screens/tickets/TicketDetail";
import SimulateInbound from "./screens/tickets/SimulateInbound";
import Notifications from "./screens/Notifications";
import Profile from "./screens/Profile";
import Billing from "./screens/Billing";

import Structure from "./screens/admin/Structure";
import Roles from "./screens/admin/Roles";
import People from "./screens/admin/People";
import Reporting from "./screens/admin/Reporting";
import Routing from "./screens/admin/Routing";
import AdminSettings from "./screens/admin/Settings";
import AdminAudit from "./screens/admin/Audit";

import SaLogin from "./screens/sa/Login";
import SaOverview from "./screens/sa/Overview";
import SaCompanies from "./screens/sa/Companies";
import SaCompanyDetail from "./screens/sa/CompanyDetail";
import SaUserDetail from "./screens/sa/UserDetail";
import SaPayments from "./screens/sa/Payments";
import SaAudit from "./screens/sa/Audit";
import SaActivity from "./screens/sa/Activity";
import SaChat from "./screens/sa/Chat";
import SaOperations from "./screens/sa/Operations";
import SaSupport from "./screens/sa/Support";

function RootRedirect() {
  const { userId } = useSession();
  return <Navigate to={userId ? "/dashboard" : "/welcome"} replace />;
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const minDelay = new Promise((resolve) => setTimeout(resolve, 4000));
    Promise.all([hydrate(), loadSession(), minDelay]).then(() => setReady(true));
  }, []);

  if (!ready) return <Splash />;

  return (
    <ToastProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/welcome" element={<PublicOnly><Welcome /></PublicOnly>} />
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route path="/onboarding" element={<Onboarding />} />

          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/tasks" element={<TasksIndex />} />
            <Route path="/tasks/:id" element={<TaskDetail />} />
            <Route path="/tickets" element={<TicketsIndex />} />
            <Route path="/tickets/simulate-inbound" element={<SimulateInbound />} />
            <Route path="/tickets/:id" element={<TicketDetail />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/admin/structure" element={<Structure />} />
            <Route path="/admin/roles" element={<Roles />} />
            <Route path="/admin/people" element={<People />} />
            <Route path="/admin/reporting" element={<Reporting />} />
            <Route path="/admin/routing" element={<Routing />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/audit" element={<AdminAudit />} />
          </Route>

          <Route path="/sa/login" element={<SaLogin />} />
          <Route element={<SaLayout />}>
            <Route path="/sa/overview" element={<SaOverview />} />
            <Route path="/sa/companies" element={<SaCompanies />} />
            <Route path="/sa/companies/:id" element={<SaCompanyDetail />} />
            <Route path="/sa/users/:id" element={<SaUserDetail />} />
            <Route path="/sa/payments" element={<SaPayments />} />
            <Route path="/sa/audit" element={<SaAudit />} />
            <Route path="/sa/activity" element={<SaActivity />} />
            <Route path="/sa/chat" element={<SaChat />} />
            <Route path="/sa/operations" element={<SaOperations />} />
            <Route path="/sa/support" element={<SaSupport />} />
          </Route>

          <Route path="*" element={<RootRedirect />} />
        </Routes>
        <ChatWidgetGate />
      </HashRouter>
    </ToastProvider>
  );
}
