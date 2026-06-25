# Preventative Maintenance Planning Software - Final Master Technical Specification

## 1. System Architecture & Core Concept
This application functions as a high-speed scheduling engine and middleware bridging a local PostgreSQL database with the ServiceM8 API. 

Because ServiceM8 does not use a multi-site sub-address hierarchy in your setup, our local system will manage the relational logic between a "Customer" and their "Sites." When syncing to ServiceM8, the application translates these local Sites into individual, standalone ServiceM8 Customer records to maintain separation.

To maximize operational speed, the application features an active look-up cache engine to query ServiceM8 data, a custom Client Reporting Engine to produce historical and forecasting summary reports, and performance optimization techniques designed to make the UI feel fast and spreadsheet-like.

---

## 2. Complete Data Management (Full CRUD & Sync Lookup)
Every data entity managed by the platform must have full Create, Read, Update, and Delete capabilities through the React administration dashboard:

* Customers: Create new accounts, search and sync existing ServiceM8 customer profiles, edit details, delete old entries.
* Sites: Link new physical addresses to existing customers, update addresses, delete invalid sites.
* ServiceM8 Assets: Search and import active assets directly from a customer's ServiceM8 account, update asset details locally, remove local links.
* Generic Service Templates: Create templates, upload/re-upload Word docs to modify text, delete retired services.
* Maintenance Schedules: Spin up new recurring contracts, alter frequencies/estimated hours, remove obsolete rules.
* Job Instances & Comments: View monthly jobs, override local approval/sync statuses, delete erroneous line items before dispatch, and add persistent audit logs.

---

## 3. Customer Asset & Maintenance Reporting Engine
The platform includes a reporting module designed to compile and output professional summary reports directly to clients. Staff can select a customer and generate a layout with the following four key sections:

### A. Asset Inventory Summary
* Lists all assets mapped to that specific customer across all their local sites.
* Displays Asset Name, Serial Number, Model Number, and Location.

### B. Scheduling Intervals & Settings
* Shows the active preventative maintenance cadence for each asset (e.g., HVAC Unit 1: Quarterly Service, Fire Extinguisher B: Annual Check).
* Displays the allocated estimated_labor_hours so customers understand the scale of the upcoming work.

### C. Completed & Refused Service History (The Audit Trail)
* A backward-looking ledger showing all past historical job instances matching the assets.
* Completed Status: Displays the exact date completed and total actual labor hours.
* Refused Status: Explicitly displays dates where the customer declined service along with the logged refusal_reason text string. This serves as an official liability shield for the business if a machine suffers a subsequent unmaintained breakdown.

### D. Upcoming Forecasting Schedule
* A forward-looking chronological timeline displaying when new services are next due over the next 6, 12, or 24 months based on active date_next_due constraints.
* Export Options: Reports must be viewable directly on-screen via a clean React print preview container and exportable with a single click to a clean PDF print layout or structured Excel sheet (.xlsx).

---

## 4. ServiceM8 Customer & Asset Lookup Engine
To eliminate duplicate data entry, the creation workspace uses a dual-layered search engine:

### A. Autocomplete Customer Search
* As the user types a customer name, the backend queries the ServiceM8 Company endpoint via an active filter hook (GET /company.json?$filter=name like '%SearchTerm%').
* Selecting a customer imports their details (Name, Phone, Email) and permanently saves their remote company_uuid into our local Site.servicem8_client_uuid field.

### B. Asset Auto-Discovery
* Once a customer/site is matched with a ServiceM8 record, the application triggers a background fetch to download all assets currently linked to that company profile in ServiceM8 (GET /asset.json?$filter=company_uuid eq '{uuid}').
* These assets populate a localized multi-select list. Staff simply tick the boxes of the assets they want to generate recurring schedules for.

---

## 5. Automated & Manual Scheduling Triggers (The Engine)
The application handles the generation of upcoming monthly draft jobs through two explicit code paths:

### A. The Login Initialization Check (Passive Trigger)
* Every time an office staff member logs into the dashboard, a background API request queries the JobInstance database table to look for records matching the following calendar month.
* If zero draft jobs exist for the following month, a soft dismissible alert/banner slides down at the top of the workspace. Clicking this banner automatically runs the generation script.

