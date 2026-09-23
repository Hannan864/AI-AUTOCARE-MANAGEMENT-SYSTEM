# AutoCare Platform: Enterprise Backend Architecture Skeleton

## 1. Project Folder Structure

```text
autocare_backend/
├── app/
│   ├── __init__.py                # Factory pattern initialization
│   ├── core/                      # Application-wide core components
│   │   ├── config/                # Environment configurations
│   │   │   ├── __init__.py
│   │   │   ├── base.py
│   │   │   ├── development.py
│   │   │   ├── production.py
│   │   │   └── testing.py
│   │   ├── db/                    # Database setup and abstract repository
│   │   │   ├── __init__.py
│   │   │   ├── session.py
│   │   │   └── base_repository.py
│   │   ├── exceptions/            # Custom exception classes
│   │   │   ├── __init__.py
│   │   │   └── handlers.py
│   │   ├── middleware/            # Request/Response interceptors
│   │   │   ├── __init__.py
│   │   │   ├── auth_middleware.py
│   │   │   ├── rbac_middleware.py
│   │   │   ├── logging_middleware.py
│   │   │   └── rate_limit_middleware.py
│   │   └── security/              # Hashing, JWT, validation
│   │       ├── __init__.py
│   │       ├── passwords.py
│   │       └── jwt_manager.py
│   │
│   ├── extensions/                # 3rd party initialization (SQLAlchemy, Celery, etc.)
│   │   ├── __init__.py
│   │   ├── database.py
│   │   ├── cache.py
│   │   ├── celery_app.py
│   │   ├── mail.py
│   │   └── cors.py
│   │
│   ├── modules/                   # Feature-based Domain Driven Design (DDD)
│   │   ├── auth/
│   │   │   ├── __init__.py
│   │   │   ├── controllers.py
│   │   │   ├── services.py
│   │   │   ├── repositories.py
│   │   │   ├── models.py
│   │   │   ├── schemas.py         # Request/Response validation models (Pydantic/Marshmallow)
│   │   │   └── routes.py
│   │   ├── vehicles/
│   │   │   ├── [controllers, services, repositories, models, schemas, routes].py
│   │   ├── service_requests/
│   │   │   ├── [controllers, services, repositories, models, schemas, routes].py
│   │   ├── mechanics/
│   │   │   ├── [controllers, services, repositories, models, schemas, routes].py
│   │   ├── admin/
│   │   │   ├── [controllers, services, repositories, models, schemas, routes].py
│   │   ├── notifications/
│   │   │   ├── [controllers, services, repositories, models, schemas, routes].py
│   │   └── uploads/
│   │       ├── [controllers, services, repositories, models, schemas, routes].py
│   │
│   └── utils/                     # Shared helper functions
│       ├── __init__.py
│       ├── responses.py           # Standard API response formatter
│       └── validators.py
│
├── migrations/                    # Alembic migration scripts
├── tests/                         # Test directory structured by module & layer
│   ├── __init__.py
│   ├── conftest.py                # Pytest fixtures
│   ├── unit/
│   │   ├── services/
│   │   └── repositories/
│   ├── integration/
│   │   └── api/
│   └── e2e/
│
├── worker.py                      # Celery worker entry point
├── run.py                         # Application entry point
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## 2. Architecture Design

The backend uses a strict **N-Layer (Onion) Architecture**, enforcing Separation of Concerns. Business logic never touches HTTP objects (Request/Response), and API controllers never execute SQL or ORM queries.

### Layer Definitions

1.  **Route Layer (`routes.py`):** Binds external HTTP URLs to specific controller functions. Applies top-level middleware routing.
2.  **Controller Layer (`controllers.py`):**
    *   Extracts parameters/JSON from incoming HTTP requests.
    *   Validates payload using Schemas.
    *   Passes clean data to the Service Layer.
    *   Formats the Service response back into a standard JSON HTTP response.
3.  **Service Layer (`services.py`):**
    *   Contains purely business logic.
    *   Enforces rules (e.g., "Cannot assign mechanic if request is already completed").
    *   Orchestrates multiple repositories if needed.
    *   Throws customized Domain Exceptions.
4.  **Repository Layer (`repositories.py`):**
    *   Interfaces directly with the database.
    *   Executes ORM queries.
    *   Returns domain entities/models to the Service layer.
5.  **Model Layer (`models.py`):** Defines the database table structure locally via SQLAlchemy ORM.

### Request Flow
```text
HTTP Request (Client)
      ↓
