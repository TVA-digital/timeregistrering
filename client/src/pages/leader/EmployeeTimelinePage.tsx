import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { TimeEntry, AbsenceRequest, AbsencePeriod, FlexBalance, User } from '@timeregistrering/shared';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { statusBadge } from '../../components/ui/Badge';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
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

function formatFlexMinutes(minutes: number): string {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sign = minutes >= 0 ? '+' : '−';
  if (h === 0) return `${sign}${m}min`;
  return `${sign}${h}t${m > 0 ? ` ${m}min` : ''}`;
}

export function EmployeeTimelinePage() {
  const { userId } = useParams<{ userId: string }>();
  const [period, setPeriod] = useState<Period>('month');
  const [offset, setOffset] = useState(0);

  const base = period === 'week' ? addWeeks(startOfToday(), offset) : addMonths(startOfToday(), offset);
  const periodStart = period === 'week' ? startOfWeek(base, { weekStartsOn: 1 }) : startOfMonth(base);
  const periodEnd = period === 'week' ? endOfWeek(base, { weekStartsOn: 1 }) : endOfMonth(base);
  const from = format(periodStart, 'yyyy-MM-dd');
  const to = format(periodEnd, 'yyyy-MM-dd');

  const periodLabel =
    period === 'week'
      ? `${format(periodStart, 'd. MMM', { locale: nb })} – ${format(periodEnd, 'd. MMM yyyy', { locale: nb })}`
      : format(periodStart, 'MMMM yyyy', { locale: nb });

  const { data: employee } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => apiFetch<User>(`/users/${userId}`),
    enabled: !!userId,
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['time-entries', userId, from, to],
    queryFn: () => apiFetch<TimeEntry[]>(`/time-entries?user_id=${userId}&from=${from}&to=${to}`),
    enabled: !!userId,
  });

  const { data: absenceRequests = [] } = useQuery({
    queryKey: ['absence-requests', userId, from, to],
    queryFn: () => apiFetch<AbsenceRequest[]>(`/absence/requests?user_id=${userId}&from=${from}&to=${to}`),
    enabled: !!userId,
  });

  const { data: absencePeriods = [] } = useQuery({
    queryKey: ['absence-periods', userId, from, to],
    queryFn: () => apiFetch<AbsencePeriod[]>(`/absence-periods?user_id=${userId}&from=${from}&to=${to}`),
    enabled: !!userId,
  });

  const { data: flexBalance } = useQuery({
    queryKey: ['flex-balance', userId],
    queryFn: () => apiFetch<FlexBalance>(`/flex-balance?user_id=${userId}`),
    enabled: !!userId,
  });

  const days = eachDayOfInterval({ start: periodStart, end: periodEnd });

  const entriesByDate = new Map<string, TimeEntry[]>();
  for (const entry of entries) {
    const key = format(new Date(entry.clock_in), 'yyyy-MM-dd');
    if (!entriesByDate.has(key)) entriesByDate.set(key, []);
    entriesByDate.get(key)!.push(entry);
  }

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

  const periodsByDate = new Map<string, AbsencePeriod[]>();
  for (const p of absencePeriods) {
    const key = format(new Date(p.started_at), 'yyyy-MM-dd');
    if (!periodsByDate.has(key)) periodsByDate.set(key, []);
    periodsByDate.get(key)!.push(p);
  }

  const flex = flexBalance?.balance_minutes ?? 0;
  const flexColor = flex > 0 ? 'text-green-700' : flex < 0 ? 'text-red-600' : 'text-gray-500';

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Tilbake + ansattheader */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            to="/leder"
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
            aria-label="Tilbake til teamoversikt"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </Link>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {employee?.name ?? '…'}
            </h2>
            {employee && (
              <p className="text-xs text-gray-400">
                Ansattnr. {employee.employee_number}
                {employee.department?.name && ` · ${employee.department.name}`}
              </p>
            )}
          </div>
        </div>
        {flexBalance && (
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm">
            <span className="text-gray-500">Fleksitid:</span>
            <span className={`font-semibold font-mono ${flexColor}`}>
              {formatFlexMinutes(flex)}
            </span>
          </div>
        )}
      </div>

      {/* Periode-velger */}
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
            <Button variant="ghost" size="sm" onClick={() => setOffset(0)}>I dag</Button>
          )}
        </div>
      </div>

      {/* Timeliste (kun lesemodus) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 capitalize">{periodLabel}</h3>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Kun lesemodus</span>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : entries.length === 0 && absenceRequests.length === 0 && absencePeriods.length === 0 ? (
            <p className="text-center text-gray-500 py-12">Ingen registreringer i denne perioden</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10 shadow-sm">
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-2 font-medium text-gray-600 w-36">Dato</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 w-20">Inn</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 w-20">Ut</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 w-24">Varighet</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 w-40">Type</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">Kommentar</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600 w-36">Status</th>
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
                        <td className="px-3 py-2.5 text-gray-300">—</td>
                        <td className="px-3 py-2.5 text-gray-300">—</td>
                        <td className="px-3 py-2.5 text-gray-300">—</td>
                        <td className="px-3 py-2.5"></td>
                        <td className="px-3 py-2.5"></td>
                        <td className="px-3 py-2.5"></td>
                      </tr>
                    );
                  }

                  return [
                    ...timedRows.map((row, idx) => {
                      const isVeryFirst = idx === 0;
                      const dateCellSpan = isVeryFirst ? totalRows : undefined;

                      if (row.kind === 'entry') {
                        const entry = row.data;
                        return (
                          <tr key={entry.id} className={`border-b border-gray-100 ${rowBg}`}>
                            {isVeryFirst && (
                              <td rowSpan={dateCellSpan} className={`px-4 py-2.5 align-top ${isWeekend ? 'text-gray-400 italic' : 'text-gray-700'} font-medium capitalize`}>
                                {dateText}
                              </td>
                            )}
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
                            <td className="px-3 py-2.5">{statusBadge(entry.status)}</td>
                          </tr>
                        );
                      } else {
                        const p = row.data;
                        const codeName = p.absence_code?.name ?? 'Fravær';
                        const isPresence = p.absence_code?.adds_flex;
                        return (
                          <tr key={`period-${p.id}`} className={`border-b border-gray-100 ${isPresence ? 'bg-teal-50' : 'bg-amber-50'}`}>
                            {isVeryFirst && (
                              <td rowSpan={dateCellSpan} className={`px-4 py-2.5 align-top ${isWeekend ? 'text-gray-400 italic' : 'text-gray-700'} font-medium capitalize`}>
                                {dateText}
                              </td>
                            )}
                            <td className="px-3 py-2.5 text-gray-700">
                              {format(new Date(p.started_at), 'HH:mm')}
                            </td>
                            <td className="px-3 py-2.5 text-gray-700">
                              {p.ended_at
                                ? format(new Date(p.ended_at), 'HH:mm')
                                : <span className={isPresence ? 'text-teal-600' : 'text-amber-600'}>pågår</span>}
                            </td>
                            <td className="px-3 py-2.5 text-gray-700">{periodDurationText(p)}</td>
                            <td className="px-3 py-2.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${isPresence ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800'}`}>
                                {codeName}
                              </span>
                            </td>
                            <td className="px-3 py-2.5"></td>
                            <td className="px-3 py-2.5"></td>
                          </tr>
                        );
                      }
                    }),

                    ...dayAbsences.map((req, idx) => (
                      <tr key={`abs-${req.id}-${key}`} className="border-b border-gray-100 bg-amber-50">
                        {timedRows.length === 0 && idx === 0 ? (
                          <td rowSpan={dayAbsences.length} className={`px-4 py-2.5 align-top ${isWeekend ? 'text-gray-400 italic' : 'text-gray-700'} font-medium capitalize`}>
                            {dateText}
                          </td>
                        ) : null}
                        <td className="px-3 py-2.5 text-gray-400">—</td>
                        <td className="px-3 py-2.5 text-gray-400">—</td>
                        <td className="px-3 py-2.5 text-gray-700">{absenceDurationText(req)}</td>
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
                      </tr>
                    )),
                  ];
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
