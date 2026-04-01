import ExcelJS from 'exceljs';
import { supabase } from './supabase.js';
import { PayrollUserRow, AbsenceRequest } from '@timeregistrering/shared';

export async function aggregatePayrollData(
  from: string,
  to: string,
): Promise<PayrollUserRow[]> {
  // Hent godkjente time_entries i perioden
  const { data: entries, error: entriesError } = await supabase
    .from('time_entries')
    .select('user_id, clock_in, clock_out, user:users!time_entries_user_id_fkey(name, employee_number)')
    .eq('status', 'approved')
    .gte('clock_in', from)
    .lte('clock_in', to + 'T23:59:59')
    .not('clock_out', 'is', null);

  if (entriesError) throw entriesError;

  // Hent godkjente fraværssøknader i perioden (planlagt fravær)
  const { data: absences, error: absencesError } = await supabase
    .from('absence_requests')
    .select('*, absence_code:absence_codes(code, name), user:users!absence_requests_user_id_fkey(name, employee_number)')
    .eq('status', 'approved')
    .or(`date_from.lte.${to},date_to.gte.${from}`);

  if (absencesError) throw absencesError;

  // Hent avsluttede fraværsperioder med tilstedekoder (adds_flex = true) i perioden
  const { data: presencePeriods, error: presenceError } = await supabase
    .from('absence_periods')
    .select('user_id, started_at, ended_at, absence_code:absence_codes(code, name, adds_flex), user:users(name, employee_number)')
    .not('ended_at', 'is', null)
    .gte('started_at', from)
    .lte('started_at', to + 'T23:59:59');

  if (presenceError) throw presenceError;

  const userMap = new Map<string, PayrollUserRow>();

  const ensureUser = (userId: string, name: string, employeeNumber: string) => {
    if (!userMap.has(userId)) {
      userMap.set(userId, {
        userId,
        employeeNumber,
        name,
        normalMinutes: 0,
        absenceByCode: {},
        presenceByCode: {},
      });
    }
    return userMap.get(userId)!;
  };

  // Behandle time_entries — summer faktisk arbeidstid
  for (const entry of (entries ?? []) as (typeof entries extends (infer T)[] | null ? T : never)[]) {
    if (!entry.user_id || !entry.clock_in || !entry.clock_out) continue;
    const user = (entry as unknown as { user?: { name?: string; employee_number?: string } }).user;
    const row = ensureUser(entry.user_id, user?.name ?? '', user?.employee_number ?? '');
    const actualMinutes = Math.round(
      (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / 60000,
    );
    row.normalMinutes += actualMinutes;
  }

  // Behandle fraværssøknader (planlagt fravær)
  for (const absence of (absences ?? []) as (AbsenceRequest & {
    user: { name: string; employee_number: string };
    absence_code: { code: string; name: string };
  })[]) {
    if (!absence.user_id) continue;
    const row = ensureUser(
      absence.user_id,
      absence.user?.name ?? '',
      absence.user?.employee_number ?? '',
    );
    const code = absence.absence_code?.code ?? 'UKJENT';
    const hours = absence.hours_per_day ?? 7.5;
    const days = getWorkdaysInRange(absence.date_from, absence.date_to);
    row.absenceByCode[code] = (row.absenceByCode[code] ?? 0) + hours * days;
  }

  // Behandle tilstedeværelsesperioder (adds_flex-koder)
  for (const period of (presencePeriods ?? []) as (typeof presencePeriods extends (infer T)[] | null ? T : never)[]) {
    const absenceCode = (period as unknown as { absence_code?: { code?: string; name?: string; adds_flex?: boolean } }).absence_code;
    if (!absenceCode?.adds_flex) continue;
    if (!period.user_id || !period.started_at || !period.ended_at) continue;
    const user = (period as unknown as { user?: { name?: string; employee_number?: string } }).user;
    const row = ensureUser(period.user_id, user?.name ?? '', user?.employee_number ?? '');
    const code = absenceCode.code ?? 'UKJENT';
    const minutes = Math.round(
      (new Date(period.ended_at).getTime() - new Date(period.started_at).getTime()) / 60000,
    );
    const hours = minutes / 60;
    row.presenceByCode[code] = (row.presenceByCode[code] ?? 0) + hours;
  }

  return Array.from(userMap.values()).sort((a, b) =>
    a.employeeNumber.localeCompare(b.employeeNumber),
  );
}

// Tell antall hverdager (Man-Fre) i et datointervall
function getWorkdaysInRange(from: string, to: string): number {
  let count = 0;
  const current = new Date(from);
  const end = new Date(to);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export async function exportToXlsx(
  rows: PayrollUserRow[],
  from: string,
  to: string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Timeregistrering';
  const ws = wb.addWorksheet('Lønnseksport');

  // Finn alle unike fraværskoder og tilstedekoder
  const allAbsenceCodes = [...new Set(rows.flatMap((r) => Object.keys(r.absenceByCode)))].sort();
  const allPresenceCodes = [...new Set(rows.flatMap((r) => Object.keys(r.presenceByCode)))].sort();

  // Tittelrad
  ws.addRow([`Lønnseksport: ${from} – ${to}`]);
  ws.getRow(1).font = { bold: true, size: 14 };
  ws.addRow([]); // tom rad

  // Kolonneoverskrifter
  const headers = [
    'Ansattnummer',
    'Navn',
    'Arbeidstimer',
    ...allAbsenceCodes.map((c) => `Fravær: ${c} (timer)`),
    ...allPresenceCodes.map((c) => `Tilstede: ${c} (timer)`),
  ];
  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' },
  };

  // Datarader
  for (const row of rows) {
    ws.addRow([
      row.employeeNumber,
      row.name,
      +(row.normalMinutes / 60).toFixed(2),
      ...allAbsenceCodes.map((c) => +((row.absenceByCode[c] ?? 0)).toFixed(2)),
      ...allPresenceCodes.map((c) => +((row.presenceByCode[c] ?? 0)).toFixed(2)),
    ]);
  }

  // Kolonnebredder
  ws.getColumn(1).width = 16;
  ws.getColumn(2).width = 24;
  for (let i = 3; i <= headers.length; i++) {
    ws.getColumn(i).width = 20;
    ws.getColumn(i).numFmt = '#,##0.00';
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function exportToCsv(rows: PayrollUserRow[]): string {
  const allAbsenceCodes = [...new Set(rows.flatMap((r) => Object.keys(r.absenceByCode)))].sort();
  const allPresenceCodes = [...new Set(rows.flatMap((r) => Object.keys(r.presenceByCode)))].sort();

  const headers = [
    'Ansattnummer',
    'Navn',
    'Arbeidstimer',
    ...allAbsenceCodes.map((c) => `Fravær: ${c}`),
    ...allPresenceCodes.map((c) => `Tilstede: ${c}`),
  ];

  const lines = [headers.join(';')];

  for (const row of rows) {
    const values = [
      row.employeeNumber,
      row.name,
      (row.normalMinutes / 60).toFixed(2).replace('.', ','),
      ...allAbsenceCodes.map((c) => (row.absenceByCode[c] ?? 0).toFixed(2).replace('.', ',')),
      ...allPresenceCodes.map((c) => (row.presenceByCode[c] ?? 0).toFixed(2).replace('.', ',')),
    ];
    lines.push(values.join(';'));
  }

  return lines.join('\r\n');
}
