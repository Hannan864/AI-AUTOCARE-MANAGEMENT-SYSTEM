# AutoCare Platform: Enterprise Software Blueprint

## 1. Executive Summary
**Business Problem:** Traditional vehicle maintenance, repair, and roadside recovery processes rely heavily on manual tracking, paper-based invoices, and phone communication. This offline approach leads to inefficient scheduling, lost service histories, opaque pricing, and poor customer experiences.
**Proposed Automated Solution:** AutoCare is a centralized, cloud-based vehicle maintenance, recovery, and repair management system. It digitizes the entire vehicle service lifecycle, offering dedicated portals for customers, mechanics, workshop managers, and administrators. 
**Benefits & Expected Outcomes:** 
*   **Efficiency:** Reduces administrative overhead by 40% through automated assignments.
*   **Transparency:** Standardized price offers, digital invoices, and secure service logs.
*   **Value:** Maintained central digital service histories increase vehicle resale values.
**Business Value:** Built to scale from a single academic project to a commercial Multi-Workshop Marketplace (SaaS) network.

---

## 2. Project Objectives
**Primary Objectives:**
*   Develop a secure, role-based web and mobile-responsive platform.
*   Digitize vehicle service requests (Maintenance, Repair, Emergency Recovery).
*   Implement offer/approval workflows and real-time job status tracking.
**Secondary Objectives:**
*   Provide centralized mechanic dispatching and job tracking.
*   Enable secure file/image management for pre-repair and post-repair damage assessment.
**Success Criteria & KPIs:**
*   Platform Uptime: 99.9%
*   System Response Time: < 300ms for core API endpoints.
*   Time-to-Assign for Emergency Recovery: < 5 minutes.

---

## 3. Stakeholder Analysis

### Vehicle Owner
*   **Responsibilities:** Maintain personal vehicle profiles, submit service/recovery requests, review mechanic offers, approve work, process payments.
*   **Permissions:** Read/Write personal data, vehicles, and requests.
*   **Use Cases:** "As an owner, I want to upload a picture of a dent so mechanics can quote a repair price without me visiting the garage."

### Mechanic
*   **Responsibilities:** Accept dispatched jobs, assess vehicle damage, update job status, upload post-repair imagery, itemize parts used.
*   **Permissions:** Read assigned requests, update status, write to service logs.
*   **Use Cases:** "As a mechanic, I want to mark a task as 'Completed' and attach parts billing so the customer is notified immediately."

### Workshop Manager
*   **Responsibilities:** Oversee incoming requests, manage workshop capacity, dispatch and re-assign tasks, monitor service quality.
*   **Permissions:** Read/Update all workshop-related requests, oversee workshop mechanics.
*   **Use Cases:** "As a manager, I want to reassign a job queue if a mechanic is absent."

### Administrator
*   **Responsibilities:** Oversee complete system health, manage all users/workshops, resolve escalation disputes, review financial reports.
*   **Permissions:** Full unrestricted CRUD access to all platform entities.
*   **Use Cases:** "As an admin, I want to view platform-wide revenue, active recovery requests, and average issue resolution times."

---

## 4. Functional Requirements

### Authentication & Authorization
*   User registration with email verification.
*   Secure Login (Email/Password) with JWT validation.
*   Password reset via authenticated email links.
*   Granular Role-Based Access Control (RBAC).

### Vehicle Management
*   Add, Edit, and Soft-Delete vehicles (Make, Model, Year, Plate, Mileage).
*   Centralized vehicle history timeline.
*   Upload vehicle registration and insurance documents.

### Maintenance Management
*   Predictive service schedules based on mileage intervals.
*   Automated maintenance reminders (Oil change, Filters).
*   Digital stamped service logs.

### Fault Reporting & Repair Requests
*   Report complex vehicle issues with descriptive text.
*   Upload multi-image galleries of damage/faults.
*   Submit repair requests for workshops to review.
*   System for mechanics to submit "Price Offers" to owners.
*   Owner approval/rejection digital workflow.

### Recovery Requests (Emergency)
*   Geo-tagged emergency roadside request interface.
*   Immediate proximity-based assignment workflow.
*   Live status tracking (Pending, Dispatched, Arrived, Resolved).

### Mechanic Operations
*   My Queue (List of assigned jobs).
*   Update active job costs and time estimates.
*   Parts usage management and digital inventory hooks.
*   Job completion diagnostic reports.

