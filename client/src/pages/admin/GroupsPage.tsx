import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { Group, Department, CreateGroupBody, UpdateGroupBody } from '@timeregistrering/shared';
import { toast } from 'sonner';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

type GroupForm = {
  name: string;
  department_id: string;
};

const emptyForm: GroupForm = { name: '', department_id: '' };

export function GroupsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [form, setForm] = useState<GroupForm>(emptyForm);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => apiFetch<Group[]>('/groups'),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => apiFetch<Department[]>('/departments'),
  });

  const createGroup = useMutation({
    mutationFn: (body: CreateGroupBody) =>
      apiFetch<Group>('/groups', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      setShowCreate(false);
      setForm(emptyForm);
      toast.success('Gruppe opprettet');
    },
    onError: () => toast.error('Kunne ikke opprette gruppe'),
  });

  const updateGroup = useMutation({
    mutationFn: ({ id, ...body }: UpdateGroupBody & { id: string }) =>
      apiFetch<Group>(`/groups/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      setEditGroup(null);
      toast.success('Gruppe oppdatert');
    },
    onError: () => toast.error('Kunne ikke oppdatere gruppe'),
  });

  const deleteGroup = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/groups/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] });
      toast.success('Gruppe slettet');
    },
    onError: () => toast.error('Kunne ikke slette gruppe'),
  });

  function openEdit(g: Group) {
    setEditGroup(g);
    setForm({ name: g.name, department_id: g.department_id });
  }

  // Grupper per avdeling
  const departmentMap = new Map(departments.map((d) => [d.id, d.name]));
  const grouped = departments.map((d) => ({
    dept: d,
    groups: groups.filter((g) => g.department_id === d.id),
  })).filter((entry) => entry.groups.length > 0);
  const ungrouped = groups.filter((g) => !departments.some((d) => d.id === g.department_id));

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-base font-semibold text-gray-800">{groups.length} grupper</h2>
        <Button size="sm" onClick={() => { setShowCreate(true); setForm(emptyForm); }}>
          Ny gruppe
        </Button>
      </div>

      <Card>
        <CardBody className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : groups.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              Ingen grupper er opprettet ennå.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Navn</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600 hidden sm:table-cell">Avdeling</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {groups.map((g) => (
                  <tr key={g.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{g.name}</td>
                    <td className="px-5 py-3 text-gray-500 hidden sm:table-cell">
                      {departmentMap.get(g.department_id) ?? '–'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          aria-label="Rediger"
                          onClick={() => openEdit(g)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          aria-label="Slett"
                          onClick={() => { if (confirm(`Slett gruppen «${g.name}»?`)) deleteGroup.mutate(g.id); }}
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
          )}
        </CardBody>
      </Card>

      {/* Opprett gruppe */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Ny gruppe">
        <GroupForm
          form={form}
          setForm={setForm}
          departments={departments}
          onSave={() => createGroup.mutate({ name: form.name, department_id: form.department_id })}
          onClose={() => setShowCreate(false)}
          loading={createGroup.isPending}
        />
      </Modal>

      {/* Rediger gruppe */}
      <Modal open={!!editGroup} onClose={() => setEditGroup(null)} title="Rediger gruppe">
        <GroupForm
          form={form}
          setForm={setForm}
          departments={departments}
          onSave={() => editGroup && updateGroup.mutate({ id: editGroup.id, name: form.name, department_id: form.department_id })}
          onClose={() => setEditGroup(null)}
          loading={updateGroup.isPending}
        />
      </Modal>
    </div>
  );
}

function GroupForm({ form, setForm, departments, onSave, onClose, loading }: {
  form: GroupForm;
  setForm: (f: GroupForm) => void;
  departments: Department[];
  onSave: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-3">
      <Input
        label="Navn"
        id="groupName"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        placeholder="F.eks. Backend"
        required
      />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Avdeling</label>
        <select
          value={form.department_id}
          onChange={(e) => setForm({ ...form, department_id: e.target.value })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Velg avdeling</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-3 pt-2">
        <Button loading={loading} onClick={onSave} disabled={!form.name || !form.department_id}>
          Lagre
        </Button>
        <Button variant="secondary" onClick={onClose}>Avbryt</Button>
      </div>
    </div>
  );
}
