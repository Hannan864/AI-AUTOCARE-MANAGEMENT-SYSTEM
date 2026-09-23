# Master Project Blueprint

## 1. PROJECT OVERVIEW
* **Project Name:** Automatic Vehicle Maintenance, Recovery, and Repair Management System
* **FYP Title:** Automatic Vehicle Maintenance, Recovery, and Repair Management System
* **Objectives:** Establish a reliable two-sided marketplace, provide transparent service tracking, modernize operations, and guarantee security.
* **Business Goals:** Bridge the gap between vehicle owners, mechanics/workshops, and admins seamlessly via a digital medium.
* **Technical Goals:** Implement a robust scalable backend, strict database normalization, and maintain 100% frontend/backend state synchronization.
* **Scope:** Registration & Role Profiles, Automotive System Management, Emergency Recovery, Service/Invoice tracking, Administrator Audits.
* **Out-of-Scope Features:** Physical GPS hardware integration, live real-time tracking, automated OBD-II sensor polling, third-party employee payroll processing, online payment portal/gateway integration (Stripe, etc.).
* **Current Project Status:** Existing system partially implemented. Current task is not project recreation. Only incremental improvement, fixing, synchronization and completion according to this blueprint. Existing working modules must not be deleted or replaced.

---

## 2. ENTERPRISE RULES SUMMARY
* **No Mock Data / No Dummy Data:** Data must be authentic.
* **No Fake Statistics / No Hardcoded Values:** Dashboards must fetch aggregations directly from the datastore.
* **Database Is Source Of Truth:** You cannot bypass backend validation constraints.
* **Enterprise-Level Standards:** Strict typing, payload validation, structured and graceful error handling.
* **Security Rules:** Strict Role-Based Access Control (RBAC). Admin actions maintain an audit log. Irreversible state changes require explicit confirmations.
* **Coding Standards:** Controller-Service-Repository architecture pattern, responsive UI scaling utilizing SaaS aesthetic principles.

---

## 3. SYSTEM ARCHITECTURE SUMMARY
* **Frontend Stack:** HTML, CSS, JavaScript (Asynchronous fetch logic, client-side views).
  * **Requirement:** All existing UI pages must connect with real backend APIs. No static cards, tables, counters, charts, users, mechanics or requests. Every displayed value must come from database/API response.
* **Backend Stack:** Python Flask
* **Database Stack:** MySQL Database
* **Folder Structure:** Separation of UI, Controllers, Repositories and Helper Services, and `plan/` Governance.
* **Architecture Layers:**
  * **Route:** Exposes API endpoints.
  * **Controller:** Request validation and HTTP wrapping.
  * **Service:** Business operation orchestrator.
  * **Repository:** Pure Database reads/writes.
  * **Model:** Type definitions and database shape.
* **Core Flows:**
  * Authentication Flow
  * RBAC Flow
  * Upload Flow
  * Request Flow (Standard repair)
  * Recovery Flow (Emergency SOS)
  * Assignment Flow
  * History Flow

---

## 4. DATABASE SUMMARY

Every entity must have:
* Primary Key
* Created_at
* Updated_at
* Proper Foreign Keys
* Validation constraints
* Relationship handling
* Delete/update rules

*Database design must follow normalized MySQL structure.*

* **Users:** Core identity and authentication entity. Must include role permissions for: owner, mechanic, admin. Relations: Vehicles, ServiceRequests, Assignments, AuditLogs. Role access must always be verified from backend.
* **Vehicles:** Client garage. Relations: Owner, ServiceRequests.
* **Workshops / Managers:** Represents physical shops or primary businesses.
* **Mechanics:** Specialized worker states linked to Workshops or functioning independently.
* **ServiceRequests:** Standard jobs pipeline. Relations: Owner, Vehicle, Assignments.
* **ServiceOffers:** Custom mechanic bids for jobs. Relations: Request, Mechanic.
* **Assignments:** Job dispatch linking mechanism. Relations: Request, Mechanic.
* **RecoveryRequests:** Emergency incidents mapping (Manual location text & Optional basic Lat/Lng). Relations: Owner, Mechanic.
* **Uploads:** Extracted file management. Relations: Polymorphic via generic ID.
* **PartsUsed:** Invoice line items. Relations: ServiceRequests.
* **ServiceHistory:** Read-only ledger of closed cases. Relations: Vehicle, Request.
* **Notifications:** Alert delivery system. Relations: User.
* **AuditLogs:** Admin oversight trace tracker. Relations: Administrator.
* **PasswordResetTokens:** Security recovery handling. Relations: User.