### Admin Operations
*   User lifecycle management (Create, Ban, Suspend).
*   Mechanic and Workshop onboarding workflows.
*   Monitor and optionally intercept offer approvals.
*   Global financial and operational reporting.

---

## 5. Non-Functional Requirements
*   **Scalability:** Microservice-ready modular monolith capable of lateral scaling behind a load balancer.
*   **Security:** AES-256 for data-at-rest. TLS 1.3 for data-in-transit. Advanced rate limiting.
*   **Reliability:** Redundant database clusters ensuring zero data loss on node failure.
*   **Performance:** Queries executing in less than 50ms utilizing database indexing.
*   **Availability:** 99.9% uptime SLA.
*   **Maintainability:** Strict adherence to PEP8, SOLID principles, and comprehensive API documentation (Swagger/OpenAPI).
*   **Accessibility:** WCAG 2.1 AA compliance for frontend interfaces.
*   **Auditability:** Immutable audit logging for all transactional events (cost changes, status changes).
*   **Backup:** Automated daily point-in-time PostgreSQL backups to S3.

---

## 6. Complete System Architecture
The application follows a strictly layered **N-Tier Architecture**:

1.  **Presentation Layer (Frontend):** Handles UI/UX. Interprets user actions and renders data from endpoints.
2.  **Application / API Layer:** Exposes RESTful endpoints, parses incoming JSON, routes commands.
3.  **Business Logic Layer (Services):** Contains core rules (e.g., "A job cannot be marked Complete if price is unapproved").
4.  **Repository Layer:** Abstracts database queries using ORM (e.g., SQLAlchemy/SQLModel), preventing raw SQL in business logic.
5.  **Database Layer:** Relational persistence engine mapping entities to physical storage.
6.  **Storage Layer:** Object storage for binary heavy objects (Images/PDFs).

**Request Flow:**
`Client Request -> Nginx (Reverse Proxy) -> Gunicorn (WSGI) -> Flask App -> Auth Middleware -> Route Controller -> Business Service -> Repository -> Database`

---

## 7. High-Level Architecture Diagram
```text
                          [ End Users ] (Mobile/Web Browser)
                                │
                                ▼
                       [ Load Balancer / CDN ] (Cloudflare/Nginx)
                                │
                   ┌────────────▼──────────────┐
                   │    Presentation Layer     │ (Frontend / Templates)
                   └────────────┬──────────────┘
                                │ JSON API Calls
                   ┌────────────▼──────────────┐
                   │     API Gateway / WAF     │
                   └──────┬────────────┬───────┘
                          │            │
          ┌───────────────▼┐          ┌▼─────────────────┐
          │ Auth Service   │          │ Business Logic   │
          │ (JWT / Roles)  │          │ (Flask Backend)  │
          └───────────────┬┘          └┬───────────────┬─┘
                          │            │               │
                   ┌──────▼────────────▼────┐     ┌────▼────────────────┐
                   │   Database Layer       │     │ Object Storage      │
                   │ (PostgreSQL/MySQL)     │     │ (AWS S3 / Uploads)  │
                   └────────────────────────┘     └─────────────────────┘
                          │
                   ┌──────▼────────────┐
                   │ Background Jobs   │ (Celery / Redis)
                   │ (Emails / SMS)    │
                   └───────────────────┘
```

---

## 8. Technology Stack Evaluation

### Option A (Traditional Monolith)
*   **Frontend:** HTML5, CSS3, JavaScript, Jinja2 Templates.
*   **Backend:** Python Flask.
*   **Database:** MySQL.
*   **Pros:** Fastest time-to-market, simplest for university/FYP project scope.
*   **Cons:** Tightly coupled UI/Backend makes mobile app development harder later.

### Option B (Decoupled Enterprise SaaS)
*   **Frontend:** React / Next.js with TypeScript.
*   **Backend:** Python Flask (Strict REST API) or FastAPI.
*   **Database:** PostgreSQL.
*   **Pros:** Highly scalable, secure, built for cross-platform (Web + Mobile App reusing same API).
*   **Cons:** Steeper learning curve, requires managing CORS and complex deployment.

**Recommendation:** Go with **Option B**. If constraints demand Option A due to existing HTML templates, utilize Option A but build the business logic completely into RESTful sub-routes (`/api/v1/...`) to ensure smooth transitioning to mobile apps in the future.

---

## 9. Database Architecture