[Middleware] (Auth, Rate Limit, Logging)
      ↓
[Route] (/api/v1/vehicles)
      ↓
[Controller] (Extract user ID, Validate Payload)
      ↓
[Service] (Apply business rule: Does user own a vehicle already with this plate?)
      ↓
[Repository] (SELECT FROM vehicles WHERE plate=X)
      ↓
[Database] (PostgreSQL executes query)
      ↓
(Returns Data back up the chain)
      ↓
[Controller] Format into standard {success, data} Response
      ↓
HTTP Response (Client)
```

---

## 3. Auth System Design

### Authentication Flow
1.  **Login:** Client sends Email/Password -> Controller validates -> Auth Service fetches user via Repository -> Verifies bcrypt hash -> Generates **Access Token** (short-lived, 15m) and **Refresh Token** (long-lived, 7d).
2.  **Subsequent Requests:** Client sends Access Token in `Authorization: Bearer <token>` header.
3.  **Access Token Expiry:** Client sends Refresh Token to `/api/v1/auth/refresh` -> Service validates token in DB/Redis cache -> Issues new Access Token.

### Role-Based Access Control (RBAC) System
*   Roles are embedded into the JWT payload (`payload: { sub: user_id, role: 'mechanic' }`) but mapped strictly in the database.
*   **Roles:** `VEHICLE_OWNER`, `MECHANIC`, `WORKSHOP_MANAGER`, `ADMIN`.

### Middleware Flow (`auth_middleware.py`)
1.  Intercept incoming Request.
2.  Extract `Bearer` token.
3.  Decode and Validate Signature (using system secret).
4.  Check token expiration.
5.  Check against Redis blacklist (if user was actively revoked/logged out).
6.  Inject `current_user` object into the Flask App Context (`g.current_user`).

---

## 4. Module Breakdown

### 4.1 Authentication Module
*   **Responsibilities:** Registration, Login, Token Refresh, Password Reset workflows, Session Revocation (Logout).
*   **Services:** `AuthService` (hash verify, token generation), `TokenService` (blacklist management).
*   **Endpoints:** `/register`, `/login`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password`.

### 4.2 Vehicle Module
*   **Responsibilities:** Managing vehicle profiles linked to Owners.
*   **Services:** `VehicleManagementService` (CRUD operations, ownership validation).
*   **Data Flow:** Controller takes `make/model/plate` -> Service checks user quota/duplicate plate -> Repo saves -> Returns Vehicle UUID.

### 4.3 Service Request Module
*   **Responsibilities:** Core operational pipeline handling maintenance, repair, and roadside recovery requests.
*   **Services:** `RequestLifecycleService`, `OfferManagementService`.
*   **Lifecycle Handling & Status Transitions:**
    *   `DRAFT` → User creates.
    *   `SUBMITTED` → User finalizes (triggers mechanic broadcast).
    *   `OFFER_RECEIVED` → Mechanic submits quote.
    *   `ACCEPTED` → User approves offer.
    *   `IN_PROGRESS` → Mechanic marks work started.
    *   `COMPLETED` → Mechanic submits final report & parts list.
    *   `CLOSED` → Invoice paid.

### 4.4 Mechanic Module
*   **Responsibilities:** Dispatch center for mechanics. Viewing available jobs, accepting, reporting.
*   **Flow:** Mechanic checks `/jobs/available` (filtered by radius/skill) -> Posts to `/jobs/offer` -> User accepts -> Job moves to `/jobs/active`.
*   **Logic:** `MechanicDispatchService` calculates queue loads and ensures a mechanic cannot overlap urgent recovery jobs.

### 4.5 Admin Module
*   **Responsibilities:** Platform oversight, user management, global analytics.
*   **Services:** `SystemAuditService`, `UserManagementService`.

