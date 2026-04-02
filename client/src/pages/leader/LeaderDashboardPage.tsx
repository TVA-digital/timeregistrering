import { useState, useRef, useEffect } from 'react';
import type { ComponentType } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { TimeEntry, AbsenceRequest, TeamMemberStatus, AbsenceCode, AmlViolation, AmlRuleType } from '@timeregistrering/shared';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { UserGroupIcon, DocumentCheckIcon, CalendarDaysIcon, ShieldExclamationIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addWeeks,
  addMonths,
  startOfToday,
} from 'date-fns';
import { nb } from 'date-fns/locale';

type Period = 'week' | 'month';

// ---- Formateringshjelpere ----
function formatFlexMinutes(minutes: number): string {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sign = minutes >= 0 ? '+' : '−';
  if (h === 0) return `${sign}${m}min`;
  return `${sign}${h}t${m > 0 ? ` ${m}min` : ''}`;
}

function formatDurationMinutes(minutes: number): string {
  if (minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return `${h}t${m > 0 ? ` ${m}min` : ''}`;
}

// ---- AML ----
type AmlViolationWithUser = AmlViolation & {
  user: { name: string; employee_number: string };
};

const amlRuleLabels: Record<AmlRuleType, string> = {
  avg_day:      'Gj.snitt per dag',
  avg_week:     'Gj.snitt per uke',
  max_day:      'Maks per dag',
  max_week:     'Maks per uke',
  max_year:     'Maks per år',
  rest_daily:   'Daglig hvile',
  rest_weekly:  'Ukentlig hvile',
};

function AmlSection() {
  const [expanded, setExpanded] = useState(false);
  const [expandedType, setExpandedType] = useState<AmlRuleType | null>(null);

  const { data: violations = [] } = useQuery({
    queryKey: ['aml-violations'],
    queryFn: () => apiFetch<AmlViolationWithUser[]>('/aml/violations?days=30'),
  });

  if (violations.length === 0) return null;

  // Unike brukere med brudd
  const affectedUserIds = new Set(violations.map((v) => v.user_id));

  // Grupper per regeltype
  const byType = violations.reduce<Record<string, AmlViolationWithUser[]>>((acc, v) => {
    if (!acc[v.rule_type]) acc[v.rule_type] = [];
    acc[v.rule_type].push(v);
    return acc;
  }, {});

  return (
    <Card className="border-l-4 border-l-red-500">
      <CardHeader>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <ShieldExclamationIcon className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-sm font-semibold text-gray-800">AML-brudd siste 30 dager</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {affectedUserIds.size} ansatt{affectedUserIds.size !== 1 ? 'e' : ''} berørt
                {' · '}{violations.length} brudd totalt
              </p>
            </div>
          </div>
          {expanded
            ? <ChevronUpIcon className="h-4 w-4 text-gray-400" />
            : <ChevronDownIcon className="h-4 w-4 text-gray-400" />}
        </button>
      </CardHeader>

      {expanded && (
        <CardBody className="pt-0 space-y-3">
          {/* Fordeling per regeltype */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(byType).map(([type, items]) => (
              <button
                key={type}
                onClick={() => setExpandedType(expandedType === type as AmlRuleType ? null : type as AmlRuleType)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  expandedType === type
                    ? 'bg-red-100 border-red-300 text-red-800'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-red-50 hover:border-red-200'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                {amlRuleLabels[type as AmlRuleType]} — {items.length}
              </button>
            ))}
          </div>

          {/* Detaljliste for valgt regeltype */}
          {expandedType && byType[expandedType] && (
            <div className="rounded-lg border border-gray-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Ansatt</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">Faktisk</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">Grense</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600 hidden sm:table-cell">Tidspunkt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {byType[expandedType].map((v) => (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-gray-900">{v.user.name}</p>
                        <p className="text-xs text-gray-400">{v.user.employee_number}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-red-600">
                        {v.actual_value.toFixed(1).replace('.', ',')} t
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-500">
                        {v.limit_value.toFixed(1).replace('.', ',')} t
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-400 text-xs hidden sm:table-cell">
                        {new Date(v.violated_at).toLocaleDateString('nb-NO', {
                          day: 'numeric', month: 'short',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      )}
    </Card>
  );
}

// ---- StatusChip ----
function StatusChip({ row }: { row: TeamMemberStatus }) {
  if (row.activeAbsencePeriod) {
    const name = row.activeAbsencePeriod.absence_code.name;
    const isPresence = row.activeAbsencePeriod.absence_code.adds_flex;
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
        isPresence ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800'
      }`}>
        {name}
      </span>
    );
  }
  if (row.activeTimeEntry) {
    const since = format(new Date(row.activeTimeEntry.clock_in), 'HH:mm');
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
        Innstemplet {since}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
      Ikke innstemplet
    </span>
  );
}

// ---- Fraværskode-dropdown (multiselect) ----
function AbsenceCodeDropdown({
  allCodes,
  selectedIds,
  onChange,
}: {
  allCodes: AbsenceCode[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  const label =
    selectedIds.length === 0
      ? 'Velg fraværskoder å vise'
      : `${selectedIds.length} kode${selectedIds.length > 1 ? 'r' : ''} valgt`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        {label}
        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-10 py-1">
          {allCodes.length === 0 && (
            <p className="text-sm text-gray-400 px-4 py-2">Ingen fraværskoder</p>
          )}
          {allCodes.map((c) => (
            <label
              key={c.id}
              className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer text-sm"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(c.id)}
                onChange={() => toggle(c.id)}
                className="rounded border-gray-300 accent-indigo-600"
              />
              <span className="text-gray-800">{c.name}</span>
              {c.adds_flex && (
                <span className="ml-auto text-xs text-teal-600 font-medium">+flex</span>
              )}
              {c.deducts_flex && (
                <span className="ml-auto text-xs text-amber-600 font-medium">−flex</span>
              )}
            </label>
          ))}
          {selectedIds.length > 0 && (
            <div className="border-t border-gray-100 mt-1 pt-1 px-4 pb-1">
              <button
                onClick={() => onChange([])}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Fjern alle
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Hoved-komponent ----
export function LeaderDashboardPage() {
  const { user } = useAuth();

  // Periode-velger
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

  // Valgte fraværskode-kolonner (persister i localStorage)
  const storageKey = `teamStatusColumns_${user?.id ?? 'default'}`;
  const [selectedCodeIds, setSelectedCodeIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    } catch {
      return [];
    }
  });

  function updateSelectedCodes(ids: string[]) {
    setSelectedCodeIds(ids);
    localStorage.setItem(storageKey, JSON.stringify(ids));
  }

  // Eksisterende summary-data
  const { data: submittedEntries = [] } = useQuery({
    queryKey: ['time-entries', 'submitted'],
    queryFn: () => apiFetch<TimeEntry[]>('/time-entries?status=submitted'),
  });

  const { data: pendingAbsences = [] } = useQuery({
    queryKey: ['absence-requests', 'pending'],
    queryFn: () => apiFetch<AbsenceRequest[]>('/absence/requests?status=pending'),
  });

  // Ny team-status endpoint
  const { data: teamRows = [], isLoading } = useQuery({
    queryKey: ['team-status', from, to],
    queryFn: () => apiFetch<TeamMemberStatus[]>(`/team/status?from=${from}&to=${to}`),
    refetchInterval: 60_000,
  });

  // Alle fraværskoder (for dropdown)
  const { data: allCodes = [] } = useQuery({
    queryKey: ['absence-codes', 'all'],
    queryFn: () => apiFetch<AbsenceCode[]>('/absence/codes'),
  });

  const activeNow = teamRows.filter((r) => r.activeTimeEntry !== null).length;

  // Kun aktive koder i dropdown
  const activeCodes = allCodes.filter((c) => c.is_active);

  // Koder som faktisk er valgt og finnes
  const selectedCodes = activeCodes.filter((c) => selectedCodeIds.includes(c.id));

  return (
    <div className="space-y-6">
      {/* Summary-cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard label="Innstemplet nå" value={activeNow} color="green" href="/leder" icon={UserGroupIcon} />
        <SummaryCard
          label="Timer til godkjenning"
          value={submittedEntries.length}
          color="blue"
          href="/leder/godkjenn-timer"
          icon={DocumentCheckIcon}
        />
        <SummaryCard
          label="Fravær til godkjenning"
          value={pendingAbsences.length}
          color="yellow"
          href="/leder/godkjenn-fravar"
          icon={CalendarDaysIcon}
        />
      </div>

      {/* AML-brudd */}
      <AmlSection />

      {/* Team-tabell */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-gray-700">Teamoversikt</h3>

            <div className="flex flex-wrap items-center gap-2">
              {/* Periode-velger */}
              <div className="flex gap-1">
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
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setOffset((o) => o - 1)}>‹</Button>
                <span className="text-xs font-medium text-gray-600 min-w-[130px] text-center capitalize">
                  {periodLabel}
                </span>
                <Button variant="ghost" size="sm" onClick={() => setOffset((o) => o + 1)}>›</Button>
                {offset !== 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setOffset(0)}>I dag</Button>
                )}
              </div>

              {/* Fraværskode-kolonner */}
              <AbsenceCodeDropdown
                allCodes={activeCodes}
                selectedIds={selectedCodeIds}
                onChange={updateSelectedCodes}
              />
            </div>
          </div>
        </CardHeader>

        <CardBody className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : teamRows.length === 0 ? (
            <p className="text-sm text-gray-500 px-5 py-6 text-center">
              Ingen ansatte i avdelingen.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-600 w-48">Ansatt</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 w-28">Fleksitid</th>
                  {selectedCodes.map((c) => (
                    <th key={c.id} className="text-right px-4 py-3 font-medium text-gray-600 whitespace-nowrap w-32">
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {teamRows.map((row) => {
                  const flex = row.flexBalanceMinutes;
                  const flexColor =
                    flex > 0 ? 'text-green-700' : flex < 0 ? 'text-red-600' : 'text-gray-500';

                  return (
                    <tr key={row.user.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <Link to={`/leder/ansatt/${row.user.id}`} className="group">
                          <p className="font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">{row.user.name}</p>
                          <p className="text-xs text-gray-400">{row.user.employee_number}</p>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip row={row} />
                      </td>
                      <td className={`px-4 py-3 text-right font-mono text-sm font-medium ${flexColor}`}>
                        {formatFlexMinutes(flex)}
                      </td>
                      {selectedCodes.map((c) => {
                        const minutes = row.absenceMinutesByCode[c.id] ?? 0;
                        return (
                          <td key={c.id} className="px-4 py-3 text-right text-gray-700">
                            {formatDurationMinutes(minutes)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// ---- SummaryCard ----
function SummaryCard({
  label,
  value,
  color,
  href,
  icon: Icon,
}: {
  label: string;
  value: number;
  color: 'green' | 'blue' | 'yellow';
  href: string;
  icon: ComponentType<{ className?: string }>;
}) {
  const colors = {
    green: 'bg-green-50 border-green-200 text-green-700 border-l-green-500',
    blue: 'bg-blue-50 border-blue-200 text-blue-700 border-l-blue-500',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700 border-l-yellow-500',
  };
  return (
    <Link
      to={href}
      className={`rounded-xl border border-l-4 p-5 block hover:shadow-md transition-all ${colors[color]}`}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium">{label}</p>
        <Icon className="h-6 w-6 opacity-60" />
      </div>
      <p className="text-3xl font-bold mt-2">{value}</p>
    </Link>
  );
}
