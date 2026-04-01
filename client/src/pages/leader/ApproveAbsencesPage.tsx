import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { AbsenceRequest } from '@timeregistrering/shared';
import { toast } from 'sonner';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';

function formatDateRange(from: string, to: string): string {
  const f = format(new Date(from), 'd. MMM', { locale: nb });
  const t = format(new Date(to), 'd. MMM yyyy', { locale: nb });
  return from === to ? f : `${f} – ${t}`;
}

export function ApproveAbsencesPage() {
  const qc = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<AbsenceRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['absence-requests', 'pending'],
    queryFn: () => apiFetch<AbsenceRequest[]>('/absence/requests?status=pending'),
  });

  const approve = useMutation({
    mutationFn: (id: string) =>
      apiFetch<AbsenceRequest>(`/absence/requests/${id}/approve`, { method: 'POST' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['absence-requests'] }); toast.success('Søknad godkjent'); },
    onError: () => toast.error('Kunne ikke godkjenne søknad'),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiFetch<AbsenceRequest>(`/absence/requests/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      setRejectTarget(null);
      setRejectReason('');
      qc.invalidateQueries({ queryKey: ['absence-requests'] });
      toast.success('Søknad avvist');
    },
    onError: () => toast.error('Kunne ikke avvise søknad'),
  });

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardBody className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : requests.length === 0 ? (
            <p className="text-sm text-gray-500 px-5 py-8 text-center">
              Ingen fraværssøknader venter på godkjenning.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {requests.map((req) => (
                <li key={req.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {(req.user as { name: string } | undefined)?.name}
                      </p>
                      <p className="text-sm text-gray-700 mt-0.5">
                        {req.absence_code?.name} · {formatDateRange(req.date_from, req.date_to)}
                        {req.hours_per_day ? ` · ${req.hours_per_day}t/dag` : ''}
                      </p>
                      {req.comment && (
                        <p className="text-xs text-gray-500 mt-0.5">{req.comment}</p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        loading={approve.isPending}
                        onClick={() => approve.mutate(req.id)}
                      >
                        Godkjenn
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setRejectTarget(req)}
                      >
                        Avvis
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Modal
        open={!!rejectTarget}
        onClose={() => { setRejectTarget(null); setRejectReason(''); }}
        title="Avvis fraværssøknad"
      >
        <p className="text-sm text-gray-700 mb-3">
          Begrunnelse til {(rejectTarget?.user as { name: string } | undefined)?.name}:
        </p>
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={3}
          placeholder="Begrunnelse..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 mb-4"
        />
        <div className="flex gap-3">
          <Button
            variant="danger"
            loading={reject.isPending}
            disabled={!rejectReason.trim()}
            onClick={() =>
              rejectTarget && reject.mutate({ id: rejectTarget.id, reason: rejectReason })
            }
          >
            Avvis
          </Button>
          <Button variant="secondary" onClick={() => { setRejectTarget(null); setRejectReason(''); }}>
            Avbryt
          </Button>
        </div>
      </Modal>
    </div>
  );
}