### B. The Manual Month-Picker Dropdown (Active Trigger)
* At the top of the main Planning Dashboard, a global dropdown menu allows users to select any month and year combination. If the month is empty, an "Initialize Schedule for [Selected Month]" button appears.

---

## 6. Refusal Workflow & Liability Audit Comments
* The Refused by Customer Status: Office staff can mark a monthly job instance as Refused by Customer instead of Approved or Waiting Approval. Any job marked as refused is permanently excluded from being pushed to ServiceM8.
* Mandatory Refusal Text Logging: Selecting the refused status locks out the screen until a text field is populated. Staff must type the direct reason for refusal (e.g., "Customer stated budget constraints"). This string is saved into JobInstance.refusal_reason and appended automatically as an immutable entry inside the JobComment table.

---

## 7. Settings & API Integration Configuration Panel
A secure, dedicated Settings Tab will handle configuration environment variables, core integration parameters, and disaster recovery utilities.

### A. API Credentials & Authentication
* Input fields for OAuth 2.0 application configurations (ServiceM8 App ID & Client Secret) with an instant connection health readout.

### B. Database Backup & Restore Utility
* Manual Backup Button: Triggers an asynchronous execution of a PostgreSQL raw binary schema/data backup script on the Python server (pg_dump).
* Restore Snapshot Module: A secure file drop zone requiring secondary administrative confirmation (e.g., typing "RESTORE" to prevent accidental clicks) before reverting data states.

---

## 8. Security & User Management (Private Network Specification)
Since the application is deployed strictly within a secure local intranet, advanced encryption-at-rest and token rotations are omitted. Security focuses on internal accountability and basic access controls.

* Basic Password Hashing: User passwords will never be stored in plain text. The Python backend will utilize standard bcrypt or Argon2 hashing libraries.
* Two-Tier User Roles (RBAC): Admin (Full structural CRUD, settings, backups, password resets) and Staff (Grid editing, approvals, PO uploads, comments, syncing, reporting).
* Data Handling: Local database tables inside PostgreSQL will remain unencrypted at rest to ensure maximum database query performance and simpler server troubleshooting. Admin users can manually run password resets for users directly within their profiles.

---

## 9. Relational Data Models & Database Schema

Data Relationship Hierarchy:
[Local Customer] -> [Local Site] -> [SM8 Asset Mapping] -> [Maintenance Schedule] -> [Job Instance] -> [Job Comment]

PostgreSQL DDL Database Schema Script:

