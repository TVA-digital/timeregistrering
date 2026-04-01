import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { Department } from '@timeregistrering/shared';
import { toast } from 'sonner';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

export function DepartmentsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [name, setName] = useState('');

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => apiFetch<Department[]>('/departments'),
  });

  const create = useMutation({
    mutationFn: () => apiFetch<Department>('/departments', { method: 'POST', body: JSON.stringify({ name }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); setShowCreate(false); setName(''); toast.success('Avdeling opprettet'); },
    onError: () => toast.error('Kunne ikke opprette avdeling'),
  });

  const update = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      apiFetch<Department>(`/departments/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); setEditDept(null); setName(''); toast.success('Avdeling oppdatert'); },
    onError: () => toast.error('Kunne ikke oppdatere avdeling'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/departments/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); toast.success('Avdeling slettet'); },
    onError: () => toast.error('Kunne ikke slette avdeling'),
  });

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-base font-semibold text-gray-800">Avdelinger</h2>
        <Button size="sm" onClick={() => { setShowCreate(true); setName(''); }}>Ny avdeling</Button>
      </div>

      <Card>
        <CardBody className="p-0">
          {departments.length === 0 ? (
            <p className="text-sm text-gray-500 px-5 py-6 text-center">Ingen avdelinger.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {departments.map((d) => (
                <li key={d.id} className="px-5 py-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{d.name}</span>
                  <div className="flex items-center gap-1">
                    <button
                      aria-label="Rediger"
                      onClick={() => { setEditDept(d); setName(d.name); }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      aria-label="Slett"
                      onClick={() => remove.mutate(d.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Ny avdeling">
        <div className="space-y-4">
          <Input label="Navn" id="dname" value={name} onChange={(e) => setName(e.target.value)} placeholder="F.eks. Marked" />
          <div className="flex gap-3">
            <Button loading={create.isPending} onClick={() => create.mutate()}>Opprett</Button>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Avbryt</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!editDept} onClose={() => setEditDept(null)} title="Rediger avdeling">
        <div className="space-y-4">
          <Input label="Navn" id="editDname" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex gap-3">
            <Button loading={update.isPending} onClick={() => editDept && update.mutate({ id: editDept.id })}>Lagre</Button>
            <Button variant="secondary" onClick={() => setEditDept(null)}>Avbryt</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