### ERD Overview
The core relationship bounds a `User` (Owner) to `Vehicle`(s). A `Vehicle` generates `ServiceRequest`(s). A `ServiceRequest` is assigned to a `User` (Mechanic) through an `Assignment` and produces `ServiceHistory`.

### Table Definitions

**1. Users Table**
*   `id` (PK, UUID/Int)
*   `full_name` (Varchar 100)
*   `email` (Varchar 100, Unique, Index)
*   `phone` (Varchar 20)
*   `password_hash` (Varchar 255)
*   `role_id` (FK -> Roles)
*   `created_at` (Timestamp)
*   `is_active` (Boolean)

**2. Vehicles Table**
*   `id` (PK, UUID/Int)
*   `user_id` (FK -> Users)
*   `make` (Varchar 50)
*   `model` (Varchar 50)
*   `year` (Int)
*   `registration_number` (Varchar 50, Unique)
*   `mileage` (Int)
*   `last_service_date` (Timestamp)
*   `next_service_date` (Timestamp)

**3. ServiceRequests Table**
*   `id` (PK, UUID/Int)
*   `user_id` (FK -> Users)
*   `vehicle_id` (FK -> Vehicles)
*   `type` (Enum: maintenance, repair, recovery)
*   `description` (Text)
*   `status` (Enum: pending, assessed, approved, in_progress, completed, rejected)
*   `created_at` (Timestamp)

**4. ServiceOffers Table**
*   `id` (PK, UUID/Int)
*   `request_id` (FK -> ServiceRequests)
*   `mechanic_id` (FK -> Users)
*   `estimated_cost` (Decimal)
*   `estimated_time_hours` (Int)
*   `status` (Enum: submitted, accepted, rejected)
*   `created_at` (Timestamp)

**5. ServiceHistory (Logs) Table**
*   `id` (PK)
*   `request_id` (FK -> ServiceRequests)
*   `mechanic_id` (FK -> Users)
*   `total_cost` (Decimal)
*   `diagnostics_notes` (Text)
*   `completed_at` (Timestamp)

**6. PartsUsed Table**
*   `id` (PK)
*   `history_id` (FK -> ServiceHistory)
*   `part_name` (Varchar 100)
*   `quantity` (Int)
*   `price_per_unit` (Decimal)

**7. Uploads/Images Table**
*   `id` (PK)
*   `entity_type` (Enum: request, history, vehicle)
*   `entity_id` (Int)
*   `file_url` (Varchar 255)
*   `uploaded_at` (Timestamp)

---

## 10. User Roles & Permission Matrix

| Feature / Entity | Vehicle Owner | Mechanic | Workshop Mgr | System Admin |
| :--- | :--- | :--- | :--- | :--- |
| **User Mgmt** | Read Self | Read Self | Read/Update Team | Full CRUD |
| **Vehicles** | Full CRUD | Read Assigned | Read Workshop | Read All |
| **Requests** | Create/Update | Read Assigned | Edit Assigned | Read/Archive |
| **Price Offers**| Read/Accept/Reject| Create (If Assgn) | Create/Update | View Only |
| **Job Status** | Read Only | Update | Update/Reassign | Full CRUD |
| **Payments** | Create (Pay) | Read | Read/Withdraw | Read/Manage |
| **System Rules**| None | None | None | Full CRUD |

---

## 11. API Blueprint (Core REST)

| Method | Endpoint | Purpose | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Register new user account | None |
| `POST` | `/api/v1/auth/login` | Authenticate and return JWT | None |
| `GET` | `/api/v1/vehicles` | List owner's vehicles | Yes (Owner) |
| `POST` | `/api/v1/vehicles` | Register a new vehicle | Yes (Owner) |
| `POST` | `/api/v1/requests` | Submit maintenance/repair req | Yes (Owner) |
| `GET` | `/api/v1/mechanic/jobs` | Get jobs assigned to current mech| Yes (Mechanic) |
| `POST` | `/api/v1/offers` | Mechanic submits price to owner | Yes (Mechanic) |
| `PATCH`| `/api/v1/requests/{id}/status`| Update job pipeline status | Yes (Mech/Admin)|
| `POST` | `/api/v1/upload` | Multipart file upload | Yes (Any) |

---

