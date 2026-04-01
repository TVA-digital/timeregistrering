import { Role } from './common.js';
export interface Department {
    id: string;
    name: string;
    created_at: string;
}
export interface Group {
    id: string;
    name: string;
    department_id: string;
    created_at: string;
}
export interface User {
    id: string;
    employee_number: string;
    name: string;
    role: Role;
    department_id: string | null;
    department?: Department;
    group_id: string | null;
    group?: Group;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}
export interface CreateUserBody {
    employee_number: string;
    name: string;
    role: Role;
    department_id?: string | null;
    group_id?: string | null;
    email: string;
    password: string;
}
export interface UpdateUserBody {
    name?: string;
    role?: Role;
    department_id?: string | null;
    group_id?: string | null;
    is_active?: boolean;
}
export interface CreateGroupBody {
    name: string;
    department_id: string;
}
export interface UpdateGroupBody {
    name?: string;
    department_id?: string;
}
//# sourceMappingURL=user.d.ts.map