import { supabase } from './supabase.js';
import { User, CreateUserBody, UpdateUserBody, Department, Group, CreateGroupBody, UpdateGroupBody } from '@timeregistrering/shared';
import { notFound } from '../utils/errors.js';

const USER_SELECT = '*, department:departments(*), group:groups(*)';

export async function listUsers(departmentId?: string): Promise<User[]> {
  let query = supabase
    .from('users')
    .select(USER_SELECT)
    .order('name');

  if (departmentId) query = query.eq('department_id', departmentId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as User[];
}

export async function getUserById(id: string): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .select(USER_SELECT)
    .eq('id', id)
    .single();

  if (error || !data) throw notFound('Bruker');
  return data as User;
}

export async function createUser(body: CreateUserBody): Promise<User> {
  // Opprett auth-bruker
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
  });

  if (authError || !authData.user) throw authError ?? new Error('Kunne ikke opprette bruker');

  // Opprett profil
  const { data, error } = await supabase
    .from('users')
    .insert({
      id: authData.user.id,
      employee_number: body.employee_number,
      name: body.name,
      role: body.role,
      department_id: body.department_id ?? null,
      group_id: body.group_id ?? null,
    })
    .select(USER_SELECT)
    .single();

  if (error || !data) throw error ?? new Error('Kunne ikke opprette brukerprofil');
  return data as User;
}

export async function updateUser(id: string, body: UpdateUserBody): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .update(body)
    .eq('id', id)
    .select(USER_SELECT)
    .single();

  if (error || !data) throw notFound('Bruker');
  return data as User;
}

// --- Avdelinger ---

export async function listDepartments(): Promise<Department[]> {
  const { data, error } = await supabase.from('departments').select('*').order('name');
  if (error) throw error;
  return (data ?? []) as Department[];
}

export async function createDepartment(name: string): Promise<Department> {
  const { data, error } = await supabase.from('departments').insert({ name }).select().single();
  if (error || !data) throw error ?? new Error('Kunne ikke opprette avdeling');
  return data as Department;
}

export async function updateDepartment(id: string, name: string): Promise<Department> {
  const { data, error } = await supabase
    .from('departments')
    .update({ name })
    .eq('id', id)
    .select()
    .single();

  if (error || !data) throw notFound('Avdeling');
  return data as Department;
}

export async function deleteDepartment(id: string): Promise<void> {
  await supabase.from('departments').delete().eq('id', id);
}

// --- Grupper ---

export async function listGroups(departmentId?: string): Promise<Group[]> {
  let query = supabase
    .from('groups')
    .select('*')
    .order('name');

  if (departmentId) query = query.eq('department_id', departmentId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Group[];
}

export async function createGroup(body: CreateGroupBody): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .insert({ name: body.name, department_id: body.department_id })
    .select()
    .single();

  if (error || !data) throw error ?? new Error('Kunne ikke opprette gruppe');
  return data as Group;
}

export async function updateGroup(id: string, body: UpdateGroupBody): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) throw notFound('Gruppe');
  return data as Group;
}

export async function deleteGroup(id: string): Promise<void> {
  await supabase.from('groups').delete().eq('id', id);
}
