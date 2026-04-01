import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { AbsenceCode } from '@timeregistrering/shared';
import { toast } from 'sonner';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

type CodeForm = {
  code: string;
  name: string;
  description: string;
  requires_approval: boolean;
  deducts_flex: boolean;
  deducts_vacation: boolean;
  allow_clock_out: boolean;
  adds_flex: boolean;
  is_quick_select: boolean;
};

const emptyForm: CodeForm = {
  code: '',
  name: '',
  description: '',
  requires_approval: true,
  deducts_flex: false,
  deducts_vacation: false,
  allow_clock_out: false,
  adds_flex: false,
  is_quick_select: false,
};

export function AbsenceCodesPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editCode, setEditCode] = useState<AbsenceCode | null>(null);
  const [form, setForm] = useState<CodeForm>(emptyForm);

  const { data: codes = [] } = useQuery({
    queryKey: ['absence-codes', 'all'],
    queryFn: () => apiFetch<AbsenceCode[]>('/absence/codes'),
  });

  const create = useMutation({
    mutationFn: (body: CodeForm) => apiFetch<AbsenceCode>('/absence/codes', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['absence-codes'] }); setShowCreate(false); toast.success('Fraværskode opprettet'); },
    onError: () => toast.error('Kunne ikke opprette fraværskode'),
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }: Partial<CodeForm> & { id: string; is_active?: boolean }) =>
      apiFetch<AbsenceCode>(`/absence/codes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['absence-codes'] }); setEditCode(null); toast.success('Fraværskode oppdatert'); },
    onError: () => toast.error('Kunne ikke oppdatere fraværskode'),
  });

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-base font-semibold text-gray-800">Fraværskoder</h2>
        <Button size="sm" onClick={() => { setShowCreate(true); setForm(emptyForm); }}>Ny kode</Button>
      </div>

      <Card>
        <CardBody className="p-0 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Kode</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Navn</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600 hidden md:table-cell whitespace-nowrap">Godkjenning</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600 hidden md:table-cell whitespace-nowrap">Trekker flex</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600 hidden md:table-cell whitespace-nowrap">Legger til flex</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {codes.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-mono font-medium text-gray-900">{c.code}</td>
                  <td className="px-5 py-3 text-gray-700">{c.name}</td>
                  <td className="px-5 py-3 hidden md:table-cell">
                    <Badge variant={c.requires_approval ? 'blue' : 'gray'}>
                      {c.requires_approval ? 'Ja' : 'Nei'}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 hidden md:table-cell">
                    <Badge variant={c.deducts_flex ? 'yellow' : 'gray'}>
                      {c.deducts_flex ? 'Ja' : 'Nei'}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 hidden md:table-cell">
                    <Badge variant={c.adds_flex ? 'blue' : 'gray'}>
                      {c.adds_flex ? 'Ja' : 'Nei'}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        aria-label="Rediger"
                        onClick={() => { setEditCode(c); setForm({ code: c.code, name: c.name, description: c.description ?? '', requires_approval: c.requires_approval, deducts_flex: c.deducts_flex, deducts_vacation: c.deducts_vacation, allow_clock_out: c.allow_clock_out, adds_flex: c.adds_flex, is_quick_select: c.is_quick_select }); }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        aria-label={c.is_active ? 'Deaktiver' : 'Aktiver'}
                        onClick={() => update.mutate({ id: c.id, is_active: !c.is_active })}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>

                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <CodeModal
        open={showCreate}
        title="Ny fraværskode"
        form={form}
        setForm={setForm}
        onSave={() => create.mutate(form)}
        onClose={() => setShowCreate(false)}
        loading={create.isPending}
        lockCode={false}
      />
      <CodeModal
        open={!!editCode}
        title="Rediger fraværskode"
        form={form}
        setForm={setForm}
        onSave={() => editCode && update.mutate({ id: editCode.id, ...form })}
        onClose={() => setEditCode(null)}
        loading={update.isPending}
        lockCode={true}
      />
    </div>
  );
}

function CodeModal({ open, title, form, setForm, onSave, onClose, loading, lockCode }: {
  open: boolean;
  title: string;
  form: CodeForm;
  setForm: (f: CodeForm) => void;
  onSave: () => void;
  onClose: () => void;
  loading: boolean;
  lockCode: boolean;
}) {
  const f = (field: keyof CodeForm, value: string | boolean) =>
    setForm({ ...form, [field]: value });

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-3">
        <Input label="Kode" id="code" value={form.code} disabled={lockCode} onChange={(e) => f('code', e.target.value.toUpperCase())} placeholder="F.eks. SYK" />
        <Input label="Navn" id="codeName" value={form.name} onChange={(e) => f('name', e.target.value)} placeholder="F.eks. Egenmelding sykdom" />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Beskrivelse</label>
          <textarea rows={2} value={form.description} onChange={(e) => f('description', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div className="space-y-2">
          {([
            ['requires_approval', 'Krever godkjenning'],
            ['deducts_flex', 'Trekker fra fleksitid'],
            ['deducts_vacation', 'Trekker fra ferie'],
            ['allow_clock_out', 'Tillat ved utstempling (midtdags-fravær)'],
            ['adds_flex', 'Legg til fleksitid (tilstedeværelseskode)'],
            ['is_quick_select', 'Vis som hurtigvalg i timelisten'],
          ] as [keyof CodeForm, string][]).map(([field, label]) => (
            <label key={field} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form[field] as boolean} onChange={(e) => f(field, e.target.checked)} className="rounded" />
              {label}
            </label>
          ))}
        </div>
        <div className="flex gap-3 pt-2">
          <Button loading={loading} onClick={onSave}>Lagre</Button>
          <Button variant="secondary" onClick={onClose}>Avbryt</Button>
        </div>
      </div>
    </Modal>
  );
}
