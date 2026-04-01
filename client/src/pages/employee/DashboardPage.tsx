import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { FlexBalance, TimeEntry } from '@timeregistrering/shared';
import { ClockInOutButton } from '../../features/timeEntries/ClockInOutButton';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { statusBadge } from '../../components/ui/Badge';
import { useAuth } from '../../contexts/AuthContext';
import { ScaleIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';

function formatMinutes(minutes: number): string {
  const isNeg = minutes < 0;
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const str = h > 0 ? `${h}t ${m > 0 ? m + 'min' : ''}`.trim() : `${m}min`;
  return isNeg ? `-${str}` : `+${str}`;
}

export function DashboardPage() {
  const { user } = useAuth();

  const { data: flexBalance } = useQuery({
    queryKey: ['flex-balance'],
    queryFn: () => apiFetch<FlexBalance>('/flex-balance'),
  });

  const { data: recentEntries } = useQuery({
    queryKey: ['time-entries', 'recent'],
    queryFn: () => apiFetch<TimeEntry[]>('/time-entries?mine=true'),
  });

  const recent = (recentEntries ?? []).slice(0, 5);
  const balance = flexBalance?.balance_minutes ?? 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Velkomst */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          God {getTimeOfDay()}, {user?.name?.split(' ')[0]}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {format(new Date(), 'EEEE d. MMMM yyyy', { locale: nb })}
        </p>
      </div>

      {/* Clock in/out */}
      <ClockInOutButton />

      {/* Fleksitidssaldo */}
      <Card className={`overflow-hidden border-l-4 ${balance >= 0 ? 'border-l-green-500' : 'border-l-red-500'}`}>
        <CardBody>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Fleksitidssaldo</p>
              <p className={`text-4xl font-bold mt-2 ${balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatMinutes(balance)}
              </p>
            </div>
            <ScaleIcon className={`h-8 w-8 mt-1 ${balance >= 0 ? 'text-green-400' : 'text-red-400'}`} />
          </div>
        </CardBody>
      </Card>

      {/* Siste timer */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-gray-700">Siste registreringer</h3>
        </CardHeader>
        <CardBody className="p-0">
          {recent.length === 0 ? (
            <p className="text-sm text-gray-500 px-5 py-4">Ingen registreringer ennå.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recent.map((entry) => (
                <li key={entry.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {format(new Date(entry.clock_in), 'EEE d. MMM', { locale: nb })}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {format(new Date(entry.clock_in), 'HH:mm')}
                      {entry.clock_out ? ` – ${format(new Date(entry.clock_out), 'HH:mm')}` : ' (aktiv)'}
                    </p>
                  </div>
                  {statusBadge(entry.status)}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 10) return 'morgen';
  if (h < 12) return 'formiddag';
  if (h < 14) return 'ettermiddag';
  if (h < 18) return 'ettermiddag';
  return 'kveld';
}
