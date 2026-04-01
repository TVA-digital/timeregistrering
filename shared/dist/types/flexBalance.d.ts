export interface FlexBalance {
    user_id: string;
    balance_minutes: number;
    updated_at: string;
}
export interface FlexTransaction {
    id: string;
    user_id: string;
    time_entry_id: string | null;
    absence_request_id: string | null;
    minutes: number;
    description: string;
    created_at: string;
}
//# sourceMappingURL=flexBalance.d.ts.map