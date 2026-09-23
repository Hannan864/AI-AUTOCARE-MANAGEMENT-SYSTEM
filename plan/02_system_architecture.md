# System Architecture Blueprint

## 1. Frontend Architecture
- **HTML:** Semantic structure, modular templates.
- **CSS:** Tailwind CSS for responsive utility-first design, strictly adhering to the SaaS design system.
- **JavaScript:** Vanilla JS/TypeScript managing DOM updates via secure asynchronous fetch requests. Client-side routing logic where applicable.

## 2. Backend Architecture
- **Server:** Flask (or Express/TypeScript equivalent per current implementation mapping).
- **Architecture Pattern:** MVC / Controller-Service-Repository pattern.
  - **Routes:** API endpoint definitions and middleware attachments.
  - **Controllers:** Request parsing, validation, and HTTP response formatting.
  - **Services:** Core business logic and workflow orchestration.
  - **Repositories:** Database interaction and query abstraction.
  - **Models:** Data definitions and types.

## 3. Database Architecture
- **Database Engine:** MySQL (or equivalent relational/structured abstraction as defined in the environment).

## 4. Core System Flows
- **Authentication Flow:** Registration, Login, Session Management, Token Issuance, and Verification.
- **RBAC Flow:** Strictly gated access defining what Vehicles Owners, Mechanics, and Admins can query or mutate.
- **Upload Flow:** Secure, validated multi-part handling for profile pictures, vehicle logs, and mechanic Gig thumbnails.
- **Service Request Flow:** Creation, quotation, approval, work-in-progress logging, and completion.
- **Recovery Flow:** Emergency SOS triggering -> Location broadcasting -> Mechanic acceptance -> Dispatch tracking.
- **Assignment Flow:** Admins routing standard service requests to available mechanics based on skill / load availability.
- **History Flow:** Immutable tracking of completed services securely tied to a vehicle's VIN and Owner ID.
- **Notification Flow:** Asynchronous alerts triggered by state changes (e.g., job completed, payment requested) targeting specific user IDs.
