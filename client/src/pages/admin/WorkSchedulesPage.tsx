import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { WorkSchedule } from '@timeregistrering/shared';
import { toast } from 'sonner';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';

const WEEKDAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];

interface ScheduleForm {
  name: string;
  days: Array<{ weekday: number; hours: number }>;
}

const defaultDays = [0, 1, 2, 3, 4].map((w) => ({ weekday: w, hours: 7.5 }));

const emptyForm: ScheduleForm = {
  name: '',
  days: defaultDays,
};

export function WorkSchedulesPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<ScheduleForm>(emptyForm);

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['work-schedules'],
    queryFn: () => apiFetch<WorkSchedule[]>('/work-schedules'),
  });

  const create = useMutation({
    mutationFn: (body: ScheduleForm) =>
      apiFetch<WorkSchedule>('/work-schedules', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-schedules'] });
      setShowCreate(false);
      setForm(emptyForm);
      toast.success('Arbeidsplan opprettet');
    },
    onError: () => toast.error('Kunne ikke opprette arbeidsplan'),
  });

  function setHours(weekday: number, hours: number) {
    setForm((f) => ({
      ...f,
      days: f.days.some((d) => d.weekday === weekday)
        ? f.days.map((d) => (d.weekday === weekday ? { ...d, hours } : d))
        : [...f.days, { weekday, hours }].sort((a, b) => a.weekday - b.weekday),
    }));
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Arbeidsplaner</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Opprett gjenbrukbare maler som tilordnes ansatte fra brukeradmin.
          </p>
        </div>
        <Button size="sm" onClick={() => { setForm(emptyForm); setShowCreate(true); }}>
          Ny arbeidsplan
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : schedules.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-sm text-gray-500 text-center py-4">
              Ingen arbeidsplaner opprettet ennå.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {schedules.map((s) => (
            <Card key={s.id}>
              <CardBody>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">{s.name}</h3>
                <div className="grid grid-cols-7 gap-1">
                  {WEEKDAYS.map((day, i) => {
                    const d = s.days.find((dd) => dd.weekday === i);
                    return (
                      <div key={i} className="text-center">
                        <p className="text-xs text-gray-400 mb-0.5">{day.slice(0, 3)}</p>
                        <p className={`text-sm font-medium ${d && d.hours > 0 ? 'text-gray-800' : 'text-gray-300'}`}>
                          {d && d.hours > 0 ? `${d.hours}t` : '–'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Ny arbeidsplan">
        <div className="space-y-4">
          <Input
            label="Navn"
            id="sname"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="F.eks. Standard 37,5 t/uke"
          />
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Timer per dag</p>
            <div className="space-y-2">
              {WEEKDAYS.map((day, i) => {
                const d = form.days.find((dd) => dd.weekday === i);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-24">{day}</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="24"
                      value={d?.hours ?? 0}
                      onChange={(e) => setHours(i, Number(e.target.value))}
                      className="w-20 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-gray-400">timer</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <Button loading={create.isPending} onClick={() => create.mutate(form)}>
              Lagre
            </Button>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              Avbryt
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
