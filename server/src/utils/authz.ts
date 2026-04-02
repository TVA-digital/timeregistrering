import { supabase } from '../services/supabase.js';
import { forbidden } from './errors.js';
import { User } from '@timeregistrering/shared';

/**
 * Throws 403 if `viewer` is not allowed to inspect `targetUserId`'s data.
 * Admins can view everyone. Ledere can view their own department. Fagledere can view their own group.
 */
export async function assertCanViewUser(viewer: User, targetUserId: string): Promise<void> {
  if (viewer.role === 'admin') return;

  if (viewer.role !== 'leder' && viewer.role !== 'fagleder') throw forbidden();

  const { data: target } = await supabase
    .from('users')
    .select('department_id, group_id')
    .eq('id', targetUserId)
    .single();

  if (!target) throw forbidden();

  if (viewer.role === 'fagleder') {
    if (!viewer.group_id || target.group_id !== viewer.group_id) throw forbidden();
  } else {
    // leder
    if (!viewer.department_id || target.department_id !== viewer.department_id) throw forbidden();
  }
}