CREATE TABLE app_settings (
    id SERIAL PRIMARY KEY,
    servicem8_client_id VARCHAR(255) NOT NULL,
    servicem8_client_secret VARCHAR(255) NOT NULL,
    file_storage_bucket VARCHAR(255) NOT NULL,
    generation_buffer_days INT DEFAULT 14,
    last_successful_sync_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE database_backup_log (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    user_role VARCHAR(20) NOT NULL CHECK (user_role IN ('Admin', 'Staff')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    primary_contact VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255)
);

CREATE TABLE sites (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
    site_name VARCHAR(255) NOT NULL,
    site_address TEXT NOT NULL,
    servicem8_client_uuid VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE service_templates (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    parsed_document_text TEXT NOT NULL,
    historical_average_labor_hours NUMERIC(5, 2) DEFAULT 0.00
);

CREATE TABLE assets (
    id SERIAL PRIMARY KEY,
    site_id INT REFERENCES sites(id) ON DELETE CASCADE,
    servicem8_asset_uuid VARCHAR(255) UNIQUE NOT NULL,
    asset_name VARCHAR(255) NOT NULL,
    serial_number VARCHAR(100),
    model_number VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE maintenance_schedules (
    id SERIAL PRIMARY KEY,
    asset_id INT REFERENCES assets(id) ON DELETE CASCADE,
    service_id INT REFERENCES service_templates(id) ON DELETE RESTRICT,
    estimated_labor_hours NUMERIC(4, 2) NOT NULL,
    frequency_months INT NOT NULL,
    date_last_done DATE,
    date_next_due DATE NOT NULL,
    permanent_custom_instructions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE job_instances (
    id SERIAL PRIMARY KEY,
    schedule_id INT REFERENCES maintenance_schedules(id) ON DELETE CASCADE,
    target_month_year VARCHAR(7) NOT NULL,
    approval_status VARCHAR(30) DEFAULT 'Waiting Approval' CHECK (approval_status IN ('Waiting Approval', 'Approved', 'Refused by Customer', 'Cancelled')),
    refusal_reason TEXT,
    sync_status VARCHAR(20) DEFAULT 'Unsynced' CHECK (sync_status IN ('Unsynced', 'In-Progress', 'Completed', 'Bypassed')),
    servicem8_job_uuid VARCHAR(255) UNIQUE,
    customer_po_link VARCHAR(500),
    actual_labor_hours NUMERIC(5, 2) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE job_comments (
    id SERIAL PRIMARY KEY,
    job_instance_id INT REFERENCES job_instances(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    comment_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_job_instances_month ON job_instances(target_month_year);
CREATE INDEX idx_job_instances_approval ON job_instances(approval_status);
CREATE INDEX idx_assets_site ON assets(site_id);
CREATE INDEX idx_schedules_next_due ON maintenance_schedules(date_next_due);

---

## 10. High-Speed Performance & Frontend Optimization Architecture
To guarantee that the user interface feels incredibly snappy and fast for office staff—even when rendering thousands of asset schedules across active months—the frontend and backend must implement these structural design guidelines:

### A. DOM Virtualization (High-Density Spreadsheet Performance)
* The Problem: Rendering hundreds of tabular rows with individual dropdown selections, interactive textual inputs, and operational action buttons directly into the browser DOM will cause severe interface lag and scrolling stutter.
* The Solution: The primary React scheduling grid must utilize Row Virtualization (via libraries like @tanstack/react-virtual). Virtualization ensures only the rows currently visible inside the viewport (plus a small off-screen buffer window) are actively rendered. As the user scrolls, rows are dynamically recycled, maintaining a lightweight DOM footprint and liquid-smooth interactions at 60 FPS.

### B. Optimistic UI Updates
* The Problem: Waiting for an API network round-trip from the server every time a staff member toggles an "Approved" status checkbox or updates an estimated hour cell makes table workflows feel slow and staggered.
* The Solution: The React app will apply Optimistic Updates. When a user modifies a data cell, the local state engine instantly shifts the UI to its expected success state without showing loading spinners. If the backend patch network task fails, a background exception handler catches the error, rolls back the local visual variation, and highlights the target row with a clear synchronization failure alert.

### C. Input State Debouncing
* The Problem: Re-rendering an entire active data grid panel on every single individual keystroke when staff write out permanent_custom_instructions causes typing latency.
* The Solution: Text inputs inside the grid cells must be decoupled from the immediate global state tree using local useState variables combined with a text debounce timer (e.g., 300ms) or handled completely via standard onBlur event listeners. Changes are committed to the global state data array only after the user pauses typing or changes context out of the active cell.

### D. Cached Queries & Local Data Store
* The Solution: Integrate data-fetching state management libraries like TanStack Query (React Query) on the frontend. Once a specific client asset inventory profile or historical report log is pulled from the Python backend API, it is cached in system memory. If the staff user switches navigation views and returns, the dataset renders instantly without a spinning loading wheel, while a background sync quietly verifies if data changes occurred. Autocomplete search fields are debounced by 200ms to throttle excessive backend hits during lookups.

---

## 11. High-Speed React UI Components & Layout Mockup

### Main Planning Dashboard Blueprint View
| [PM Planner]  Dashboard    Customers    Templates    Settings [Connected: ServiceM8]  (Admin) |
| Warning: Next Month's Schedule Missing: Maintenance jobs for July 2026 are not initialized. [Run Now] |
| View Month: [ July 2026 |v]     Filter Staff: [ All |v]      [ Save Batch Updates (3 Changes) ] |
| Customer / Site | Asset Name | Template Type | Est. Hours | Instructions / Notes |
| Apex Manufacturing -> North Warehouse | Chiller Unit #1 | HVAC Quarterly | [ 3.50 ] | [Check filter lines..] [Comment Icon] |
| Apex Manufacturing -> North Warehouse | Atlas Compressor | Air Annual | [ 2.00 ] | [Blown down receiver.] [Comment Icon] |
| Global Logistics -> Terminal 4 | Forklift Dock #3 | Hydraulic Sync | [ 1.75 ] | [Review fluid seals. ] [Comment Icon] |
| Bondi Cafes -> Campbell St Hub | Espresso Pro X | 6-Mo Baseline | [ 1.00 ] | [Refused by Customer ] [Warning Icon] -> "Budget frozen" |
| Items: 142 | Approved: 118 | Refused: 4 | Unsynced: 20 | [ Sync Approved to ServiceM8 ] |

### Drawer Panel: Job Comments & Audit Trail
* Close (X) AUDIT LOG: Chiller Unit #1 (Apex Mfg)
* Permanent Custom Instructions: Check filter lines for micro-fissures and clean scaling.
* Job Comments History:
  - Sarah T. (Office Staff) - 14/05/2026 10:15 AM: "Spoke with site contact Bob. He requests that technicians arrive only after 2 PM due to delivery windows."
  - Tech Time Clock Data (Aggregated from SM8) - 12/02/2026: Job Completed. Run-time logged: 3.45 Hours.
* Write a comment textbox input window -> [ Add Note Button ]

### A. Client Report Generator Panel
* A structured interface containing a Customer selector dropdown, a Date-Range filter, and toggles for columns.
* Features a stylized preview window that structures the data visually exactly like the final target output print format before generating the export download files.

### B. Dynamic Search & Linker Dropdowns
* Implements an asynchronous search combobox that triggers non-blocking API lookups to the Python backend as users type customer names to link live ServiceM8 client and asset nodes.

---

## 12. Backend Processing & ServiceM8 API Integration (Python / FastAPI)

### A. Document Parsing Engine
Uses Python libraries like python-docx to extract text from templates.

Code workflow example:
from docx import Document
def extract_service_text(file_stream):
    doc = Document(file_stream)
    return "
".join([para.text for para in doc.paragraphs if para.text.strip()])

### B. Report Compilation & Export Workers
* Python utilities map relational joins to create structured JSON records.
* Integrates layout generation libraries (WeasyPrint for automated PDF formatting, and pandas / openpyxl to compile structured spreadsheet arrays) to return downloadable data files.

### C. Strict One-Job-Per-Asset Dispatch Loop
* When the global "Send Unsynced Jobs" trigger is pulled, if a site has 3 assets due, the backend executes 3 distinct API requests sequentially. It filters out any rows flagged as Refused by Customer.

### D. Labor Hours Consolidation Loop
* Queries JobActivity upon completion to sum the durations of all worker entries regardless of individual billing tiers, updating the historical average complexity fields locally.

---

## 13. Testing Strategy
* Performance Benchmark Testing: Performance monitoring to verify the React virtualized list handles rendering scaling cleanly without causing dropped frames or high latency profiles during cell text modifications.
* Reporting Boundary & Empty State Validation: Validating that compiling reports for completely new clients with zero history gracefully creates clean headers and blank states without dropping database syntax execution errors.
* Lookup Mock Validation: Testing search boundaries by mocking data delay scenarios to ensure typing inside the autocomplete UI doesn't drop keystrokes or trigger overlapping API race conditions.

---

## 14. Deployment Roadmap
* Phase 1 (Database, Models & CRUD API): Establish the local PostgreSQL structural database tables, code the manual/automated month initialization algorithms, and bundle the .docx document extractor.
* Phase 2 (Dashboard View, Autocomplete Engine & Handshaking): Design the fast interactive scheduling grid, live customer autocomplete dropdowns, asset check-list tools, and alert banners in React.
* Phase 3 (Reporting Engine, Individual Dispatch & Operational Validation Loops): Build out the server-side report compilation array to generate downloadable PDFs/Excel worksheets and hook up final worker loops monitoring tech clock-ins.
