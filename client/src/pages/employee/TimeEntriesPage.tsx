import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { TimeEntry, AbsenceRequest, AbsencePeriod, AbsenceCode } from '@timeregistrering/shared';
import { toast } from 'sonner';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { statusBadge } from '../../components/ui/Badge';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addWeeks,
  addMonths,
  startOfToday,
  isSaturday,
  isSunday,
  parseISO,
} from 'date-fns';
import { nb } from 'date-fns/locale';

type Period = 'week' | 'month';

function durationText(entry: TimeEntry): string {
  if (!entry.clock_out) return 'Pågår';
  const min = Math.round(
    (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / 60000,
  );
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}t ${m > 0 ? m + 'min' : ''}`.trim() : `${m}min`;
}

function absenceDurationText(req: AbsenceRequest): string {
  if (req.hours_per_day != null) {
    const h = Math.floor(req.hours_per_day);
    const m = Math.round((req.hours_per_day - h) * 60);
    return h > 0 ? `${h}t ${m > 0 ? m + 'min' : ''}`.trim() : `${m}min`;
  }
  return 'Hel dag';
}

function periodDurationText(period: AbsencePeriod): string {
  if (!period.ended_at) return 'Pågår';
  const min = Math.round(
    (new Date(period.ended_at).getTime() - new Date(period.started_at).getTime()) / 60000,
  );
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}t ${m > 0 ? m + 'min' : ''}`.trim() : `${m}min`;
}