### 4.6 Notification Module
*   **Responsibilities:** Asynchronous message dispatch.
*   **Flow:** Other services publish events (`EventBus.publish('request_completed', payload)`). Notification service consumes.
*   **Triggers:** New Login (Security), Job Accepted (SMS/Push), Invoice Generated (Email PDF).
*   **Async Design:** Routes to Celery Tasks handled by Redis broker.

### 4.7 Upload Module
*   **Responsibilities:** Secure binary file handling.
*   **Strategy:** Immediate local saving to temp storage -> Background thread uploads to Cloud Object Storage (S3) -> Returns Signed URL.
*   **Validation:** Strict MIME-type sniffing (using `python-magic`, not file extensions). 5MB limit per file.

---

## 5. Database Integration Design

*   **ORM:** SQLAlchemy 2.0 (using asynchronous engine patterns if required, or strictly declarative base mapping).
*   **Migration System:** Alembic (integrated via Flask-Migrate).
*   **Connection Pooling:** SQLAlchemy QueuePool configured with a size of 20 and overflow of 10 to handle high concurrency SaaS limits.
*   **Repository Abstraction:**
    All DB interactions implement a `BaseRepository[ModelType]` providing standard `get_by_id`, `create`, `update`, `delete`. Modules extend to specific repos (e.g., `VehicleRepository` adds `get_vehicles_by_owner_id`).
    **Rule:** Cross-module queries (e.g., getting user info for a vehicle) happen via calling the *Service*, not doing raw joins across unrelated repositories, maintaining modular boundaries.

---

## 6. Middleware Design

1.  **Authentication Middleware (Auth):** Decodes JWT, validates, injects user context. Returns 401 Unauthorized immediately if missing.
2.  **Authorization Middleware (RBAC):** Decorator `@require_role('admin', 'manager')`. Returns 403 Forbidden if context role does not match.
3.  **Request Logging Middleware:** Intercepts `before_request` to log HTTP method/path/IP, and `after_request` to log execution time and status code. Avoids logging body payloads for GDPR/PII compliance.
4.  **Error Handling Middleware:** Global `@app.errorhandler(Exception)`. Catches uncaught exceptions -> Rolls back `db.session` -> Logs stack trace via Sentry -> Returns standardized 500 JSON response.
5.  **Rate Limiting Middleware:** Flask-Limiter utilizing Redis. E.g., `200/day`, `50/hour`, specific limit on `/login` to `5/minute` per IP.

---

## 7. Configuration System

*   **Base Config (`base.py`):** Defines standard app behaviors (pagination limits, upload allowed extensions).
*   **Development Config (`development.py`):** SQLite or local Postgres URI, Debug=True, Echo=True (print SQL queries).
*   **Production Config (`production.py`):** RDS Postgres URI, Disable debug, Strict connection pooling, Sentry DSN.
*   **Testing Config (`testing.py`):** In-memory SQLite, testing flags, bypass rate limiters.
*   **Environment Variables:** Managed via `.env` loaded via `python-dotenv`.
*   **Secret Management:** Database URLs, JWT Secrets, SMTP Passwords are NEVER hardcoded. They are pulled strictly from `os.environ.get()`. In production, these map to AWS Secrets Manager injected at container boot.

---

## 8. API Design Style

### Standard Response Format
Every endpoint returns a unified JSON wrapper via a utility function (`return success_response(data)`):

```json
{
  "success": true,
  "message": "Resource retrieved successfully",
  "data": {
     "id": "uuid-...",
     "attribute": "value"
  },
  "error": null,
  "meta": {
     "page": 1,
     "total": 50
  }
}
```

### Standard Rules
*   **Status Codes:** 200 (OK), 201 (Created), 400 (Validation Error), 401 (Unauthenticated), 403 (Unauthorized), 404 (Not Found), 500 (Internal Server Error).
*   **Validation Rules:** Schema validation occurs at the Controller boundary. If invalid, returns 400 with `error` object defining exactly which fields failed.
*   **Pagination:** All list endpoints (`GET /api/v1/vehicles`) require `page` and `limit` query params.

