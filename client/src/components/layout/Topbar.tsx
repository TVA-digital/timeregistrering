import { Bars3Icon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import { NotificationBell } from './NotificationBell';
import { useAuth } from '../../contexts/AuthContext';
import { Role } from '@timeregistrering/shared';

const roleLabels: Record<string, string> = {
  ansatt: 'Ansatt',
  leder: 'Leder',
  fagleder: 'Fagleder',
  admin: 'Administrator',
  lonningsansvarlig: 'Lønningsansvarlig',
};

interface TopbarProps {
  title: string;
  onMenuClick: () => void;
}

export function Topbar({ title, onMenuClick }: TopbarProps) {
  const { user, activeRole, availableRoles, setActiveRole } = useAuth();

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Åpne meny"
        >
          <Bars3Icon className="h-6 w-6" />
        </button>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="flex items-center gap-2">
        {user && availableRoles.length > 1 ? (
          <select
            value={activeRole ?? user.role}
            onChange={(e) => setActiveRole(e.target.value as Role)}
            className="hidden sm:block text-sm text-gray-600 border border-gray-200 rounded-lg px-2 py-1.5 bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            {availableRoles.map((r) => (
              <option key={r} value={r}>{roleLabels[r]}</option>
            ))}
          </select>
        ) : (
          <span className="hidden sm:block text-sm text-gray-500">
            {user ? roleLabels[user.role] : ''}
          </span>
        )}
        <Link
          to="/hjelp"
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
          aria-label="Hjelp"
        >
          <QuestionMarkCircleIcon className="h-6 w-6" />
        </Link>
        <NotificationBell />
      </div>
    </header>
  );
}
