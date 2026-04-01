import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { TimeEntry } from '@timeregistrering/shared';
import { toast } from 'sonner';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';

function durationText(entry: TimeEntry): string {
  if (!entry.clock_out) return '–';
  const min = Math.round(
    (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / 60000,
  );
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}t ${m > 0 ? m + 'min' : ''}`.trim();
}

export function ApproveTimeEntriesPage() {
  const qc = useQueryClient();
  const [rejectTarget, setRejectTarget] = useState<TimeEntry | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['time-entries', 'submitted'],
    queryFn: () => apiFetch<TimeEntry[]>('/time-entries?status=submitted'),
  });

  const approve = useMutation({
    mutationFn: (id: string) => apiFetch<TimeEntry>(`/time-entries/${id}/approve`, { method: 'POST' }),
    onMutate: (id) => setApprovingId(id),
    onSettled: () => setApprovingId(null),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['time-entries'] }); toast.success('Timer godkjent'); },
    onError: () => toast.error('Kunne ikke godkjenne timer'),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiFetch<TimeEntry>(`/time-entries/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      setRejectTarget(null);
      setRejectReason('');
      qc.invalidateQueries({ queryKey: ['time-entries'] });
      toast.success('Timer avvist');
    },
    onError: () => toast.error('Kunne ikke avvise timer'),
  });

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardBody className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-gray-500 px-5 py-8 text-center">
              Ingen timer venter på godkjenning.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {entries.map((entry) => (
                <li key={entry.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {(entry.user as { name: string } | undefined)?.name}
                      </p>
                      <p className="text-sm text-gray-700 mt-0.5">
                        {format(new Date(entry.clock_in), 'EEE d. MMMM', { locale: nb })}
                        {' · '}
                        {format(new Date(entry.clock_in), 'HH:mm')}
                        {entry.clock_out ? ` – ${format(new Date(entry.clock_out), 'HH:mm')}` : ''}
                        {entry.clock_out ? ` (${durationText(entry)})` : ''}
                      </p>
                      {entry.comment && (
                        <p className="text-xs text-gray-500 mt-0.5">{entry.comment}</p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        loading={approvingId === entry.id}
                        onClick={() => approve.mutate(entry.id)}
                      >
                        Godkjenn
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setRejectTarget(entry)}
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

      {/* Avvis-modal */}
      <Modal
        open={!!rejectTarget}
        onClose={() => { setRejectTarget(null); setRejectReason(''); }}
        title="Avvis timer"
      >
        <p className="text-sm text-gray-700 mb-3">
          Skriv en begrunnelse som sendes til{' '}
          {(rejectTarget?.user as { name: string } | undefined)?.name}:
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
