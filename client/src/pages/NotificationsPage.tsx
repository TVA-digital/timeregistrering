import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { Notification } from '@timeregistrering/shared';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';

export function NotificationsPage() {
  const qc = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiFetch<Notification[]>('/notifications'),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/notifications/${id}/read`, { method: 'PATCH' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => apiFetch<void>('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {unreadCount > 0 && (
        <div className="flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            loading={markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            Merk alle som lest ({unreadCount})
          </Button>
        </div>
      )}

      <Card>
        <CardBody className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : notifications.length === 0 ? (
            <p className="text-sm text-gray-500 px-5 py-6 text-center">
              Ingen varsler ennå.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={`px-5 py-3 ${!n.is_read ? 'bg-indigo-50' : ''}`}
                  onClick={() => !n.is_read && markRead.mutate(n.id)}
                  role={!n.is_read ? 'button' : undefined}
                  style={!n.is_read ? { cursor: 'pointer' } : undefined}
                >
                  <div className="flex items-start gap-3">
                    {!n.is_read && (
                      <div className="w-2 h-2 rounded-full bg-indigo-600 mt-1.5 shrink-0" />
                    )}
                    <div className={!n.is_read ? '' : 'ml-5'}>
                      <p className="text-sm font-medium text-gray-900">{n.title}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{n.message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {format(new Date(n.created_at), 'd. MMM HH:mm', { locale: nb })}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
