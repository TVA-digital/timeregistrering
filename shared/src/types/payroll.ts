export interface PayrollUserRow {
  userId: string;
  employeeNumber: string;
  name: string;
  normalMinutes: number;          // faktisk arbeidstid (minutter)
  absenceByCode: Record<string, number>;   // fraværskode -> timer (planlagt fravær)
  presenceByCode: Record<string, number>;  // tilstedekode -> timer (adds_flex-perioder)
}

export interface PayrollExportQuery {
  from: string; // ISO date
  to: string; // ISO date
  format?: 'xlsx' | 'csv';
}
