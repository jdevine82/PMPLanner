# PMPlanner — User Guide

PMPlanner is a preventative maintenance scheduling tool. It tracks which customers need servicing, generates job lists for the upcoming month, and integrates with ServiceM8 for dispatching and completion tracking.

---

## User Roles

| Role | Access |
|---|---|
| **Admin** | Full access to all features including Users page, Settings, and destructive actions |
| **Staff** | Can create and edit most records; cannot delete projects or access Settings |
| **Worker** | Read-only view of the dashboard and customer data; cannot change statuses or create records |

---

## Pages Overview

### Dashboard

The main working view for each month. It shows every maintenance job due or in progress for the selected month.

**Selecting a month**
- Use the month picker in the top bar to jump to any month.
- The dashboard defaults to the next calendar month so you are always planning ahead.

**Refreshing jobs**
- Click **Refresh Jobs** to generate draft job entries for any maintenance schedules that are due this month but have not yet been created.
- This is safe to run multiple times — it will not duplicate existing jobs.

**Missing month banner**
- If jobs have not been initialized for the selected month, a yellow banner appears at the top. Click **Initialize** to create them.

**Job statuses**

Each job moves through the following statuses:

| Status | Meaning |
|---|---|
| Pending Approval | Newly created — waiting for customer sign-off |
| Approved | Customer has approved — ready to dispatch |
| Sent to SM8 | Dispatched to ServiceM8 as a job |
| Job in Progress | Technician has logged hours in ServiceM8 |
| Completed | Marked complete in ServiceM8 |
| Refused by Customer | Customer declined the work this cycle |
| Done (no SM8) | Completed without going through ServiceM8 |

Statuses set by ServiceM8 sync (Sent to SM8, Job in Progress) are shown greyed out in the picker — they are updated automatically when you sync.

**Syncing with ServiceM8**
- Click **Sync SM8** to pull current job status and labor hours back from ServiceM8.
- A preview modal shows what will change before you confirm.

**Job detail drawer**
- Click any job row to open the detail drawer on the right.
- From here you can view job notes, add comments, enter actual labor hours, and see any prior incomplete jobs for the same asset.

**Workload forecast**
- The footer shows total estimated vs. actual labor hours for the month across all jobs.

---

### Customers

Manages the three-level hierarchy: **Customer → Site → Asset**.

**Customers**
- Each customer represents a company or individual client.
- If ServiceM8 is connected, customers can be linked to a ServiceM8 company record via the search button.

**Sites**
- A customer can have multiple sites (physical locations).
- Each site has an address and can be linked to a ServiceM8 client UUID.

**Site Locations**
- Within a site you can define named locations (e.g., "Rooftop", "Plant Room") to organise assets.

**Assets**
- An asset is a piece of equipment at a site (e.g., a specific air conditioning unit).
- Assets have a serial number, model, and install date.
- If AssetTracker integration is enabled, assets can be linked to AssetTracker records and their details pulled in automatically.

**Maintenance schedules**
- Each asset can have one or more maintenance schedules.
- A schedule links an asset to a service template and defines how often the work should be done (frequency in months).
- **Add New Program** (the wizard) walks you through creating a schedule in four steps: Customer → Site → Asset → Schedule details.

**Service schedule calendar**

When an asset has more than one schedule (e.g. a 3-monthly and a 12-monthly service), the schedule edit form shows an 18-month calendar grid. Each month cell indicates:

| Colour | Meaning |
|---|---|
| Blue | This schedule runs this month |
| Green | Another schedule on this asset runs this month |
| Orange | This schedule is due but superseded by a longer-interval service |
| Gray | No service due this month |

A suggestion message appears below the calendar if the first occurrence of the schedule you are editing falls in the same month as a larger-interval service (meaning it would be skipped). The message shows the next clean month to start from.

**Service link groups**

Location services (site-wide services not tied to a specific asset) can be coordinated across multiple service entries by assigning them the same **link group** name. Schedules sharing a link group at the same site participate in the same skip logic — in any month where more than one linked service falls due, only the longest-interval one runs and the others are automatically advanced to their next cycle.

To assign a link group, type a name in the **Link group** field when editing a schedule. A dropdown shows existing group names already in use at that site. To create a new group, simply type a new name and save. Link groups are scoped to the site — the same name at a different location has no effect on this one.

**Reading the asset list**
- Assets show a colored dot indicating the status of their active jobs for the current month.
- A warning icon appears if a prior month's job for that asset was not completed.

---

### Templates

Service templates define the *type* of work to be done. Each schedule references a template.

