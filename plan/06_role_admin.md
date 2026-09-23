# Role: Admin

## Overview
The Admin holds supreme authorization over the system. Admins manage the platform's integrity, ensuring safe operations, resolving disputes, auditing mechanics, and monitoring overall system health.

## Interface Specifications

### 1. Dashboard
- **Purpose:** Platform-wide oversight.
- **UI Behavior:** Key performance indicators (Total Users, Active Jobs, Pending Approvals, Total Revenue).
- **Business Logic:** Must query aggregation APIs that accurately parse real database totals, strictly forbidding dummy metrics.

### 2. Manage Users
- **Purpose:** Full CRUD capabilities over standard users (Vehicle Owners).
- **UI Behavior:** Comprehensive data tables with pagination, search, filter, sorting. Actions map securely to backend controllers.

### 3. Manage Mechanics
- **Purpose:** Validation and onboarding of service providers.
- **Workflows:** Approving new mechanic registrations, suspending fraudulent accounts, auditing mechanic gig listings.

### 4. Manage Requests
- **Purpose:** Dispatch and dispute-resolution center.
- **Workflows:** 
  - Admin Assignment: Admin manually overriding or assigning specific service requests to specific mechanics based on load.
  - Cancellation/Overrides: Admin forcefully cancelling invalid requests.

## Security Controls & Permissions
- Actions must generate definitive `AuditLogs`.
- Irreversible actions (like Database Factory Resets) must require confirmation payloads, rigorous validation, and immediately sever relevant active sessions. 
- Admins cannot be completely wiped out natively to prevent system lockouts.
