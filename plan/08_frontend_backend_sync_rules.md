# Frontend/Backend Sync Rules

## 1. Absolute Directives
- Implementations must guarantee 100% synchronization between frontend states and backend database records.
- "Optic" or "Optimistic" UI updates should only occur if properly scoped and paired with guaranteed backend fallback reversals on failure.

## 2. API Contract Enforcement
- **Every Page** must source its distinct layout data from an API (e.g., the User Profile must fetch `GET /api/users/me`).
- **Every API** must return standardized JSON constructs. (e.g., `{ success: boolean, data?: any, message?: string }`).

## 3. Data Flow Rules (Request/Response)
- **Request Payloads:** Frontends must securely construct JSON bodies without appending untrusted metadata. Roles should NOT be passed in insecure ways if the backend can determine the role seamlessly via JWT or Session token.
- **Response Payloads:** Backends must strip sensitive database fields (like `password_hash` or internal relational IDs not meant for the client).

## 4. State Handlings
- **Loading States:** UIs must display spinners, skeletons, or disabled button states during ANY asynchronous API call to prevent duplication/double-submission.
- **Error States:** Network failures, 400 Bad Requests, 401 Unauthorized, and 500 Internal Errors must be gracefully caught and displayed to the user clearly.
- **Empty States:** Collections/Tables matching 0 records must explicitly inform the user (e.g., "No vehicles found in database") rather than rendering blank UI cards.

## 5. Validation Rules
- Validations must be Dual-Layered:
  - Frontend: Quick UX validation (HTML5 `required`, basic Regex).
  - Backend: Hard constraint validation (Sanitization, schema compliance, relational checking) prior to any Database write.
