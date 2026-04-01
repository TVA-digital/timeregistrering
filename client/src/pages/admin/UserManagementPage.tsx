import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { User, Department, Group, Role, WorkSchedule, UserScheduleAssignment } from '@timeregistrering/shared';
import { toast } from 'sonner';
import { Card, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { PencilIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';

const roleLabels: Record<Role, string> = {
  ansatt: 'Ansatt',
  leder: 'Leder',
  fagleder: 'Fagleder',
  admin: 'Administrator',
  lonningsansvarlig: 'Lønningsansvarlig',
};

interface UserForm {
  employee_number: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  department_id: string;
  group_id: string;
}

const emptyForm: UserForm = {
  employee_number: '',
  name: '',
  email: '',
  password: '',
  role: 'ansatt',
  department_id: '',
  group_id: '',
};

// ---- Arbeidsplan-seksjon inne i redigeringsmodalen ----
function ScheduleSection({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const { data: allSchedules = [] } = useQuery({
    queryKey: ['work-schedules'],
    queryFn: () => apiFetch<WorkSchedule[]>('/work-schedules'),
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['work-schedules', 'assignments', userId],
    queryFn: () =>
      apiFetch<UserScheduleAssignment[]>(`/work-schedules/assignments?userId=${userId}`),
    enabled: !!userId,
  });

  const activeAssignment = assignments.find((a) => a.effective_to === null);

  const assign = useMutation({
    mutationFn: () =>
      apiFetch<UserScheduleAssignment>('/work-schedules/assignments', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          schedule_id: selectedScheduleId,
          effective_from: effectiveFrom,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-schedules', 'assignments', userId] });
      setSelectedScheduleId('');
      toast.success('Arbeidsplan tilordnet');
    },
    onError: () => toast.error('Kunne ikke tilordne arbeidsplan'),
  });

  return (
    <div className="border-t border-gray-100 pt-4 mt-1">
      <p className="text-sm font-semibold text-gray-700 mb-2">Arbeidsplan</p>

      {/* Aktiv tilordning */}
      {activeAssignment ? (
        <div className="text-sm text-gray-700 mb-3 bg-gray-50 rounded-lg px-3 py-2">
          <span className="font-medium">{activeAssignment.schedule?.name}</span>
          <span className="text-gray-500 ml-2">
            (gyldig fra{' '}
            {format(new Date(activeAssignment.effective_from), 'd. MMM yyyy', { locale: nb })})
          </span>
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic mb-3">Ingen arbeidsplan satt</p>
      )}

      {/* Tilordne ny plan */}
      {allSchedules.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Tilordne ny plan
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={selectedScheduleId}
              onChange={(e) => setSelectedScheduleId(e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">– Velg arbeidsplan –</option>
              {allSchedules.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <Button
            size="sm"
            loading={assign.isPending}
            disabled={!selectedScheduleId}
            onClick={() => assign.mutate()}
          >
            Tilordne
          </Button>
        </div>
      )}
    </div>
  );
}

export function UserManagementPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<User[]>('/users'),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => apiFetch<Department[]>('/departments'),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: () => apiFetch<Group[]>('/groups'),
  });

  const createUser = useMutation({
    mutationFn: (body: UserForm) => apiFetch<User>('/users', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setShowCreate(false); setForm(emptyForm); toast.success('Bruker opprettet'); },
    onError: () => toast.error('Kunne ikke opprette bruker'),
  });

  const updateUser = useMutation({
    mutationFn: ({ id, ...body }: Partial<UserForm> & { id: string }) =>
      apiFetch<User>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setEditUser(null); toast.success('Bruker oppdatert'); },
    onError: () => toast.error('Kunne ikke oppdatere bruker'),
  });

  function openEdit(user: User) {
    setEditUser(user);
    setForm({ ...emptyForm, name: user.name, role: user.role, department_id: user.department_id ?? '', group_id: user.group_id ?? '' });
  }

  // Grupper filtrert på valgt avdeling
  const filteredGroups = form.department_id
    ? groups.filter((g) => g.department_id === form.department_id)
    : groups;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-base font-semibold text-gray-800">{users.length} brukere</h2>
        <Button size="sm" onClick={() => { setShowCreate(true); setForm(emptyForm); }}>
          Legg til bruker
        </Button>
      </div>

      <Card>
        <CardBody className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : (
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Navn</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600 hidden sm:table-cell">Nr.</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600 hidden md:table-cell">Avdeling / Gruppe</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Rolle</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{u.name}</td>
                    <td className="px-5 py-3 text-gray-500 hidden sm:table-cell">{u.employee_number}</td>
                    <td className="px-5 py-3 text-gray-500 hidden md:table-cell">
                      <div>{u.department?.name ?? '–'}</div>
                      {u.group && <div className="text-xs text-gray-400">{u.group.name}</div>}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{roleLabels[u.role]}</td>
                    <td className="px-5 py-3">
                      <Badge variant={u.is_active ? 'green' : 'gray'}>
                        {u.is_active ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        aria-label="Rediger"
                        onClick={() => openEdit(u)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      {/* Opprett bruker */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Legg til bruker">
        <div className="space-y-3">
          <Input label="Navn" id="name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
          <Input label="Ansattnummer" id="empno" value={form.employee_number} onChange={(e) => setForm(f => ({ ...f, employee_number: e.target.value }))} required />
          <Input label="E-post" id="email" type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} required />
          <Input label="Passord" id="password" type="password" value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} required />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rolle</label>
            <select value={form.role} onChange={(e) => setForm(f => ({ ...f, role: e.target.value as Role }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              {(Object.entries(roleLabels) as [Role, string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Avdeling</label>
            <select value={form.department_id} onChange={(e) => setForm(f => ({ ...f, department_id: e.target.value, group_id: '' }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Ingen</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          {filteredGroups.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gruppe</label>
              <select value={form.group_id} onChange={(e) => setForm(f => ({ ...f, group_id: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">Ingen</option>
                {filteredGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button loading={createUser.isPending} onClick={() => createUser.mutate(form)}>Opprett</Button>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Avbryt</Button>
          </div>
        </div>
      </Modal>

      {/* Rediger bruker */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Rediger bruker">
        <div className="space-y-3">
          <Input label="Navn" id="editName" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rolle</label>
            <select value={form.role} onChange={(e) => setForm(f => ({ ...f, role: e.target.value as Role }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              {(Object.entries(roleLabels) as [Role, string][]).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Avdeling</label>
            <select value={form.department_id} onChange={(e) => setForm(f => ({ ...f, department_id: e.target.value, group_id: '' }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Ingen</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          {filteredGroups.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gruppe</label>
              <select value={form.group_id} onChange={(e) => setForm(f => ({ ...f, group_id: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">Ingen</option>
                {filteredGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          )}

          {/* Arbeidsplan-seksjon */}
          {editUser && <ScheduleSection userId={editUser.id} />}

          <div className="flex gap-3 pt-2">
            <Button loading={updateUser.isPending}
              onClick={() => editUser && updateUser.mutate({
                id: editUser.id,
                name: form.name,
                role: form.role,
                department_id: form.department_id || undefined,
                group_id: form.group_id || undefined,
              })}>
              Lagre
            </Button>
            <Button variant="secondary" onClick={() => setEditUser(null)}>Avbryt</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