function absenceStatusBadge(status: AbsenceRequest['status']) {
  const map: Record<AbsenceRequest['status'], { label: string; className: string }> = {
    pending:  { label: 'Venter', className: 'bg-yellow-100 text-yellow-800' },
    approved: { label: 'Godkjent', className: 'bg-green-100 text-green-800' },
    rejected: { label: 'Avvist', className: 'bg-red-100 text-red-800' },
  };
  const { label, className } = map[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

// ---- Redigeringsmodal for fraværsperiode ----
interface EditPeriodModalState {
  period: AbsencePeriod;
  startedTime: string; // HH:mm
  endedTime: string;   // HH:mm
}

function EditPeriodModal({
  state,
  onClose,
  onSave,
  loading,
}: {
  state: EditPeriodModalState;
  onClose: () => void;
  onSave: (patch: { started_at: string; ended_at?: string }) => void;
  loading: boolean;
}) {
  const [startedTime, setStartedTime] = useState(state.startedTime);
  const [endedTime, setEndedTime] = useState(state.endedTime);
  const periodDate = format(new Date(state.period.started_at), 'yyyy-MM-dd');
  const codeName = state.period.absence_code?.name ?? 'Fravær';

  function handleSave() {
    onSave({
      started_at: `${periodDate}T${startedTime}:00`,
      ended_at: state.period.ended_at ? `${periodDate}T${endedTime}:00` : undefined,
    });
  }

  return (
    <Modal open onClose={onClose} title={`Endre fraværsperiode — ${codeName}`}>
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
            <input
              type="time"
              value={startedTime}
              onChange={(e) => setStartedTime(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {state.period.ended_at && (
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Slutt</label>
              <input
                type="time"
                value={endedTime}
                onChange={(e) => setEndedTime(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
        </div>
        <div className="flex gap-3 pt-1">
          <Button loading={loading} onClick={handleSave}>Lagre</Button>
          <Button variant="secondary" onClick={onClose}>Avbryt</Button>
        </div>
      </div>
    </Modal>
  );
}

// ---- Redigeringsmodal for timeregistrering ----
interface EditModalState {
  entry: TimeEntry;
  clockInTime: string;  // HH:mm
  clockOutTime: string; // HH:mm
  comment: string;
}

function EditEntryModal({
  state,
  onClose,
  onSave,
  loading,
}: {
  state: EditModalState;
  onClose: () => void;
  onSave: (patch: { clock_in: string; clock_out: string; comment: string }) => void;
  loading: boolean;
}) {
  const [clockIn, setClockIn] = useState(state.clockInTime);
  const [clockOut, setClockOut] = useState(state.clockOutTime);
  const [comment, setComment] = useState(state.comment);

  const entryDate = format(new Date(state.entry.clock_in), 'yyyy-MM-dd');
  const clockOutDate = state.entry.clock_out
    ? format(new Date(state.entry.clock_out), 'yyyy-MM-dd')
    : entryDate;
  const crossesMidnight = entryDate !== clockOutDate;

  function handleSave() {
    onSave({
      clock_in: `${entryDate}T${clockIn}:00`,
      clock_out: state.entry.clock_out ? `${format(new Date(state.entry.clock_out), 'yyyy-MM-dd')}T${clockOut}:00` : `${entryDate}T${clockOut}:00`,
      comment,
    });
  }

  return (
    <Modal open onClose={onClose} title="Endre timeregistrering">
      <div className="space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Innstemplet</label>
            <input
              type="time"
              value={clockIn}
              onChange={(e) => setClockIn(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {state.entry.clock_out && (
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Utstemplet</label>
              <input
                type="time"
                value={clockOut}
                onChange={(e) => setClockOut(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kommentar</label>
          <textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Valgfri kommentar"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        {crossesMidnight && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            OBS: Denne registreringen går over midnatt ({entryDate} &rarr; {clockOutDate})
          </p>
        )}
        <div className="flex gap-3 pt-1">
          <Button loading={loading} onClick={handleSave}>Lagre</Button>
          <Button variant="secondary" onClick={onClose}>Avbryt</Button>
        </div>
      </div>
    </Modal>
  );
}

// ---- Redigeringsmodal for fraværssøknad (uten godkjenning) ----
interface EditAbsenceRequestModalState {
  req: AbsenceRequest;
  hoursPerDay: string; // tom streng = hel dag
  comment: string;
}

function EditAbsenceRequestModal({
  state,
  onClose,
  onSave,
  loading,
}: {
  state: EditAbsenceRequestModalState;
  onClose: () => void;
  onSave: (patch: { hours_per_day: number | null; comment: string | null }) => void;
  loading: boolean;
}) {
  const [hoursPerDay, setHoursPerDay] = useState(state.hoursPerDay);
  const [comment, setComment] = useState(state.comment);
  const codeName = state.req.absence_code?.name ?? 'Fravær';

  function handleSave() {
    onSave({
      hours_per_day: hoursPerDay.trim() === '' ? null : Number(hoursPerDay),
      comment: comment.trim() === '' ? null : comment.trim(),
    });
  }

  return (
    <Modal open onClose={onClose} title={`Endre fravær — ${codeName}`}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Timer per dag
            <span className="ml-1 text-xs font-normal text-gray-400">(tom = hel dag)</span>
          </label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={hoursPerDay}
            onChange={(e) => setHoursPerDay(e.target.value)}
            placeholder="Hel dag"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kommentar</label>
          <textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Valgfri kommentar"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex gap-3 pt-1">
          <Button loading={loading} onClick={handleSave}>Lagre</Button>
          <Button variant="secondary" onClick={onClose}>Avbryt</Button>
        </div>
      </div>
    </Modal>
  );
}

// ---- Hoved-komponent ----
export function TimeEntriesPage() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<Period>('month');
  const [offset, setOffset] = useState(0);
  const [editState, setEditState] = useState<EditModalState | null>(null);
  const [editPeriodState, setEditPeriodState] = useState<EditPeriodModalState | null>(null);
  const [editAbsenceReqState, setEditAbsenceReqState] = useState<EditAbsenceRequestModalState | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const base = period === 'week' ? addWeeks(startOfToday(), offset) : addMonths(startOfToday(), offset);
  const periodStart = period === 'week' ? startOfWeek(base, { weekStartsOn: 1 }) : startOfMonth(base);
  const periodEnd = period === 'week' ? endOfWeek(base, { weekStartsOn: 1 }) : endOfMonth(base);
  const from = format(periodStart, 'yyyy-MM-dd');
  const to = format(periodEnd, 'yyyy-MM-dd');

  // Inneværende måned (for innsending — alltid, uavhengig av visningsperiode)
  const currentMonthYM = format(startOfToday(), 'yyyy-MM');
  const currentMonthLabel = format(startOfToday(), 'MMMM yyyy', { locale: nb });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['time-entries', from, to],
    queryFn: () => apiFetch<TimeEntry[]>(`/time-entries?mine=true&from=${from}&to=${to}`),
  });

  // Hent utkast for inneværende måned (for å vise antall i banner)
  const currentMonthStart = format(startOfMonth(startOfToday()), 'yyyy-MM-dd');
  const currentMonthEnd = format(endOfMonth(startOfToday()), 'yyyy-MM-dd');
  const { data: currentMonthEntries = [] } = useQuery({
    queryKey: ['time-entries', currentMonthStart, currentMonthEnd],
    queryFn: () => apiFetch<TimeEntry[]>(`/time-entries?mine=true&from=${currentMonthStart}&to=${currentMonthEnd}`),
  });

  const { data: absenceRequests = [] } = useQuery({
    queryKey: ['absence-requests', from, to],
    queryFn: () => apiFetch<AbsenceRequest[]>(`/absence/requests?mine=true&from=${from}&to=${to}`),
  });

  const { data: absencePeriods = [] } = useQuery({
    queryKey: ['absence-periods', from, to],
    queryFn: () => apiFetch<AbsencePeriod[]>(`/absence-periods?from=${from}&to=${to}`),
  });

  const { data: quickSelectCodes = [] } = useQuery({
    queryKey: ['absence-codes', 'quick-select'],
    queryFn: () => apiFetch<AbsenceCode[]>('/absence/codes'),
    select: (codes) => codes.filter((c) => c.is_quick_select && c.is_active),
  });

  const currentMonthDrafts = currentMonthEntries.filter((e) => e.status === 'draft' && e.clock_out);
  const incompleteDrafts = currentMonthEntries.filter((e) => e.status === 'draft' && !e.clock_out);

  const submitMonth = useMutation({
    mutationFn: (yearMonth: string) =>
      apiFetch<{ submitted: number }>('/time-entries/submit-month', {
        method: 'POST',
        body: JSON.stringify({ year_month: yearMonth }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-entries'] });
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 4000);
    },
  });

  const quickSelect = useMutation({
    mutationFn: ({ absence_code_id, date }: { absence_code_id: string; date: string }) =>
      apiFetch<AbsenceRequest>('/absence/requests', {
        method: 'POST',
        body: JSON.stringify({ absence_code_id, date_from: date, date_to: date, hours_per_day: null }),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['absence-requests'] }); toast.success('Fravær registrert'); },
    onError: () => toast.error('Kunne ikke registrere fravær'),
  });

  const updateEntry = useMutation({
    mutationFn: ({ id, ...patch }: { id: string; clock_in: string; clock_out: string; comment: string }) =>
      apiFetch<TimeEntry>(`/time-entries/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-entries'] });
      setEditState(null);
    },
  });

  const deleteEntry = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/time-entries/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['time-entries'] }),
  });

  const updatePeriod = useMutation({
    mutationFn: ({ id, ...patch }: { id: string; started_at: string; ended_at?: string }) =>
      apiFetch<AbsencePeriod>(`/absence-periods/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['absence-periods'] });
      qc.invalidateQueries({ queryKey: ['flex-balance'] });
      setEditPeriodState(null);
    },
  });

  const deletePeriod = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/absence-periods/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['absence-periods'] });
      qc.invalidateQueries({ queryKey: ['flex-balance'] });
    },
  });

  const updateAbsenceReq = useMutation({
    mutationFn: ({ id, ...patch }: { id: string; hours_per_day: number | null; comment: string | null }) =>
      apiFetch<AbsenceRequest>(`/absence/requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['absence-requests'] });
      qc.invalidateQueries({ queryKey: ['flex-balance'] });
      setEditAbsenceReqState(null);
      toast.success('Fravær oppdatert');
    },
    onError: () => toast.error('Kunne ikke oppdatere fravær'),
  });

  const deleteAbsenceReq = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/absence/requests/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['absence-requests'] });
      qc.invalidateQueries({ queryKey: ['flex-balance'] });
      toast.success('Fravær slettet');
    },
    onError: () => toast.error('Kunne ikke slette fravær'),
  });

  function openEdit(entry: TimeEntry) {
    setEditState({
      entry,
      clockInTime: format(new Date(entry.clock_in), 'HH:mm'),
      clockOutTime: entry.clock_out ? format(new Date(entry.clock_out), 'HH:mm') : '',
      comment: entry.comment ?? '',
    });
  }

  const days = eachDayOfInterval({ start: periodStart, end: periodEnd });

  // Grupper timeregistreringer per dato
  const entriesByDate = new Map<string, TimeEntry[]>();
  for (const entry of entries) {
    const key = format(new Date(entry.clock_in), 'yyyy-MM-dd');
    if (!entriesByDate.has(key)) entriesByDate.set(key, []);
    entriesByDate.get(key)!.push(entry);
  }

  // Grupper fraværssøknader per dato (ekspander flerdagsperioder)
  const absenceByDate = new Map<string, AbsenceRequest[]>();
  for (const req of absenceRequests) {
    const start = parseISO(req.date_from);
    const end = parseISO(req.date_to);
    const reqDays = eachDayOfInterval({ start, end });
    for (const d of reqDays) {
      const key = format(d, 'yyyy-MM-dd');
      if (key < from || key > to) continue;
      if (!absenceByDate.has(key)) absenceByDate.set(key, []);
      absenceByDate.get(key)!.push(req);
    }
  }

  // Grupper fraværsperioder (realtidsfravær) per dato
  const periodsByDate = new Map<string, AbsencePeriod[]>();
  for (const period of absencePeriods) {
    const key = format(new Date(period.started_at), 'yyyy-MM-dd');
    if (!periodsByDate.has(key)) periodsByDate.set(key, []);
    periodsByDate.get(key)!.push(period);
  }

  const periodLabel =
    period === 'week'
      ? `${format(periodStart, 'd. MMM', { locale: nb })} – ${format(periodEnd, 'd. MMM yyyy', { locale: nb })}`
      : format(periodStart, 'MMMM yyyy', { locale: nb });

  const quickCells = (dateKey: string, enabled: boolean, rowSpan?: number) => {
    const dayAbsencesForDate = absenceByDate.get(dateKey) ?? [];
    const anyAbsenceToday = dayAbsencesForDate.length > 0;
    return quickSelectCodes.map((code) => {
      const alreadySet = dayAbsencesForDate.some((r) => r.absence_code_id === code.id);
      const blockedByOther = anyAbsenceToday && !alreadySet;
      return (
        <td key={code.id} rowSpan={rowSpan} className="px-2 py-2.5 text-center align-middle hidden sm:table-cell">
          {enabled && (
            <button
              onClick={() => { if (!alreadySet && !blockedByOther) quickSelect.mutate({ absence_code_id: code.id, date: dateKey }); }}
              title={
                alreadySet       ? `${code.name} – allerede registrert` :
                blockedByOther   ? 'Kun én fraværskode per dag' :
                                   `Registrer ${code.name} (hel dag)`
              }
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mx-auto transition-colors
                ${alreadySet
                  ? 'bg-amber-400 border-amber-400 text-white cursor-default'
                  : blockedByOther
                    ? 'border-gray-200 text-transparent cursor-not-allowed opacity-30'
                    : 'border-gray-300 hover:border-amber-400 hover:bg-amber-50 text-transparent hover:text-amber-400'}`}
            >
              <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="1.5,6 4.5,9.5 10.5,2.5" />
              </svg>
            </button>
          )}
        </td>
      );
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Kontroller */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          <Button
            variant={period === 'week' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => { setPeriod('week'); setOffset(0); }}
          >
            Uke
          </Button>
          <Button
            variant={period === 'month' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => { setPeriod('month'); setOffset(0); }}
          >
            Måned
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOffset((o) => o - 1)}>‹</Button>
          <span className="text-sm font-medium text-gray-700 min-w-[180px] text-center capitalize">
            {periodLabel}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setOffset((o) => o + 1)}>›</Button>
          {offset !== 0 && (
            <Button variant="ghost" size="sm" onClick={() => setOffset(0)}>
              I dag
            </Button>
          )}
        </div>
      </div>

      {/* Send inn alle timer denne måneden */}
      {submitSuccess ? (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800 font-medium">
          ✓ Timer for {currentMonthLabel} er sendt til godkjenning
        </div>
      ) : currentMonthDrafts.length > 0 ? (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="text-sm text-blue-800">
            <p>
              <span className="font-medium">{currentMonthDrafts.length} utkast</span> for{' '}
              <span className="capitalize">{currentMonthLabel}</span> – klar til innsending
            </p>
            {incompleteDrafts.length > 0 && (
              <p className="text-xs text-amber-700 mt-0.5">
                {incompleteDrafts.length} kladd(er) uten utstemplingstid blir ikke sendt inn
              </p>
            )}
          </div>
          <Button
            size="sm"
            loading={submitMonth.isPending}
            onClick={() => submitMonth.mutate(currentMonthYM)}
          >
            Send inn alle timer for {format(startOfToday(), 'MMMM', { locale: nb })}
          </Button>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-gray-700 capitalize">{periodLabel}</h3>
        </CardHeader>
        <CardBody className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : entries.length === 0 && absenceRequests.length === 0 ? (
            <p className="text-center text-gray-500 py-12">Ingen registreringer i denne perioden</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10 shadow-sm">
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-2 font-medium text-gray-600 w-36">Dato</th>
                  {quickSelectCodes.map((code) => (
                    <th key={code.id} title={code.name}
                        className="text-center px-2 py-2 font-medium text-gray-600 w-14 hidden sm:table-cell">
                      {code.code}
                    </th>
                  ))}
                  <th className="text-left px-3 py-2 font-medium text-gray-600 w-20">Inn</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 w-20">Ut</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 w-24">Varighet</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 w-40">Type</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Kommentar</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 w-36">Status</th>
                  <th className="px-3 py-2 w-36"></th>
                </tr>
              </thead>
              <tbody>
                {days.map((day) => {
                  const key = format(day, 'yyyy-MM-dd');
                  const dayEntries = entriesByDate.get(key) ?? [];
                  const dayPeriods = periodsByDate.get(key) ?? [];
                  const dayAbsences = absenceByDate.get(key) ?? [];
                  const isWeekend = isSaturday(day) || isSunday(day);
                  const rowBg = isWeekend ? 'bg-gray-50' : '';
                  const dateText = format(day, 'EEE d. MMM', { locale: nb });
                  const totalRows = dayEntries.length + dayPeriods.length + dayAbsences.length;

                  // Sorter time entries og fraværsperioder sammen etter starttid
                  type TimedRow =
                    | { kind: 'entry'; data: TimeEntry }
                    | { kind: 'period'; data: AbsencePeriod };
                  const timedRows: TimedRow[] = [
                    ...dayEntries.map((e) => ({ kind: 'entry' as const, data: e })),
                    ...dayPeriods.map((p) => ({ kind: 'period' as const, data: p })),
                  ].sort((a, b) => {
                    const aTime = a.kind === 'entry' ? a.data.clock_in : a.data.started_at;
                    const bTime = b.kind === 'entry' ? b.data.clock_in : b.data.started_at;
                    return new Date(aTime).getTime() - new Date(bTime).getTime();
                  });

                  if (totalRows === 0) {
                    return (
                      <tr key={key} className={`border-b border-gray-100 ${rowBg}`}>
                        <td className={`px-4 py-2.5 ${isWeekend ? 'text-gray-400 italic' : 'text-gray-700'} font-medium capitalize`}>
                          {dateText}
                        </td>
                        {quickCells(key, !isWeekend)}
                        <td className="px-3 py-2.5 text-gray-300">—</td>
                        <td className="px-3 py-2.5 text-gray-300">—</td>
                        <td className="px-3 py-2.5 text-gray-300">—</td>
                        <td className="px-3 py-2.5"></td>
                        <td className="px-3 py-2.5"></td>
                        <td className="px-3 py-2.5"></td>
                        <td className="px-3 py-2.5"></td>
                      </tr>
                    );
                  }

                  return [
                    // Timeregistreringer og fraværsperioder (sortert etter tid)
                    ...timedRows.map((row, idx) => {
                      const isFirstInDay = idx === 0 && dayAbsences.length === 0;
                      const isVeryFirst = idx === 0;
                      const dateCellSpan = isVeryFirst ? totalRows : undefined;

                      if (row.kind === 'entry') {
                        const entry = row.data;
                        return (
                          <tr key={entry.id} className={`border-b border-gray-100 ${rowBg}`}>
                            {isVeryFirst && (
                              <td
                                rowSpan={dateCellSpan}
                                className={`px-4 py-2.5 align-top ${isWeekend ? 'text-gray-400 italic' : 'text-gray-700'} font-medium capitalize`}
                              >
                                {dateText}
                              </td>
                            )}
                            {isVeryFirst && quickCells(key, !isWeekend && dayEntries.length === 0, dateCellSpan)}
                            <td className="px-3 py-2.5 text-gray-800">
                              {format(new Date(entry.clock_in), 'HH:mm')}
                            </td>
                            <td className="px-3 py-2.5 text-gray-800">
                              {entry.clock_out
                                ? format(new Date(entry.clock_out), 'HH:mm')
                                : <span className="text-blue-500">pågår</span>}
                            </td>
                            <td className="px-3 py-2.5 text-gray-700">
                              {entry.clock_out ? durationText(entry) : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-gray-400 text-xs">—</td>
                            <td className="px-3 py-2.5 text-gray-500 max-w-[200px]">
                              <span className="truncate block">
                                {entry.comment ?? ''}
                                {entry.rejection_reason && (
                                  <span className="text-red-600 ml-1">Avvist: {entry.rejection_reason}</span>
                                )}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              {statusBadge(entry.status)}
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1">
                                {entry.status === 'draft' && (
                                  <button
                                    aria-label="Endre"
                                    onClick={() => openEdit(entry)}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                  >
                                    <PencilIcon className="h-4 w-4" />
                                  </button>
                                )}
                                {entry.status === 'draft' && (
                                  <button
                                    aria-label="Slett"
                                    onClick={() => deleteEntry.mutate(entry.id)}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      } else {
                        // Fraværsperiode (realtidsfravær)
                        const period = row.data;
                        const codeName = period.absence_code?.name ?? 'Fravær';
                        const isPresence = period.absence_code?.adds_flex;
                        return (
                          <tr key={`period-${period.id}`} className={`border-b border-gray-100 ${isPresence ? 'bg-teal-50' : 'bg-amber-50'}`}>
                            {isVeryFirst && (
                              <td
                                rowSpan={dateCellSpan}
                                className={`px-4 py-2.5 align-top ${isWeekend ? 'text-gray-400 italic' : 'text-gray-700'} font-medium capitalize`}
                              >
                                {dateText}
                              </td>
                            )}
                            {isVeryFirst && quickCells(key, !isWeekend && dayEntries.length === 0, dateCellSpan)}
                            <td className="px-3 py-2.5 text-gray-700">
                              {format(new Date(period.started_at), 'HH:mm')}
                            </td>
                            <td className="px-3 py-2.5 text-gray-700">
                              {period.ended_at
                                ? format(new Date(period.ended_at), 'HH:mm')
                                : <span className={isPresence ? 'text-teal-600' : 'text-amber-600'}>pågår</span>}
                            </td>
                            <td className="px-3 py-2.5 text-gray-700">
                              {periodDurationText(period)}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${isPresence ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800'}`}>
                                {codeName}
                              </span>
                            </td>
                            <td className="px-3 py-2.5"></td>
                            <td className="px-3 py-2.5"></td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1">
                                <button
                                  aria-label="Endre"
                                  onClick={() => setEditPeriodState({
                                    period,
                                    startedTime: format(new Date(period.started_at), 'HH:mm'),
                                    endedTime: period.ended_at ? format(new Date(period.ended_at), 'HH:mm') : '',
                                  })}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                >
                                  <PencilIcon className="h-4 w-4" />
                                </button>
                                <button
                                  aria-label="Slett"
                                  onClick={() => deletePeriod.mutate(period.id)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                    }),

                    // Planlagte fraværssøknader (dato-basert, vises sist)
                    ...dayAbsences.map((req, idx) => (
                      <tr key={`abs-${req.id}-${key}`} className="border-b border-gray-100 bg-amber-50">
                        {timedRows.length === 0 && idx === 0 ? (
                          <td
                            rowSpan={dayAbsences.length}
                            className={`px-4 py-2.5 align-top ${isWeekend ? 'text-gray-400 italic' : 'text-gray-700'} font-medium capitalize`}
                          >
                            {dateText}
                          </td>
                        ) : null}
                        {timedRows.length === 0 && idx === 0 && quickCells(key, !isWeekend && dayEntries.length === 0, dayAbsences.length)}
                        <td className="px-3 py-2.5 text-gray-400">—</td>
                        <td className="px-3 py-2.5 text-gray-400">—</td>
                        <td className="px-3 py-2.5 text-gray-700">
                          {absenceDurationText(req)}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                            {req.absence_code?.name ?? 'Fravær'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-500 max-w-[200px]">
                          <span className="truncate block">
                            {req.comment ?? ''}
                            {req.rejection_reason && (
                              <span className="text-red-600 ml-1">Avvist: {req.rejection_reason}</span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            {absenceStatusBadge(req.status)}
                            {req.absence_code?.deducts_flex && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                                −flex
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          {(!req.absence_code?.requires_approval || req.status === 'pending') && (
                            <div className="flex items-center gap-1">
                              <button
                                aria-label="Endre"
                                onClick={() => setEditAbsenceReqState({
                                  req,
                                  hoursPerDay: req.hours_per_day != null ? String(req.hours_per_day) : '',
                                  comment: req.comment ?? '',
                                })}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </button>
                              <button
                                aria-label="Slett"
                                onClick={() => deleteAbsenceReq.mutate(req.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )),
                  ];
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      {/* Redigeringsmodal — timeregistrering */}
      {editState && (
        <EditEntryModal
          state={editState}
          onClose={() => setEditState(null)}
          onSave={(patch) => updateEntry.mutate({ id: editState.entry.id, ...patch })}
          loading={updateEntry.isPending}
        />
      )}

      {/* Redigeringsmodal — fraværsperiode */}
      {editPeriodState && (
        <EditPeriodModal
          state={editPeriodState}
          onClose={() => setEditPeriodState(null)}
          onSave={(patch) => updatePeriod.mutate({ id: editPeriodState.period.id, ...patch })}
          loading={updatePeriod.isPending}
        />
      )}

      {/* Redigeringsmodal — fraværssøknad uten godkjenning */}
      {editAbsenceReqState && (
        <EditAbsenceRequestModal
          state={editAbsenceReqState}
          onClose={() => setEditAbsenceReqState(null)}
          onSave={(patch) => updateAbsenceReq.mutate({ id: editAbsenceReqState.req.id, ...patch })}
          loading={updateAbsenceReq.isPending}
        />
      )}
    </div>
  );
}