---

## 9. Background Job Architecture

*   **Queue System:** Celery distributed task queue backed by a Redis message broker.
*   **Worker Strategy:** Dedicated long-running container processes (Workers) picking up jobs off the Redis queue.
*   **Async Task Profiles:**
    *   `send_registration_email.delay(user_email, token)` -> Fired on user register.
    *   `process_image_upload.delay(file_path)` -> Resizes large 4K images to standardized thumbnails.
    *   `broadcast_recovery_alert.delay(gps_coordinates)` -> Finds nearby mechanics via geospatial query and pushes alerts.

---

## 10. Security Architecture

*   **JWT Security:** Short 15-minute lifespan for Access Tokens. System requires `HttpOnly` Set-Cookie headers if serving frontend on same domain, OR strict `Authorization: Bearer` headers if decoupled.
*   **Password Hashing:** `passlib` utilizing `bcrypt`.
*   **Input Validation:** Pydantic/Marshmallow schemas sanitize and explicitly define allowed schema properties. Drops unknown malicious keys before reaching controllers.
*   **SQL Injection Prevention:** SQLAlchemy ORM enforces parameterized queries automatically.
*   **XSS Protection:** Backend JSON responses execute HTML escaping where necessary, though frontend framework (React/Templates) handles primary escaping.
*   **FileUpload Security:** Save to temp, scan extension, check MIME magic bytes, generate deterministic random UUID names, push to S3 bucket without execution permissions.

---

## 11. Testing Structure

*   **Unit Tests (`tests/unit/`):** Test Service Layer logic. Mocks repositories so no DB is required. Blazing fast (hundreds per second).
*   **Integration Tests (`tests/integration/`):** Test Repository Layer. Connects to `testing.py` configured DB (SQLite or Test Postgres container). Inserts, updates, queries data.
*   **E2E / API Tests (`tests/e2e/`):** Uses Flask Test Client. Issues real JSON POST requests to Routes. Validates the end-to-end flow from middleware down to Database and back out as a Standard JSON Response.
*   **Test Database Strategy:** Run a setup fixture that creates empty tables before tests, and drops them after tests using Pytest context managers.

---

## 12. Final Outputs

### System Architecture Diagram (Text-based)

```text
[ Mobile / Web Frontend ]
        │
   (HTTPS / JSON)
        ▼
[ Nginx Load Balancer ]
        │
   ┌────▼────┐
   │ Routes  │  ◀─ [ Rate Limit Middleware ]
   └────┬────┘
        │
   ┌────▼──────────┐
   │ Controllers   │  ◀─ [ Auth / RBAC Middleware ]
   │ (Validation)  │
   └────┬──────────┘
        │
   ┌────▼──────────┐      [ Celery Tasks ]
   │ Services      │ ────▶    (Async)
   │ (Biz Logic)   │             │
   └────┬──────────┘             ▼
        │                    [ Redis ]
   ┌────▼──────────┐             │
   │ Repositories  │             ▼
   │ (SQLAlchemy)  │        [ Mailgun / S3 / Twilio ]
   └────┬──────────┘
        │
     (TCP/IP)
        ▼
[ PostgreSQL Database ]
```

### Module Summary Table

| Module | Core Responsibility | Key Services | Integration Points |
| :--- | :--- | :--- | :--- |
| **Core** | App infrastructure, config | Error Handlers, Base Repo | DB, Redis, Flask App |
| **Auth** | Security & sessions | `AuthService`, `JwtManager` | Users Repo, Mail Task |
| **Vehicles** | Asset tracking | `VehicleSvc` | Auth (Ownership) |
| **Requests** | Pipeline & states | `RequestLifecycleSvc` | Vehicles, Mechanics |
| **Mechanics**| Dispatch logic | `DispatchSvc`, `OfferSvc` | Requests, Push Notifs |
| **Admin** | Oversight & Audit | `ReportingSvc` | All Models |
| **Uploads** | Secure Blob mgmt | `FileValidationSvc` | S3, Requests (Images) |
| **Notify** | Event alerting | `EventBus`, `EmailTask` | Redis, Celery, SMS API |