---

## 5. ROLE SUMMARY

### Vehicle Owner
* **Sidebar List:** Dashboard, My Vehicles, New Request, My Requests, Service History, Appointments, Invoice Tracking, Profile Settings.
* **Permissions:** Read/Write their own vehicles, requests. Read-only on personal service history.
* **Restrictions:** Cannot view other users' data, edit other vehicles, access other requests, or modify completed history.
* **Workflows:** Register, authenticate, vehicle creation, standard request initiation, emergency recovery initiation, manual location entry, invoice verification.

### Mechanic / Workshop Manager
* **Sidebar List:** Dashboard, Assigned Jobs, Recovery Jobs, Service History, Profile, Gig Management.
* **Permissions:** Read assigned operations, mutate status of authorized jobs, full CRUD on personal service offerings.
* **Restrictions:** Cannot access unassigned jobs, change another mechanic's job status, or edit admin controlled data.
* **Workflows:** Accept recovery dispatches, modify service statuses (e.g., Progressing, Completed), configure gig details (pricing/skills), record invoice data. *(Note: Workshop Manager acts as aggregate Mechanic supervisor).*

### Admin
* **Sidebar List:** Dashboard, Manage Users, Manage Mechanics, Manage Requests, Audit Logs.
* **Permissions:** Supreme Authorization. CRUD across all entity collections, manual request routing, factory resets.
* **Audit:** Admin actions must generate audit records.
* **Workflows:** Approvals, auditing, dispute resolution, overriding assignments, system wipe.

---

## 6. PAGE SUMMARY
* **Dashboard (All Roles):** Aggregates KPIs. Expectations: Display live, real metrics computing directly from DB records.
* **My Vehicles (Owner):** Garage array. Add, Edit, Delete owned elements dynamically.
* **New Request (Owner):** Multi-step form. Prevent unlinked submission.
* **Assigned Jobs (Mechanic):** Queue view. Toggle job milestones and compile part lists/invoices.
* **Gig Management (Mechanic):** Profile setup. CRUD for specialized public-facing services.
* **Manage Users (Admin):** Data grids. List all users/mechanics, ban/suspend, verify certificates.
* **Manage Requests (Admin):** Support center. Re-assign stuck jobs.

---

## 7. API SUMMARY (Planned Concept)
* **Auth:** `POST /api/auth/register`, `POST /api/auth/login`
  * *Authentication must validate: Email exists, Password hashing, Role assignment, Account status, JWT expiry, Unauthorized access blocking.*
* **Vehicles:** `GET|POST|PUT|DELETE /api/vehicles`
* **Requests:** `GET|POST|PUT /api/requests`
* **Recovery:** `POST /api/recovery` (Manual trigger), `GET /api/recovery/active`
* **Mechanic / Gigs:** `GET|POST|PUT /api/gigs`, `GET /api/mechanics`
* **Admin:** `GET /api/admin/users/stats`, `POST /api/admin/system/reset`
* **Uploads:** `POST /api/uploads`
* **Profile:** `GET|PUT /api/users/me`
* **Invoices:** `GET|POST /api/invoices` (Tracking offline/manual payment statuses)

*(Messages omitted as core requirement; relegated to Future Enhancement)*

---

## 8. FYP COMPLIANCE MATRIX (AUDIT SYSTEM)

| Requirement | Planned | Built | Status |
|---|---|---|---|
| Role: Vehicle Owner | Yes | Yes (Partial) | In Progress |
| Role: Mechanic / Workshop | Yes | Yes (Partial) | In Progress |
| Role: Admin | Yes | Yes | Completed |
| Vehicle Registration | Yes | No | Pending |
| Service Requests | Yes | No | Pending |
| Emergency Recovery | Yes | No | Pending |
| Database Storage | MySQL | No | Pending Migration |
| Backend Server | Python Flask | No | Pending Migration |
| Invoice Tracking | Yes | No | Pending |
| Real-time GPS Tracking | No (OOS) | N/A | Excluded per FYP |
| Online Payments | No (OOS) | N/A | Excluded per FYP |

