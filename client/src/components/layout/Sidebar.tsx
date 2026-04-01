import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Role } from '@timeregistrering/shared';

import {
  HomeIcon,
  ClockIcon,
  DocumentCheckIcon,
  CalendarDaysIcon,
  BellIcon,
  UserGroupIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  BuildingOfficeIcon,
  ArrowRightStartOnRectangleIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';

const roleLabels: Record<Role, string> = {
  ansatt: 'Ansatt',
  leder: 'Leder',
  fagleder: 'Fagleder',
  admin: 'Administrator',
  lonningsansvarlig: 'Lønningsansvarlig',
};

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    isActive
      ? 'bg-gray-700 text-white'
      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
  }`;

interface SidebarProps {
  drawerOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ drawerOpen, onClose }: SidebarProps) {
  const { user, activeRole, signOut } = useAuth();
  const role = activeRole;

  return (
    <aside
      className={`w-64 shrink-0 bg-gray-900 flex flex-col h-full
        fixed inset-y-0 left-0 z-30
        transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0 md:z-auto
        ${drawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
    >
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-700">
        <h1 className="text-lg font-bold text-white">Timeregistrering</h1>
        <p className="text-xs text-gray-400 mt-0.5">{user?.name}</p>
      </div>


      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {/* Ansatt */}
        <NavLink to="/" end className={linkCls} onClick={() => onClose()}>
          <HomeIcon className="h-5 w-5" />
          Hjem
        </NavLink>
        <NavLink to="/timeliste" className={linkCls} onClick={() => onClose()}>
          <ClockIcon className="h-5 w-5" />
          Mine timer
        </NavLink>
        <NavLink to="/fravar" className={linkCls} onClick={() => onClose()}>
          <CalendarDaysIcon className="h-5 w-5" />
          Fravær
        </NavLink>
        <NavLink to="/varsler" className={linkCls} onClick={() => onClose()}>
          <BellIcon className="h-5 w-5" />
          Varsler
        </NavLink>

        {/* Fagleder */}
        {role === 'fagleder' && (
          <>
            <div className="pt-3 pb-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3">
                Fagleder
              </p>
            </div>
            <NavLink to="/leder" end className={linkCls} onClick={() => onClose()}>
              <ChartBarIcon className="h-5 w-5" />
              Team-oversikt
            </NavLink>
          </>
        )}

        {/* Leder */}
        {(role === 'leder' || role === 'admin') && (
          <>
            <div className="pt-3 pb-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3">
                Leder
              </p>
            </div>
            <NavLink to="/leder" end className={linkCls} onClick={() => onClose()}>
              <ChartBarIcon className="h-5 w-5" />
              Team-oversikt
            </NavLink>
            <NavLink to="/leder/godkjenn-timer" className={linkCls} onClick={() => onClose()}>
              <DocumentCheckIcon className="h-5 w-5" />
              Godkjenn timer
            </NavLink>
            <NavLink to="/leder/godkjenn-fravar" className={linkCls} onClick={() => onClose()}>
              <DocumentCheckIcon className="h-5 w-5" />
              Godkjenn fravær
            </NavLink>
          </>
        )}

        {/* Admin */}
        {role === 'admin' && (
          <>
            <div className="pt-3 pb-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3">
                Admin
              </p>
            </div>
            <NavLink to="/admin/brukere" className={linkCls} onClick={() => onClose()}>
              <UserGroupIcon className="h-5 w-5" />
              Brukere
            </NavLink>
            <NavLink to="/admin/avdelinger" className={linkCls} onClick={() => onClose()}>
              <BuildingOfficeIcon className="h-5 w-5" />
              Avdelinger
            </NavLink>
            <NavLink to="/admin/grupper" className={linkCls} onClick={() => onClose()}>
              <UserGroupIcon className="h-5 w-5" />
              Grupper
            </NavLink>
            <NavLink to="/admin/arbeidsplaner" className={linkCls} onClick={() => onClose()}>
              <CalendarDaysIcon className="h-5 w-5" />
              Arbeidsplaner
            </NavLink>
            <NavLink to="/admin/fravaerskoder" className={linkCls} onClick={() => onClose()}>
              <Cog6ToothIcon className="h-5 w-5" />
              Fraværskoder
            </NavLink>
            <NavLink to="/admin/aml-regler" className={linkCls} onClick={() => onClose()}>
              <ShieldExclamationIcon className="h-5 w-5" />
              AML-regler
            </NavLink>
          </>
        )}

        {/* Lønningsansvarlig */}
        {(role === 'lonningsansvarlig' || role === 'admin') && (
          <>
            <div className="pt-3 pb-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3">
                Lønn
              </p>
            </div>
            <NavLink to="/lonning/eksport" className={linkCls} onClick={() => onClose()}>
              <DocumentCheckIcon className="h-5 w-5" />
              Lønnseksport
            </NavLink>
          </>
        )}
      </nav>

      {/* Logg ut */}
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <ArrowRightStartOnRectangleIcon className="h-5 w-5" />
          Logg ut
        </button>
      </div>
    </aside>
  );
}
