export interface TeamMemberStatus {
  user: {
    id: string;
    name: string;
    employee_number: string;
  };
  flexBalanceMinutes: number;
  activeTimeEntry: {
    id: string;
    clock_in: string;
  } | null;
  activeAbsencePeriod: {
    id: string;
    started_at: string;
    absence_code: {
      id: string;
      name: string;
      adds_flex: boolean;
    };
  } | null;
  absenceMinutesByCode: Record<string, number>; // absence_code_id → minutter i perioden
}