*Current Database: Existing implementation may contain temporary structures.*
*Target Database: MySQL production schema. Migration must be gradual.*

---

## 9. CURRENT KNOWN ISSUES
* **Bugs:** Existing implementation may contain mixed/temporary architecture from previous development attempts.
* **Target final architecture:** Python Flask backend + MySQL database.
* **Migration/refactoring:** Must be gradual without destroying working features.
* **Security Risks:** JWT keys and session expiry require tight configuration.
* **Missing Features:** Real database syncing for Vehicles, Jobs, Assignments, and Gigs.

---

## 10. RECENT CHANGES SUMMARY
* **What was built:** The Complete Project Governance System (`plan/` directory). A living memory tracking mechanism (`plan/10_project_memory_and_progress_log.md`). Build Rules (`plan/12_build_rules.md`).
* **What changed:** Blocked 'mock data'. Updated Master Blueprint to strictly align with the FYP specification (Flask, MySQL, No live tracking, No online payments, explicit Workshop layer).
* **What was fixed:** Corrected scope expectations and removed fake health scores.
* **What remains:** Refactoring actual infrastructure and pages to map seamlessly to the established backend and schema constructs without breaking rules.

---

## 11. NEXT DEVELOPMENT ROADMAP
* **High Priority:** Plan infrastructure migration to Python Flask & MySQL smoothly adhering to `plan/12_build_rules.md`.
* **Medium Priority:** Build out the Vehicle CRUD lifecycle for the Vehicle Owner role against the proper DB.
* **Low Priority:** Implement Invoice Status Tracking.
* **Future Enhancement:** Messages system (Out of scope for core).
* **Recommended Next Task:** Validate the current environment feasibility for Flask/MySQL shift.

---

## 12. PROJECT HEALTH SCORE
* **Frontend Completion %:** Pending calculation based on FYP matrix
* **Backend Completion %:** Pending calculation based on FYP matrix
* **Database Completion %:** Pending calculation based on FYP matrix
* **Security Completion %:** Pending calculation based on FYP matrix
* **FYP Completion %:** Pending calculation based on FYP matrix
* **Production Readiness %:** Pending calculation based on FYP matrix
* **Overall Project Health %:** Pending calculation based on FYP matrix

---

## 13. FRONTEND BACKEND SYNCHRONIZATION RULES
Every frontend page must follow:

Frontend Form
↓
API Request
↓
Controller Validation
↓
Service Logic
↓
Repository
↓
MySQL Database
↓
Real Response
↓
Frontend Update

* No local dummy arrays. 
* No temporary JSON objects. 
* No fake success messages.

---

## 14. DEVELOPMENT EXECUTION RULES
Before modifying code:

1. Read existing files.
2. Check current implementation.
3. Do not recreate project.
4. Do not remove working features.
5. Fix existing architecture.
6. Build only missing functionality.
7. Update plan/progress file after every task.

**Migration Rule:**
Before changing backend/database architecture:
* Analyze existing implementation.
* Preserve working APIs and business logic.
* Migrate step-by-step.
* Never delete working modules without replacement.
* Verify frontend compatibility after every backend change.

**Progress Updating:**
Every completed task must update: `plan/10_project_memory_and_progress_log.md`
Include:
- What changed
- Files modified
- Features completed
- Bugs fixed
- Remaining problems
- Next recommended step

**Code Organization Rule:**
Do not create unnecessarily huge files. Large logic files must be separated into: controllers, services, repositories, helpers. No single file should exceed 300 lines. If logic grows, split into multiple files.

---

## 15. AI WORKING MEMORY RULE
Before every development task:

* Read all files inside `/plan`.
* The plan folder is the project memory.

After every completed task:
* Update progress log.
* Never forget previous instructions.
* Never rebuild without approval.

---

## 16. TESTING & VERIFICATION RULE
After every feature, verify:
* Backend API works
* Database changes work
* Frontend receives real data
* Role permissions work
* No mock data exists
* No console errors
* No broken routes

Test every role separately:
* Owner
* Mechanic
* Admin
