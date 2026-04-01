import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { TimeEntry, AbsenceCode, AbsencePeriod } from '@timeregistrering/shared';
import { Button } from '../../components/ui/Button';
import { toast } from 'sonner';

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

export function ClockInOutButton() {
  const queryClient = useQueryClient();
  const [elapsed, setElapsed] = useState(0);
  const [absenceElapsed, setAbsenceElapsed] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedAbsenceCodeId, setSelectedAbsenceCodeId] = useState('');

  // Aktiv innstempeling
  const { data: activeEntry, isLoading: loadingEntry } = useQuery({
    queryKey: ['time-entries', 'active'],
    queryFn: () => apiFetch<TimeEntry | null>('/time-entries/active'),
    refetchInterval: 60_000,
  });

  // Aktiv fraværsperiode
  const { data: activePeriod, isLoading: loadingPeriod } = useQuery({
    queryKey: ['absence-periods', 'active'],
    queryFn: () => apiFetch<AbsencePeriod | null>('/absence-periods/active'),
    refetchInterval: 60_000,
  });

  // Fraværskoder som kan brukes ved utstempling
  const { data: allCodes = [] } = useQuery({
    queryKey: ['absence-codes', 'clock-out'],
    queryFn: () => apiFetch<AbsenceCode[]>('/absence/codes'),
    select: (codes) => codes.filter((c) => c.allow_clock_out && c.is_active),
    enabled: !!activeEntry,
  });

  // Teller mens innstempelt
  useEffect(() => {
    if (!activeEntry) { setElapsed(0); return; }
    const start = new Date(activeEntry.clock_in).getTime();
    setElapsed(Math.floor((Date.now() - start) / 1000));
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [activeEntry]);

  // Teller mens i fraværsperiode
  useEffect(() => {
    if (!activePeriod) { setAbsenceElapsed(0); return; }
    const start = new Date(activePeriod.started_at).getTime();
    setAbsenceElapsed(Math.floor((Date.now() - start) / 1000));
    const iv = setInterval(() => setAbsenceElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [activePeriod]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['time-entries'] });
    queryClient.invalidateQueries({ queryKey: ['absence-periods'] });
    queryClient.invalidateQueries({ queryKey: ['flex-balance'] });
  };

  const clockIn = useMutation({
    mutationFn: () => apiFetch<TimeEntry>('/time-entries/clock-in', {
      method: 'POST',
      body: JSON.stringify({ comment: comment || undefined }),
    }),
    onSuccess: () => { setComment(''); invalidateAll(); toast.success('Du er nå innstemplet'); },
    onError: () => toast.error('Kunne ikke stemple inn'),
  });

  const clockOut = useMutation({
    mutationFn: (id: string) => apiFetch<TimeEntry>(`/time-entries/${id}/clock-out`, {
      method: 'POST',
      body: JSON.stringify({
        absence_code_id: selectedAbsenceCodeId || undefined,
      }),
    }),
    onSuccess: () => {
      setSelectedAbsenceCodeId('');
      invalidateAll();
      toast.success('Du er nå utstemplet');
    },
    onError: () => toast.error('Kunne ikke stemple ut'),
  });

  const endAbsence = useMutation({
    mutationFn: ({ id, returnToWork }: { id: string; returnToWork: boolean }) =>
      apiFetch(`/absence-periods/${id}/end`, {
        method: 'POST',
        body: JSON.stringify({ return_to_work: returnToWork }),
      }),
    onSuccess: () => { invalidateAll(); toast.success('Fraværsperiode avsluttet'); },
    onError: () => toast.error('Kunne ikke avslutte fraværsperiode'),
  });

  if (loadingEntry || loadingPeriod) {
    return <div className="h-36 bg-gray-100 rounded-xl animate-pulse" />;
  }

  // === Tilstand C: I fraværsperiode ===
  if (activePeriod) {
    const codeName = activePeriod.absence_code?.name ?? 'Fravær';
    return (
      <div className="rounded-xl p-6 text-center bg-amber-50 border-2 border-amber-300">
        <p className="text-sm font-medium text-amber-800 mb-1">{codeName}</p>
        <p className="text-xs text-amber-600 mb-2">
          Fra{' '}
          {new Date(activePeriod.started_at).toLocaleTimeString('no-NO', {
            hour: '2-digit', minute: '2-digit',
          })}
        </p>
        <p className="text-4xl font-mono font-bold text-amber-700 mb-5">
          {formatElapsed(absenceElapsed)}
        </p>
        <div className="flex gap-3 justify-center">
          <Button
            variant="primary"
            size="lg"
            loading={endAbsence.isPending}
            onClick={() => endAbsence.mutate({ id: activePeriod.id, returnToWork: true })}
            className="bg-green-600 hover:bg-green-700"
          >
            Tilbake til jobb
          </Button>
          <Button
            variant="secondary"
            size="lg"
            loading={endAbsence.isPending}
            onClick={() => endAbsence.mutate({ id: activePeriod.id, returnToWork: false })}
          >
            Avslutt dagen
          </Button>
        </div>
      </div>
    );
  }

  // === Tilstand B: Innstempelt ===
  if (activeEntry) {
    const hasAbsenceCodes = allCodes.length > 0;
    const isAbsenceClockOut = !!selectedAbsenceCodeId;

    return (
      <div className="rounded-xl p-6 text-center bg-red-50 border-2 border-red-200">
        <p className="text-sm font-medium text-red-700 mb-1">Innstemplet siden</p>
        <p className="text-xs text-red-500 mb-2">
          {new Date(activeEntry.clock_in).toLocaleTimeString('no-NO', {
            hour: '2-digit', minute: '2-digit',
          })}
        </p>
        <p className="text-4xl font-mono font-bold text-red-700 mb-4">
          {formatElapsed(elapsed)}
        </p>

        {/* Fraværskode-valg */}
        {hasAbsenceCodes && (
          <div className="mb-4">
            <select
              value={selectedAbsenceCodeId}
              onChange={(e) => {
                setSelectedAbsenceCodeId(e.target.value);
              }}
              className="w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              <option value="">Stempl ut normalt</option>
              {allCodes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {isAbsenceClockOut && (
              <p className="text-xs text-amber-700 mt-1">
                Du stempler ut og starter en fraværsperiode
              </p>
            )}
          </div>
        )}

        <Button
          variant="danger"
          size="lg"
          loading={clockOut.isPending}
          onClick={() => clockOut.mutate(activeEntry.id)}
        >
          {isAbsenceClockOut ? `Stempl ut til fravær` : 'Stempl ut'}
        </Button>
      </div>
    );
  }

  // === Tilstand A: Ikke innstemplt ===
  return (
    <div className="rounded-xl p-6 text-center bg-green-50 border-2 border-green-200">
      <p className="text-sm font-medium text-green-700 mb-4">Du er ikke innstemplet</p>
      <div className="mb-4">
        <input
          type="text"
          placeholder="Kommentar (valgfritt)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full rounded-lg border border-green-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>
      <Button
        variant="primary"
        size="lg"
        loading={clockIn.isPending}
        onClick={() => clockIn.mutate()}
        className="bg-green-600 hover:bg-green-700"
      >
        Stempl inn
      </Button>
    </div>
  );
}