## 12. File & Image Management Architecture
**Storage Strategy:** Externalize files to Cloud Object Storage (e.g., AWS S3 or Minio) to keep the backend stateless. If using local deployment for FYP, map an external Docker Volume to `/var/www/uploads/`.
**Validation Rules:**
1.  Verify MIME types (allow only `image/jpeg`, `image/png`, `application/pdf`).
2.  File size limit: 5MB per image.
3.  Server-side virus scanning (ClamAV) integration for enterprise deployments.
**Naming Convention:**
`{entity_type}/{entity_id}/{uuidv4}_{timestamp}.{ext}` (e.g., `requests/req_8923/a8f9b..._16789.jpg`).

---

## 13. Notification Architecture
Asynchronous Event-Driven dispatching using **Celery + Redis**:
*   **Triggers:** Create Request, Status Change, Offer Submitted, Payment Confirmed.
*   **Channels:**
    *   *Email:* SendGrid or AWS SES for transactional receipts and PDF invoices.
    *   *SMS:* Twilio for urgent alerts (e.g., "Mechanic has arrived for Emergency Recovery").
    *   *In-App:* WebSocket or polling-based standard dropdown alerts.

---

## 14. Reporting Architecture
*   **Engine:** Backend query aggregations converted to Pandas Dataframes.
*   **Exports:** PDF (using ReportLab/WeasyPrint), CSV, Excel (using OpenPyXL).
*   **Reports Built:**
    *   *Customer:* Annual Maintenance Spend, Vehicle Health Report.
    *   *Mechanic:* Weekly Job Completion & Hours Logged.
    *   *Admin:* Total Revenue, Platform Churn, Average Repair Completion Times (SLA Analytics).

---

## 15. Security Architecture
*   **Authentication:** Stateless JWT stored in Secure, HttpOnly cookies to prevent XSS theft.
*   **Passwords:** Hashed using **Bcrypt** with salt rounds > 12.
*   **Input Validation:** Strict parsing using Pydantic or WTForms. Reject unexpected JSON keys.
*   **SQL Injection:** Prevented by mandated use of SQLAlchemy ORM parameterized queries. No raw SQL strings permitted.
*   **CSRF Protection:** Anti-CSRF tokens mandated for all state-changing `POST/PUT/DELETE` methods from browser clients.
*   **Rate Limiting:** IP-based limiting (Rack-Attack/Flask-Limiter) to prevent Brute Force (e.g., Max 5 login attempts / min).

---

## 16. Logging & Monitoring Architecture
*   **Application Logs:** Structured JSON logging targeting `stdout`. Captured by Docker/Systemd.
*   **Audit Logs:** Database table maintaining history of critical actions (`user_id`, `action`, `timestamp`, `ip_address`).
*   **Monitoring:** Prometheus scraping Flask metrics, visualized in Grafana.
*   **Error Alerting:** Sentry integration catches unhandled Python exceptions and forwards slack alerts to the dev team.

---

## 17. Mobile-Friendly Strategy
*   **Phase 1 (MVP):** Fully responsive web design using TailwindCSS, treating the app as a Progressive Web App (PWA). Includes generic `manifest.json` and service workers for offline caching of static assets.
*   **Phase 2 (Enterprise):** Cross-platform mobile applications (Flutter or React Native) connecting to the exact same REST APIs defined in Section 11.

---

## 18. Deployment Architecture
*   **Dev:** `docker-compose.yaml` spinning up Flask, Postgres, and Redis locally.
*   **Production (Cloud Native):**
    *   **Orchestration:** Managed Kubernetes (EKS/GKE) or Serverless Containers (AWS Fargate/Google Cloud Run).
    *   **Load Balancing:** Nginx Ingress handling SSL termination.
    *   **Database:** Managed Relational DB (AWS RDS PostgreSQL) ensuring high availability and automated backups.
    *   **Secrets:** Managed via AWS Secrets Manager or Hashicorp Vault (never in `.env` files committed to Git).

---

## 19. CI/CD Architecture
*   **Repository:** GitHub / GitLab.
*   **Branch Strategy:** GitHub Flow (`main` branch for production, feature branches linked to Jira/Trello tickets).
*   **Pipeline Flow:**
    1.  *Commit Trigger:* Developer pushes code.
    2.  *Linting & Formatting:* Black, Flake8, safety checks.
    3.  *Automated Tests:* Pytest executes unit and integration tests. Needs 80%+ coverage to pass.
    4.  *Build:* Docker image built and tagged with commit SHA.
    5.  *Deploy:* Image pushed to Container Registry; webhooks trigger server swap (Blue/Green deployment) to eliminate downtime.

