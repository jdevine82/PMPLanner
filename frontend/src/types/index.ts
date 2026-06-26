export interface User {
  id: number
  username: string
  user_role: 'Admin' | 'Staff' | 'Worker'
  created_at: string
}

export interface Customer {
  id: number
  company_name: string
  primary_contact: string | null
  phone: string | null
  email: string | null
  servicem8_uuid: string | null
}

export interface Site {
  id: number
  customer_id: number
  site_name: string
  site_address: string
  servicem8_client_uuid: string | null
  created_at: string
}

export interface SiteLocation {
  id: number
  site_id: number
  name: string
  created_at: string
}

export interface Asset {
  id: number
  site_id: number
  location_id: number | null
  servicem8_asset_uuid: string | null
  asset_name: string
  serial_number: string | null
  model_number: string | null
  is_catch_all: boolean
  created_at: string
}

export interface TemplateAttachment {
  label: string
  url: string
}

export interface SM8Badge {
  uuid: string
  name: string
  file_name: string
}

export interface ServiceTemplate {
  id: number
  title: string
  parsed_document_text: string
  original_filename: string | null
  interval_months: number | null
  default_estimated_labor_hours: number | null
  historical_average_labor_hours: number
  job_description: string | null
  work_completed: string | null
  attachments: TemplateAttachment[] | null
  job_badges: SM8Badge[] | null
}

export interface MaintenanceSchedule {
  id: number
  asset_id: number
  service_id: number
  estimated_labor_hours: number
  frequency_months: number
  date_last_done: string | null
  date_next_due: string
  date_anchor_next_due?: string | null
  permanent_custom_instructions: string | null
  sm8_group_tag: string | null
  created_at: string
}

export type ApprovalStatus = 'Waiting Approval' | 'Approved' | 'Refused by Customer' | 'Cancelled'
export type SyncStatus = 'Unsynced' | 'In-Progress' | 'Completed' | 'Bypassed'

export type CombinedStatus =
  | 'Pending Approval'
  | 'Approved'
  | 'Sent to SM8'
  | 'Job in Progress'
  | 'Completed'
  | 'Refused by Customer'
  | 'Done (no SM8)'

export interface PriorIncompleteJob {
  month: string
  approval_status: ApprovalStatus
  sync_status: SyncStatus
}

export interface JobInstance {
  id: number
  schedule_id: number
  target_month_year: string
  approval_status: ApprovalStatus
  refusal_reason: string | null
  sync_status: SyncStatus
  servicem8_job_uuid: string | null
  servicem8_job_number: number | null
  assettracker_wo_id: number | null
  customer_po_link: string | null
  actual_labor_hours: number | null
  approved_by_user_id: number | null
  created_at: string
  prior_incomplete_job: PriorIncompleteJob | null
}

export interface JobComment {
  id: number
  job_instance_id: number
  user_id: number | null
  comment_text: string
  is_system_generated: boolean
  created_at: string
}

export interface MonthInitResult {
  target_month_year: string
  created_count: number
  already_existed: number
}

export interface AppSetting {
  id: number
  servicem8_api_key: string
  file_storage_path: string
  generation_buffer_days: number
  monthly_capacity_hours: number
  business_name: string | null
  logo_filename: string | null
  last_successful_sync_timestamp: string
  assettracker_enabled: boolean
  assettracker_base_url: string | null
  assettracker_email: string | null
  assettracker_default_asset_id: number | null
}

export interface Project {
  id: number
  name: string
  description: string | null
  month_hours: Record<string, number>
  created_at: string
}

export interface ProjectCreate {
  name: string
  description?: string | null
  month_hours: Record<string, number>
}

export interface ProjectUpdate {
  name?: string
  description?: string | null
  month_hours?: Record<string, number>
}

// Enriched row for the dashboard grid
export interface DashboardRow {
  job: JobInstance
  schedule: MaintenanceSchedule
  asset: Asset
  site: Site
  customer: Customer
  template: ServiceTemplate
  // Present when multiple assets share an sm8_group_tag — includes ALL rows in the group (including self)
  groupedRows?: DashboardRow[]
}
