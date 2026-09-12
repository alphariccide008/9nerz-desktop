import { useEffect, useState } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";

import { hydrate } from "./lib/db/store";
import { loadSession } from "./lib/session";
import { ToastProvider } from "./components/ui/Toast";
import Splash from "./screens/Splash";

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
import NewTask from "./screens/tasks/NewTask";
import TicketsIndex from "./screens/tickets/TicketsIndex";
import TicketDetail from "./screens/tickets/TicketDetail";
import SimulateInbound from "./screens/tickets/SimulateInbound";
import Notifications from "./screens/Notifications";
import Profile from "./screens/Profile";
import Approvals from "./screens/Approvals";
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
import SaSubscriptions from "./screens/sa/Subscriptions";
import SaAudit from "./screens/sa/Audit";
import SaActivity from "./screens/sa/Activity";
import SaChat from "./screens/sa/Chat";
import SaOperations from "./screens/sa/Operations";
import SaSupport from "./screens/sa/Support";

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const minDelay = new Promise((resolve) => setTimeout(resolve, 6000));
    Promise.all([hydrate(), loadSession(), minDelay]).then(() => setReady(true));
  }, []);

  if (!ready) return <Splash />;

  return (
    <ToastProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/welcome" replace />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route path="/onboarding" element={<Onboarding />} />

          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/tasks" element={<TasksIndex />} />
            <Route path="/tasks/new" element={<NewTask />} />
            <Route path="/tasks/:id" element={<TaskDetail />} />
            <Route path="/tickets" element={<TicketsIndex />} />
            <Route path="/tickets/simulate-inbound" element={<SimulateInbound />} />
            <Route path="/tickets/:id" element={<TicketDetail />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/approvals" element={<Approvals />} />
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
            <Route path="/sa/subscriptions" element={<SaSubscriptions />} />
            <Route path="/sa/audit" element={<SaAudit />} />
            <Route path="/sa/activity" element={<SaActivity />} />
            <Route path="/sa/chat" element={<SaChat />} />
            <Route path="/sa/operations" element={<SaOperations />} />
            <Route path="/sa/support" element={<SaSupport />} />
          </Route>

          <Route path="*" element={<Navigate to="/welcome" replace />} />
        </Routes>
      </HashRouter>
    </ToastProvider>
  );
}
