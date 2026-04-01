export interface AbsenceCode {
  id: string;
  code: string;
  name: string;
  description: string | null;
  requires_approval: boolean;
  deducts_flex: boolean;
  deducts_vacation: boolean;
  allow_clock_out: boolean;
  adds_flex: boolean;
  is_quick_select: boolean;
  is_active: boolean;
  created_at: string;
}

export interface CreateAbsenceCodeBody {
  code: string;
  name: string;
  description?: string;
  requires_approval: boolean;
  deducts_flex: boolean;
  deducts_vacation: boolean;
  allow_clock_out?: boolean;
  adds_flex?: boolean;
  is_quick_select?: boolean;
}

export interface UpdateAbsenceCodeBody {
  name?: string;
  description?: string;
  requires_approval?: boolean;
  deducts_flex?: boolean;
  deducts_vacation?: boolean;
  allow_clock_out?: boolean;
  adds_flex?: boolean;
  is_quick_select?: boolean;
  is_active?: boolean;
}
