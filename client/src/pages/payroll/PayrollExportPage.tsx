import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { PayrollUserRow } from '@timeregistrering/shared';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

export function PayrollExportPage() {
  const now = new Date();
  const [from, setFrom] = useState(format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd'));
  const [triggered, setTriggered] = useState(false);

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ['payroll-preview', from, to],
    queryFn: () => apiFetch<PayrollUserRow[]>(`/payroll/preview?from=${from}&to=${to}`),
    enabled: triggered,
  });

  const allAbsenceCodes = [...new Set(rows.flatMap((r) => Object.keys(r.absenceByCode)))].sort();
  const allPresenceCodes = [...new Set(rows.flatMap((r) => Object.keys(r.presenceByCode)))].sort();

  function download(fmt: 'xlsx' | 'csv') {
    window.location.href = `/api/payroll/export?from=${from}&to=${to}&format=${fmt}`;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Periodevalg */}
      <Card>
        <CardBody>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Velg lønnsperiode</h3>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex gap-3">
              <Input
                label="Fra dato"
                id="pfrom"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
              <Input
                label="Til dato"
                id="pto"
                type="date"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <Button
              onClick={() => { setTriggered(true); refetch(); }}
              loading={isLoading}
            >
              Hent data
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Forhåndsvisning */}
      {triggered && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-sm font-semibold text-gray-700">
                {rows.length} ansatte · {from} – {to}
              </h3>
              {rows.length > 0 && (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => download('xlsx')}>
                    Last ned XLSX
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => download('csv')}>
                    Last ned CSV
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardBody className="p-0 overflow-x-auto">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-gray-500 px-5 py-6 text-center">
                Ingen godkjente timer i perioden.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Nr.</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Navn</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Arbeidstimer</th>
                    {allAbsenceCodes.map((c) => (
                      <th key={c} className="text-right px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                        Fravær: {c}
                      </th>
                    ))}
                    {allPresenceCodes.map((c) => (
                      <th key={c} className="text-right px-4 py-3 font-medium text-gray-600 whitespace-nowrap">
                        Tilstede: {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row) => (
                    <tr key={row.userId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{row.employeeNumber}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {(row.normalMinutes / 60).toFixed(2)}
                      </td>
                      {allAbsenceCodes.map((c) => (
                        <td key={c} className="px-4 py-3 text-right text-gray-700">
                          {(row.absenceByCode[c] ?? 0).toFixed(2)}
                        </td>
                      ))}
                      {allPresenceCodes.map((c) => (
                        <td key={c} className="px-4 py-3 text-right text-gray-700">
                          {(row.presenceByCode[c] ?? 0).toFixed(2)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
