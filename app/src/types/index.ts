// Parwest ERP - Type Definitions

// ============================================
// Core Entity Types
// ============================================

export interface BaseEntity {
  id: string;
  org_id: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// User & Auth Types
// ============================================

export interface User extends BaseEntity {
  email: string;
  full_name: string;
  contact_no?: string;
  is_active: boolean;
  role_id: string;
  regional_office_id?: string;
  avatar_url?: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  is_system: boolean;
}

export interface Permission {
  id: string;
  module: string;
  action: string;
  description?: string;
}

export type PermissionScope = 'all' | 'regional' | 'branch' | 'own';

export interface RolePermission {
  role_id: string;
  permission_id: string;
  scope: PermissionScope;
}

export interface UserScope {
  id: string;
  user_id: string;
  scope_type: 'regional' | 'branch' | 'client';
  scope_id: string;
}

// ============================================
// Guard Types
// ============================================

export type GuardStatus = 
  | 'applicant'
  | 'screening'
  | 'approved'
  | 'onboarding'
  | 'active'
  | 'suspended'
  | 'terminated'
  | 'archived';

export interface Guard extends BaseEntity {
  parwest_id: string;
  name: string;
  father_name: string;
  cnic_no: string;
  dob?: string;
  gender: 'male' | 'female' | 'other';
  marital_status?: string;
  contact_no: string;
  alternate_contact?: string;
  email?: string;
  address?: string;
  regional_office_id: string;
  designation_id: string;
  status: GuardStatus;
  joining_date?: string;
  termination_date?: string;
  personal_info?: Record<string, unknown>;
}

export interface GuardDesignation {
  id: string;
  name: string;
  description?: string;
}

export interface GuardDocument extends BaseEntity {
  guard_id: string;
  document_type_id: string;
  file_path: string;
  file_name: string;
  expiry_date?: string;
  uploaded_by: string;
  metadata?: Record<string, unknown>;
}

export interface GuardVerification extends BaseEntity {
  guard_id: string;
  verification_type: string;
  status: 'pending' | 'verified' | 'failed';
  verified_by?: string;
  verified_at?: string;
  remarks?: string;
}

export interface GuardDeployment extends BaseEntity {
  guard_id: string;
  branch_id: string;
  shift_type: 'day' | 'night' | 'rotational';
  start_date: string;
  end_date?: string;
  is_active: boolean;
  deployed_by: string;
  revoked_by?: string;
  revoke_reason?: string;
}

export interface GuardLoan extends BaseEntity {
  guard_id: string;
  amount: number;
  remaining_amount: number;
  monthly_deduction: number;
  status: 'pending' | 'active' | 'completed' | 'written_off';
  loan_date: string;
  purpose?: string;
  approved_by?: string;
}

// ============================================
// Client Types
// ============================================

export interface Client extends BaseEntity {
  name: string;
  client_type_id: string;
  email?: string;
  phone?: string;
  address?: string;
  regional_office_id: string;
  enrollment_date: string;
  is_active: boolean;
}

export interface ClientBranch extends BaseEntity {
  client_id: string;
  name: string;
  address?: string;
  city?: string;
  province?: string;
  contact_person?: string;
  contact_phone?: string;
  regional_office_id: string;
  is_active: boolean;
}

export interface ClientContract extends BaseEntity {
  client_id: string;
  start_date: string;
  end_date?: string;
  terms?: string;
  is_active: boolean;
}

export interface ContractRate extends BaseEntity {
  contract_id: string;
  guard_type: string;
  rate: number;
  overtime_rate?: number;
}

// ============================================
// Attendance Types
// ============================================

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave' | 'holiday';

export interface GuardAttendance extends BaseEntity {
  guard_id: string;
  branch_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  shift: 'day' | 'night';
  marked_by: string;
  remarks?: string;
  exception_id?: string;
}

export interface LeaveRequest extends BaseEntity {
  guard_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approved_at?: string;
}

// ============================================
// Payroll Types
// ============================================

export type PayrollRunStatus = 
  | 'draft'
  | 'calculated'
  | 'reviewed'
  | 'approved'
  | 'finalized'
  | 'exported';

export interface PayrollRun extends BaseEntity {
  month: number;
  year: number;
  regional_office_id?: string;
  status: PayrollRunStatus;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  finalized_by?: string;
  finalized_at?: string;
}

export interface PayrollItem extends BaseEntity {
  payroll_run_id: string;
  guard_id: string;
  basic_salary: number;
  allowances: Record<string, number>;
  deductions: Record<string, number>;
  gross_pay: number;
  net_pay: number;
  working_days: number;
  present_days: number;
  status: 'pending' | 'calculated' | 'exception' | 'finalized';
}

// ============================================
// Billing Types
// ============================================

export type InvoiceStatus = 
  | 'draft'
  | 'issued'
  | 'sent'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'void';

export interface Invoice extends BaseEntity {
  client_id: string;
  invoice_number: string;
  invoice_month: number;
  invoice_year: number;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: InvoiceStatus;
  issue_date?: string;
  due_date: string;
  sent_at?: string;
}

export interface InvoiceLineItem extends BaseEntity {
  invoice_id: string;
  branch_id: string;
  description: string;
  guard_type?: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface InvoicePayment extends BaseEntity {
  invoice_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_no?: string;
  recorded_by: string;
}

// ============================================
// Inventory Types
// ============================================

export type InventoryStatus = 
  | 'available'
  | 'reserved'
  | 'issued'
  | 'in_service'
  | 'maintenance'
  | 'returned'
  | 'retired'
  | 'lost';

export interface InventoryProduct extends BaseEntity {
  category_id: string;
  product_type_id: string;
  name: string;
  serial_number?: string;
  license_number?: string;
  license_expiry?: string;
  condition: 'new' | 'good' | 'fair' | 'poor';
  status: InventoryStatus;
  regional_office_id: string;
  metadata?: Record<string, unknown>;
}

export interface InventoryAssignment extends BaseEntity {
  product_id: string;
  guard_id?: string;
  branch_id?: string;
  assigned_at: string;
  returned_at?: string;
  assigned_by: string;
  condition_on_assign?: string;
  condition_on_return?: string;
}

// ============================================
// Ticket Types
// ============================================

export type TicketStatus = 
  | 'new'
  | 'triaged'
  | 'in_progress'
  | 'pending_customer'
  | 'resolved'
  | 'closed'
  | 'reopened';

export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Ticket extends BaseEntity {
  title: string;
  description: string;
  category_id: string;
  priority: TicketPriority;
  status: TicketStatus;
  branch_id?: string;
  client_id?: string;
  created_by: string;
  assigned_to?: string;
  resolved_at?: string;
  closed_at?: string;
}

export interface TicketComment extends BaseEntity {
  ticket_id: string;
  content: string;
  is_internal: boolean;
  created_by: string;
}

// ============================================
// Dashboard & Report Types
// ============================================

export interface KPIData {
  label: string;
  value: number | string;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  color?: 'success' | 'warning' | 'error' | 'info';
}

export interface AlertItem {
  id: string;
  type: 'expiry' | 'missing' | 'overdue' | 'exception' | 'warning';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  entity_type?: string;
  entity_id?: string;
  created_at: string;
}

// ============================================
// Workflow Types
// ============================================

export interface WorkflowTransition {
  id: string;
  entity_type: string;
  from_status: string;
  to_status: string;
  required_roles: string[];
  required_fields: string[];
  validation_rules?: Record<string, unknown>;
}

// ============================================
// Audit Types
// ============================================

export interface AuditLog extends BaseEntity {
  entity_type: string;
  entity_id: string;
  action: 'create' | 'update' | 'delete' | 'transition';
  actor_user_id: string;
  before_state?: Record<string, unknown>;
  after_state?: Record<string, unknown>;
  ip_address?: string;
}

// ============================================
// UI Types
// ============================================

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon?: string;
  badge?: number;
  children?: NavItem[];
}

export interface TableColumn<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  width?: string;
  render?: (row: T) => React.ReactNode;
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}
