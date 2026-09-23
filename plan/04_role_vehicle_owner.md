# Role: Vehicle Owner

## Overview
The Vehicle Owner role is the primary consumer of the system. This entity registers vehicles, requests standard services, browses mechanic gigs, and initiates emergency recovery flows.

## Interface Specifications

### 1. Dashboard
- **Purpose:** Central hub for immediate status overview.
- **UI Behavior:** Displays active active requests, upcoming appointments, and unread messages.
- **Business Logic:** Must fetch live aggregates mapped to the current authenticated `owner_id`.
- **Empty State:** "No active services. Add a vehicle or request a service to get started."

### 2. My Vehicles
- **Purpose:** Garage management.
- **UI Behavior:** List/Grid view of registered vehicles. Ability to Add/Edit/Delete.
- **APIs:** `GET /api/vehicles`, `POST /api/vehicles`, `PUT /api/vehicles/:id`, `DELETE /api/vehicles/:id`
- **Database:** Vehicles table mapped with owner constraints.

### 3. New Request
- **Purpose:** Initiate standard repair/maintenance.
- **UI Behavior:** Step-by-step form (Select Vehicle -> Select Service Type -> Details -> Confirm).
- **Error State:** Missing required vehicle selection or description halts submission.

### 4. My Requests
- **Purpose:** Tracking all pending, approved, and active requests.
- **UI Behavior:** Tabular or Card-based layout with clear status badges (Pending, In Progress, Completed).

### 5. Service History
- **Purpose:** Immutable ledger of completed work.
- **UI Behavior:** Chronological list of past receipts, parts used, and final costs linked to specific Vehicles.

### 6. Messages
- **Purpose:** Direct communication with assigned Mechanics or Admins.
- **UI Behavior:** Standard chat interface. Web-socket or polling implementation ensuring real-time read/write against database.

### 7. Appointments & Payments
- **Purpose:** Scheduling lock-ins and handling invoice settlements.
- **UI Behavior:** Calendar view, checkout flow.

### 8. Profile Settings
- **Purpose:** Account management.
- **Business Logic:** Must allow updates to password, contact data, and address parameters securely.
