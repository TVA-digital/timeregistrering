import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/employee/DashboardPage';
import { TimeEntriesPage } from './pages/employee/TimeEntriesPage';
import { RequestAbsencePage } from './pages/employee/RequestAbsencePage';
import { MyAbsencesPage } from './pages/employee/MyAbsencesPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { HelpPage } from './pages/HelpPage';
import { LeaderDashboardPage } from './pages/leader/LeaderDashboardPage';
import { ApproveTimeEntriesPage } from './pages/leader/ApproveTimeEntriesPage';
import { ApproveAbsencesPage } from './pages/leader/ApproveAbsencesPage';
import { EmployeeTimelinePage } from './pages/leader/EmployeeTimelinePage';
import { UserManagementPage } from './pages/admin/UserManagementPage';
import { DepartmentsPage } from './pages/admin/DepartmentsPage';
import { WorkSchedulesPage } from './pages/admin/WorkSchedulesPage';
import { AbsenceCodesPage } from './pages/admin/AbsenceCodesPage';
import { PayrollExportPage } from './pages/payroll/PayrollExportPage';
import { GroupsPage } from './pages/admin/GroupsPage';
import { AmlRulesPage } from './pages/admin/AmlRulesPage';
import { Role } from '@timeregistrering/shared';

function AuthGuard() {
  const { session, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!session) return <Navigate to="/logg-inn" replace />;
  return <Outlet />;
}

function RequireRole({ roles }: { roles: Role[] }) {
  const { activeRole } = useAuth();
  if (!activeRole || !roles.includes(activeRole)) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-4xl font-bold text-gray-300 mb-2">403</p>
          <p className="text-gray-600">Du har ikke tilgang til denne siden.</p>
        </div>
      </div>
    );
  }
  return <Outlet />;
}

function FullPageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/logg-inn" element={<LoginPage />} />

      <Route element={<AuthGuard />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="timeliste" element={<TimeEntriesPage />} />
          <Route path="fravar" element={<MyAbsencesPage />} />
          <Route path="fravar/nytt" element={<RequestAbsencePage />} />
          <Route path="varsler" element={<NotificationsPage />} />
          <Route path="hjelp" element={<HelpPage />} />

          <Route element={<RequireRole roles={['leder', 'admin', 'fagleder']} />}>
            <Route path="leder" element={<LeaderDashboardPage />} />
            <Route path="leder/ansatt/:userId" element={<EmployeeTimelinePage />} />
          </Route>

          <Route element={<RequireRole roles={['leder', 'admin']} />}>
            <Route path="leder/godkjenn-timer" element={<ApproveTimeEntriesPage />} />
            <Route path="leder/godkjenn-fravar" element={<ApproveAbsencesPage />} />
          </Route>

          <Route element={<RequireRole roles={['admin']} />}>
            <Route path="admin/brukere" element={<UserManagementPage />} />
            <Route path="admin/avdelinger" element={<DepartmentsPage />} />
            <Route path="admin/grupper" element={<GroupsPage />} />
            <Route path="admin/arbeidsplaner" element={<WorkSchedulesPage />} />
            <Route path="admin/fravaerskoder" element={<AbsenceCodesPage />} />
            <Route path="admin/aml-regler" element={<AmlRulesPage />} />
          </Route>

          <Route element={<RequireRole roles={['lonningsansvarlig', 'admin']} />}>
            <Route path="lonning/eksport" element={<PayrollExportPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
