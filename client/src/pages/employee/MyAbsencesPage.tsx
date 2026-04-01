import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { AbsenceRequest } from '@timeregistrering/shared';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { statusBadge } from '../../components/ui/Badge';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';

function formatDateRange(from: string, to: string): string {
  const f = format(new Date(from), 'd. MMM', { locale: nb });
  const t = format(new Date(to), 'd. MMM yyyy', { locale: nb });
  return from === to ? f : `${f} – ${t}`;
}

export function MyAbsencesPage() {
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['absence-requests', 'mine'],
    queryFn: () => apiFetch<AbsenceRequest[]>('/absence/requests?mine=true'),
  });

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-base font-semibold text-gray-800">Mine fraværssøknader</h2>
        <Link to="/fravar/nytt">
          <Button size="sm">Ny søknad</Button>
        </Link>
      </div>

      <Card>
        <CardBody className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <p className="text-sm text-gray-500 px-5 py-6 text-center">
              Du har ingen fraværssøknader.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {requests.map((req) => (
                <li key={req.id} className="px-5 py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {req.absence_code?.name ?? req.absence_code_id}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDateRange(req.date_from, req.date_to)}
                      {req.hours_per_day ? ` · ${req.hours_per_day}t/dag` : ''}
                    </p>
                    {req.rejection_reason && (
                      <p className="text-xs text-red-600 mt-0.5">
                        Avvist: {req.rejection_reason}
                      </p>
                    )}
                  </div>
                  {statusBadge(req.status)}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
