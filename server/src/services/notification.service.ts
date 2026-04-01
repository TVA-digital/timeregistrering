import { supabase } from './supabase.js';
import { Notification, NotificationType } from '@timeregistrering/shared';

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  relatedId?: string,
  relatedType?: string,
): Promise<void> {
  await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    message,
    related_id: relatedId ?? null,
    related_type: relatedType ?? null,
  });
}

// Varsle alle ledere i en avdeling
export async function notifyLeadersInDepartment(
  departmentId: string | null,
  type: NotificationType,
  title: string,
  message: string,
  relatedId?: string,
  relatedType?: string,
): Promise<void> {
  let query = supabase.from('users').select('id').eq('is_active', true);

  if (departmentId) {
    query = query.in('role', ['leder', 'admin']).eq('department_id', departmentId);
  } else {
    query = query.in('role', ['leder', 'admin']);
  }

  const { data: leaders } = await query;
  if (!leaders || leaders.length === 0) return;

  const notifications = leaders.map((l: { id: string }) => ({
    user_id: l.id,
    type,
    title,
    message,
    related_id: relatedId ?? null,
    related_type: relatedType ?? null,
  }));

  await supabase.from('notifications').insert(notifications);
}

/**
 * Varsler leder (via department_id) og fagleder (via group_id) for en gitt ansatt.
 * Brukes bl.a. ved AML-brudd der både leder og fagleder skal informeres.
 */
export async function notifyTeamLeadersForUser(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  relatedId?: string,
  relatedType?: string,
): Promise<void> {
  // Hent den ansattes avdeling og gruppe
  const { data: employee } = await supabase
    .from('users')
    .select('department_id, group_id')
    .eq('id', userId)
    .single();

  if (!employee) return;

  const recipients: { id: string }[] = [];

  // Leder i samme avdeling
  if (employee.department_id) {
    const { data: leaders } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'leder')
      .eq('department_id', employee.department_id)
      .eq('is_active', true);
    if (leaders) recipients.push(...leaders);
  }

  // Fagleder i samme gruppe
  if (employee.group_id) {
    const { data: fagledere } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'fagleder')
      .eq('group_id', employee.group_id)
      .eq('is_active', true);
    if (fagledere) recipients.push(...fagledere);
  }

  if (recipients.length === 0) return;

  // Dedupliser i tilfelle samme person har begge roller
  const uniqueIds = [...new Set(recipients.map((r) => r.id))];
  const notifications = uniqueIds.map((id) => ({
    user_id: id,
    type,
    title,
    message,
    related_id: relatedId ?? null,
    related_type: relatedType ?? null,
  }));

  await supabase.from('notifications').insert(notifications);
}

// Varsle alle lønningsansvarlige
export async function notifyPayrollUsers(
  type: NotificationType,
  title: string,
  message: string,
): Promise<void> {
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'lonningsansvarlig')
    .eq('is_active', true);

  if (!users || users.length === 0) return;

  const notifications = users.map((u: { id: string }) => ({
    user_id: u.id,
    type,
    title,
    message,
    related_id: null,
    related_type: null,
  }));

  await supabase.from('notifications').insert(notifications);
}

export async function listNotifications(
  userId: string,
  unreadOnly = false,
): Promise<Notification[]> {
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (unreadOnly) {
    query = query.eq('is_read', false);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Notification[];
}

export async function markAsRead(notificationId: string, userId: string): Promise<void> {
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);
}

export async function markAllAsRead(userId: string): Promise<void> {
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  return count ?? 0;
}
