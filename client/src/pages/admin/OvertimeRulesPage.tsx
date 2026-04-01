import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { OvertimeRule, RateType } from '@timeregistrering/shared';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { PencilIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

const WEEKDAY_LABELS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn', 'Helligdag'];

type RuleForm = {
  name: string;
  condition_time_from: string;
  condition_time_to: string;
  condition_weekdays: number[];
  all_weekdays: boolean;
  condition_hours_over: string;
  rate_type: RateType;
  rate_value: string;
  priority: string;
};

const emptyForm: RuleForm = {
  name: '',
  condition_time_from: '',
  condition_time_to: '',
  condition_weekdays: [],
  all_weekdays: true,
  condition_hours_over: '',
  rate_type: 'percent',
  rate_value: '1.5',
  priority: '0',
};

function toPayload(f: RuleForm) {
  return {
    name: f.name,
    condition_time_from: f.condition_time_from || null,
    condition_time_to: f.condition_time_to || null,
    condition_weekdays: f.all_weekdays ? null : f.condition_weekdays,
    condition_hours_over: f.condition_hours_over ? Number(f.condition_hours_over) : null,
    rate_type: f.rate_type,
    rate_value: Number(f.rate_value),
    priority: Number(f.priority),
  };
}

function rateLabel(rule: OvertimeRule): string {
  if (rule.rate_type === 'percent') {
    return `${Math.round((rule.rate_value - 1) * 100)}% tillegg`;
  }
  return `${rule.rate_value} kr/t`;
}

function weekdayLabel(rule: OvertimeRule): string {
  if (!rule.condition_weekdays) return 'Alle dager';
  return rule.condition_weekdays.map((d) => WEEKDAY_LABELS[d]).join(', ');
}

export function OvertimeRulesPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editRule, setEditRule] = useState<OvertimeRule | null>(null);
  const [form, setForm] = useState<RuleForm>(emptyForm);

  const { data: rules = [] } = useQuery({
    queryKey: ['overtime-rules'],
    queryFn: () => apiFetch<OvertimeRule[]>('/overtime-rules'),
  });

  const create = useMutation({
    mutationFn: (body: object) =>
      apiFetch<OvertimeRule>('/overtime-rules', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['overtime-rules'] }); setShowCreate(false); },
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }: object & { id: string }) =>
      apiFetch<OvertimeRule>(`/overtime-rules/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['overtime-rules'] }); setEditRule(null); },
  });

  function openEdit(r: OvertimeRule) {
    setEditRule(r);
    setForm({
      name: r.name,
      condition_time_from: r.condition_time_from ?? '',
      condition_time_to: r.condition_time_to ?? '',
      condition_weekdays: r.condition_weekdays ?? [],
      all_weekdays: r.condition_weekdays === null,
      condition_hours_over: r.condition_hours_over?.toString() ?? '',
      rate_type: r.rate_type,
      rate_value: r.rate_value.toString(),
      priority: r.priority.toString(),
    });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-base font-semibold text-gray-800">Overtidsregler</h2>
        <Button size="sm" onClick={() => { setShowCreate(true); setForm(emptyForm); }}>Ny regel</Button>
      </div>

      <Card>
        <CardBody className="p-0 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Navn</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600 hidden md:table-cell">Ukedager</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600 hidden md:table-cell">Tidsvindu</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Sats</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rules.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{r.name}</td>
                  <td className="px-5 py-3 text-gray-500 hidden md:table-cell text-xs">{weekdayLabel(r)}</td>
                  <td className="px-5 py-3 text-gray-500 hidden md:table-cell text-xs">
                    {r.condition_time_from && r.condition_time_to
                      ? `${r.condition_time_from}–${r.condition_time_to}`
                      : r.condition_hours_over
                        ? `Etter ${r.condition_hours_over}t`
                        : '–'}
                  </td>
                  <td className="px-5 py-3 text-gray-700 text-xs">{rateLabel(r)}</td>
                  <td className="px-5 py-3">
                    <Badge variant={r.is_active ? 'green' : 'gray'}>
                      {r.is_active ? 'Aktiv' : 'Inaktiv'}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        aria-label="Rediger"
                        onClick={() => openEdit(r)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        aria-label={r.is_active ? 'Deaktiver' : 'Aktiver'}
                        onClick={() => update.mutate({ id: r.id, is_active: !r.is_active } as object & { id: string })}
                        className={`p-1.5 rounded-lg transition-colors ${r.is_active ? 'text-gray-400 hover:text-orange-600 hover:bg-orange-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                      >
                        {r.is_active
                          ? <EyeSlashIcon className="h-4 w-4" />
                          : <EyeIcon className="h-4 w-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <RuleModal
        open={showCreate}
        title="Ny overtidsregel"
        form={form}
        setForm={setForm}
        onSave={() => create.mutate(toPayload(form))}
        onClose={() => setShowCreate(false)}
        loading={create.isPending}
      />
      <RuleModal
        open={!!editRule}
        title="Rediger overtidsregel"
        form={form}
        setForm={setForm}
        onSave={() => editRule && update.mutate({ id: editRule.id, ...toPayload(form) } as object & { id: string })}
        onClose={() => setEditRule(null)}
        loading={update.isPending}
      />
    </div>
  );
}

function RuleModal({ open, title, form, setForm, onSave, onClose, loading }: {
  open: boolean; title: string; form: RuleForm;
  setForm: (f: RuleForm) => void; onSave: () => void; onClose: () => void; loading: boolean;
}) {
  const f = <K extends keyof RuleForm>(field: K, value: RuleForm[K]) =>
    setForm({ ...form, [field]: value });

  function toggleWeekday(day: number) {
    const current = form.condition_weekdays;
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    setForm({ ...form, condition_weekdays: next.sort() });
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
        <Input label="Navn" id="rname" value={form.name} onChange={(e) => f('name', e.target.value)} placeholder="F.eks. Kveldsarbeid" />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Ukedager</label>
          <label className="flex items-center gap-2 text-sm mb-2">
            <input type="checkbox" checked={form.all_weekdays} onChange={(e) => f('all_weekdays', e.target.checked)} />
            Alle dager
          </label>
          {!form.all_weekdays && (
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_LABELS.map((label, i) => (
                <button key={i} type="button"
                  onClick={() => toggleWeekday(i)}
                  className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                    form.condition_weekdays.includes(i)
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Fra klokkeslett" id="tfrom" type="time" value={form.condition_time_from} onChange={(e) => f('condition_time_from', e.target.value)} />
          <Input label="Til klokkeslett" id="tto" type="time" value={form.condition_time_to} onChange={(e) => f('condition_time_to', e.target.value)} />
        </div>

        <Input label="Overtid etter X timer/dag" id="hoursOver" type="number" step="0.5" min="0" value={form.condition_hours_over}
          onChange={(e) => f('condition_hours_over', e.target.value)} placeholder="F.eks. 9" />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Satstype</label>
          <select value={form.rate_type} onChange={(e) => f('rate_type', e.target.value as RateType)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="percent">Prosentillegg</option>
            <option value="fixed">Fast kr/time</option>
          </select>
        </div>

        <Input
          label={form.rate_type === 'percent' ? 'Faktor (1.5 = 50% tillegg)' : 'Kr per time'}
          id="rateVal" type="number" step="0.01" min="0"
          value={form.rate_value} onChange={(e) => f('rate_value', e.target.value)} />

        <Input label="Prioritet (lavere = høyere prioritet)" id="prio" type="number" min="0"
          value={form.priority} onChange={(e) => f('priority', e.target.value)} />

        <div className="flex gap-3 pt-2">
          <Button loading={loading} onClick={onSave}>Lagre</Button>
          <Button variant="secondary" onClick={onClose}>Avbryt</Button>
        </div>
      </div>
    </Modal>
  );
}
