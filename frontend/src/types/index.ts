export interface User {
  id: number
  username: string
  user_role: 'Admin' | 'Staff'
  created_at: string
}

export interface Customer {
  id: number
  company_name: string
  primary_contact: string | null
  phone: string | null
  email: string | null
}

export interface Site {
  id: number
  customer_id: number
  site_name: string
  site_address: string
  servicem8_client_uuid: string | null
  created_at: string
}

export interface Asset {
  id: number
  site_id: number
  servicem8_asset_uuid: string
  asset_name: string
  serial_number: string | null
  model_number: string | null
  created_at: string
}

export interface ServiceTemplate {
  id: number
  title: string
  parsed_document_text: string
  original_filename: string | null
  historical_average_labor_hours: number
}

export interface MaintenanceSchedule {
  id: number
  asset_id: number
  service_id: number
  estimated_labor_hours: number
  frequency_months: number
  date_last_done: string | null
  date_next_due: string
  permanent_custom_instructions: string | null
  created_at: string
}

export type ApprovalStatus = 'Waiting Approval' | 'Approved' | 'Refused by Customer' | 'Cancelled'
export type SyncStatus = 'Unsynced' | 'In-Progress' | 'Completed' | 'Bypassed'

export interface JobInstance {
  id: number
  schedule_id: number
  target_month_year: string
  approval_status: ApprovalStatus
  refusal_reason: string | null
  sync_status: SyncStatus
  servicem8_job_uuid: string | null
  customer_po_link: string | null
  actual_labor_hours: number | null
  approved_by_user_id: number | null
  created_at: string
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
  last_successful_sync_timestamp: string
}

// Enriched row for the dashboard grid
export interface DashboardRow {
  job: JobInstance
  schedule: MaintenanceSchedule
  asset: Asset
  site: Site
  customer: Customer
  template: ServiceTemplate
}
