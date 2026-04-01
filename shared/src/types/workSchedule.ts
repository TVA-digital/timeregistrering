// weekday: 0=Mandag, 1=Tirsdag, ..., 6=Søndag
export interface WorkScheduleDay {
  id: string;
  schedule_id: string;
  weekday: number;
  hours: number;
}

// Gjenbrukbar mal — ikke knyttet til noen enkeltbruker
export interface WorkSchedule {
  id: string;
  name: string;
  days: WorkScheduleDay[];
  created_at: string;
}

// Kobling bruker ↔ mal med gyldighetsperiode
export interface UserScheduleAssignment {
  id: string;
  user_id: string;
  schedule_id: string;
  effective_from: string;   // YYYY-MM-DD
  effective_to: string | null;
  created_at: string;
  schedule?: WorkSchedule;
}

export interface CreateWorkScheduleBody {
  name: string;
  days: Array<{ weekday: number; hours: number }>;
}

export interface CreateScheduleAssignmentBody {
  user_id: string;
  schedule_id: string;
  effective_from: string;   // YYYY-MM-DD
}
