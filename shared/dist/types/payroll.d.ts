export interface PayrollUserRow {
    userId: string;
    employeeNumber: string;
    name: string;
    normalMinutes: number;
    absenceByCode: Record<string, number>;
    presenceByCode: Record<string, number>;
}
export interface PayrollExportQuery {
    from: string;
    to: string;
    format?: 'xlsx' | 'csv';
}
//# sourceMappingURL=payroll.d.ts.map