---

## 20. Testing Strategy
*   **Unit Tests:** Testing individual utility functions and database ORM methods in isolation.
*   **Integration Tests:** API endpoints hitting a test SQLite/Postgres database.
*   **API Security Tests:** Automated checks for broken RBAC, attempting to access admin endpoints with a user JWT.
*   **UAT (User Acceptance Testing):** Beta deployment for stakeholder sign-off prior to production launch.

---

## 21. UML Section (Architectural Text Schemas)

### Use Case Representation
`[Owner]` --> (Register Account) --> (Add Vehicle) --> (Submit Repair Request) <-- `[System]`
`[Owner]` <-- (Review Estimates) <-- (Approve/Reject)
`[Mechanic]` --> (View Pending Jobs) --> (Submit Cost Offer) --> (Mark Job Complete) --> (Add Parts Used)
`[Admin]` --> (View Analytics) --> (Manage Mechanics) --> (Resolve Disputes)

### State Diagram: Service Request Lifecycle
`[Draft]` -> `[Submitted]` -> `[Assessed / Quoted]` -> `[Approved By Owner]` -> `[In Progress]` -> `[Completed waiting Payment]` -> `[Closed]`

### Interaction Diagram: Emergency Recovery 
`User` -> `Mobile App`: Request Recovery (Sends GPS)
`App` -> `API`: POST /recovery
`API` -> `Database`: Save Request (Status: Pending)
`API` -> `WebSocket/PubSub`: Broadcast to Nearby Mechanics
`Mechanic` -> `API`: Accept Request
`API` -> `Database`: Update Request (Mechanic ID, Status: Dispatched)
`API` -> `App`: Push Notification ("Mechanic Assigned. ETA 15 mins")

---

## 22. Risk Assessment
| Risk | Type | Probability | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **Data Leakage** | Security | Medium | Severe | Encrypt PII data; Use robust JWT verification; Enforce Role-based checking at API level. |
| **System Downtime** | Technical| Low | Severe | Use managed DB services; multi-container deployment; health checks. |
| **Low Mechanics Adoption**| Operational| High| Medium| Create intuitive mobile interface; incentivize fast response times. |
| **Scope Creep** | Project | High | Medium | Strictly adhere to this blueprint; utilize Agile sprint planning; push non-core features to v2. |

---

## 23. Future Enhancements
*   **Real-time GPS Tracking:** For Emergency Recovery drivers (Uber-style map visualization).
*   **Payment Gateway Integration:** Stripe / PayPal escrow system.
*   **OBD2 Sensor Hook-in:** Pulling direct telemetry from car hardware to automate maintenance warnings.
*   **AI Damage Estimation:** Implementing a computer vision model that reviews uploaded crash photos and predicts parts required and estimated cost.

---

## 24. Development Roadmap

| Phase | Duration | Focus Area | Deliverables |
| :--- | :--- | :--- | :--- |
| **Phase 1: Foundation** | Weeks 1-2 | Architecture & Database | ERD finalized, Postgres schemas defined, Git setup. |
| **Phase 2: Authentication**| Weeks 3-4 | Security & Users | JWT Login/Registration, RBAC, Password Reset. |
| **Phase 3: Core API** | Weeks 5-7 | Vehicles & Requests | Vehicle management, service request pipelines. |
| **Phase 4: Workflows** | Weeks 8-10| Bidding & Assignment | Mechanic offers, status tracking, notifications. |
| **Phase 5: Frontend Int.** | Weeks 11-13| UI/UX Wiring | Connecting HTML/React templates to REST API. |
| **Phase 6: QA & Testing** | Weeks 14-15| Stabilization | Security audits, unit tests, bug fixes. |
| **Phase 7: Deployment** | Week 16| Production Go-Live| Dockerized deployment, domain, SSL context. |

---

## 25. Final Enterprise Assessment
*   **Project Complexity Score:** 7 / 10. (Involves real-time dispatch, financial elements, and multi-actor workflows).
*   **Estimated Commercial Team Size:** 1 Project Manager, 2 Backend Engineers, 2 Frontend/App Developers, 1 QA, 1 DevOps (Total 7).
*   **Estimated Commercial Development Time:** 4 Months to MVP.
*   **Scalability Readiness:** High. The architecture strictly decouples storage, processing, and presentation.
*   **Verdict:** Ready for immediate database creation and backend scaffolding based on the defined schemas. All functional definitions are resolved.
