import { useState, FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api';
import { AbsenceCode, AbsenceRequest } from '@timeregistrering/shared';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export function RequestAbsencePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [codeId, setCodeId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [hoursPerDay, setHoursPerDay] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  const { data: codes = [] } = useQuery({
    queryKey: ['absence-codes'],
    queryFn: () => apiFetch<AbsenceCode[]>('/absence/codes'),
  });

  const create = useMutation({
    mutationFn: (body: object) => apiFetch<AbsenceRequest>('/absence/requests', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['absence-requests'] });
      navigate('/fravar');
    },
    onError: (err: Error) => setError(err.message),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!codeId || !dateFrom || !dateTo) {
      setError('Fraværskode og datoer er påkrevd');
      return;
    }
    if (dateTo < dateFrom) {
      setError('Til-dato kan ikke være før fra-dato');
      return;
    }
    create.mutate({
      absence_code_id: codeId,
      date_from: dateFrom,
      date_to: dateTo,
      hours_per_day: hoursPerDay ? Number(hoursPerDay) : null,
      comment: comment || undefined,
    });
  }

  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardBody>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Søk om fravær</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fraværskode
              </label>
              <select
                value={codeId}
                onChange={(e) => setCodeId(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Velg type</option>
                {codes.map((code) => (
                  <option key={code.id} value={code.id}>
                    {code.code} – {code.name}
                    {code.requires_approval ? ' (krever godkjenning)' : ''}
                  </option>
                ))}
              </select>
              {codeId && (
                <p className="text-xs text-gray-500 mt-1">
                  {codes.find((c) => c.id === codeId)?.description}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Fra dato"
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  if (!dateTo) setDateTo(e.target.value);
                }}
                required
              />
              <Input
                label="Til dato"
                id="dateTo"
                type="date"
                value={dateTo}
                min={dateFrom}
                onChange={(e) => setDateTo(e.target.value)}
                required
              />
            </div>

            <Input
              label="Timer per dag (blank = full dag)"
              id="hours"
              type="number"
              step="0.5"
              min="0.5"
              max="24"
              value={hoursPerDay}
              onChange={(e) => setHoursPerDay(e.target.value)}
              placeholder="F.eks. 4"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kommentar (valgfritt)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="Eventuell tilleggsinfo..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" loading={create.isPending}>
                Send søknad
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/fravar')}
              >
                Avbryt
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