**Template fields**
| Field | Description |
|---|---|
| Title | Short name shown throughout the app (e.g., "Quarterly Filter Service") |
| Default interval | Suggested frequency in months; auto-fills when creating a schedule |
| Default estimated hours | Pre-fills the labor estimate on new schedules |
| SM8 Job Description | Text sent to ServiceM8 when a job is dispatched |
| SM8 Badge | A ServiceM8 category/badge tag applied to dispatched jobs |
| SM8 Group Tag | Used to group related jobs in ServiceM8 |
| Attachments | Documents or links attached to the ServiceM8 job (e.g., service manual URL) |

**Linking to ServiceM8**
- Use the SM8 sync button on a template to pull in job description text directly from a ServiceM8 job type.

---

### Reports

Generates a formatted maintenance report for a selected customer.

**How to generate a report**
1. Select a customer from the dropdown (only customers with active schedules appear).
2. Choose the forecast horizon (3, 6, or 12 months).
3. The report preview loads automatically.
4. Use **Download PDF** to save a formatted document, or **Download Excel** to export the data as a spreadsheet.

**Incomplete prior jobs**
- The **Incomplete Prior Jobs** button shows a list of jobs from previous months that were never marked complete. Use this as a checklist before generating a report.

---

### Projects

A lightweight project tracker for work that does not fit into the regular maintenance schedule.

**Creating a project**
- Click **New Project** and fill in the name, description, customer, due date, and status.

**Project statuses**
- Planned, In Progress, On Hold, Completed, Cancelled

**Permissions**
- Admin and Staff users can create and edit projects.
- Only Admin users can delete a project.

---

### Users *(Admin only)*

Manage who can log in to PMPlanner.

**Creating a user**
1. Click **Add User**.
2. Enter a username, password, and role.
3. Click **Create**.

**Editing a user**
- Click the edit icon next to any user to change their password or role.
- You cannot change a username after creation.

**Roles available:** Admin, Staff, Worker (see Role table at the top of this guide).

---

### Settings *(Admin only)*

**Branding**
- Set your **business name** — appears in generated reports.
- Upload a **logo** (PNG or JPEG, max 20 MB) — appears in report headers.

**ServiceM8 Integration**
- Paste your ServiceM8 API key to enable syncing and dispatching.
- Set the **generation buffer days** — how many days in advance of a job's due date it will appear in the month's job list.
- Set **monthly capacity hours** — used by the workload forecast footer to show how much of the month's capacity is consumed.

**Database Backup & Restore**
- **Create Backup** generates a `.sql` dump of the entire database and saves it server-side.
- The backup list shows all saved backups with their timestamps.
- Click the download icon to download a backup file locally.
- Click the restore icon next to a backup, then confirm, to roll the database back to that point. The app will reload automatically.

> Restore is irreversible. Download a current backup before restoring an older one.

**Labor Hours Consolidation**
- After marking jobs complete, run consolidation to roll up actual hours into summary records used by reports and the forecast footer.

**AssetTracker Integration**
- Enter your AssetTracker API URL and API key to link assets between the two systems.
- Once connected, asset records in PMPlanner can be pulled from AssetTracker by UUID.
- The **Dispatch** flow sends updated asset service records back to AssetTracker when jobs are completed.
- The **Pull Completed** action imports job completion data from AssetTracker for assets that were serviced outside PMPlanner.

---

## Common Workflows

### Setting up a new customer from scratch

1. Go to **Customers** → **Add Customer**, fill in the company name.
2. Inside the customer, click **Add Site**, enter the address.
3. Inside the site, click **Add Asset**, enter equipment details.
4. Click **Add New Program** (or the wizard icon) to create a maintenance schedule for the asset.
5. On the Dashboard for the relevant month, click **Refresh Jobs** — a job for the new schedule will appear.

### Dispatching a month's jobs to ServiceM8

1. On the Dashboard, ensure all jobs you want to dispatch are set to **Approved**.
2. Click **Sync SM8**.
3. Review the preview — it shows which jobs will be created or updated in ServiceM8.
4. Confirm. The jobs move to **Sent to SM8**.

### Marking a job complete without ServiceM8

1. Open the job row on the Dashboard.
2. Change the status to **Done (no SM8)**.
3. Enter actual labor hours in the detail drawer if relevant.

### Generating a customer report

1. Go to **Reports**.
2. Select the customer and forecast period.
3. Click **Download PDF** or **Download Excel**.

### Handling a customer refusal

1. On the Dashboard, change the job status to **Refused by Customer**.
2. A dialog will prompt for a refusal reason — enter the customer's explanation.
3. The job is recorded but excluded from the next cycle's auto-generation.

---

## Tips

- The **Add New Program** wizard is the fastest way to create a schedule — it lets you create a new customer, site, or asset inline if they do not exist yet.
- Jobs are generated based on the `date_next_due` field on each schedule. After a job is completed the schedule's next due date advances automatically.
- The workload forecast footer turns red when estimated hours for the month exceed the monthly capacity setting.
- Prior incomplete job warnings (the orange icon on asset rows) are a signal to follow up before generating a report.
