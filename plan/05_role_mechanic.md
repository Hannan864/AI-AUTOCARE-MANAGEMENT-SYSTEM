# Role: Mechanic

## Overview
Mechanics form the supply side of the platform. They provide specialized automotive services, manage a portfolio of gigs, and dynamically respond to regular and emergency recovery assignments.

## Interface Specifications

### 1. Dashboard
- **Purpose:** Real-time command center for workloads.
- **UI Behavior:** Highlights pending assignments, current active jobs, and daily revenue metrics.

### 2. Assigned Jobs
- **Purpose:** Task execution hub.
- **UI Behavior:** List of jobs dispatched by the Admin or accepted by the Mechanic. Includes options to update status (e.g., "Started", "Parts Ordered", "Completed").
- **Business Logic:** Requires strict access validations to ensure mechanics can only update their own assigned jobs.

### 3. Recovery Jobs (Emergency)
- **Purpose:** Priority response pipeline.
- **UI Behavior:** High-visibility alerts and maps routing for emergency roadside assistance.
- **APIs:** Polling or WebSocket connection to `RecoveryRequests`.

### 4. Service History
- **Purpose:** Mechanic's completed portfolio.
- **UI Behavior:** Logs of all finished jobs for rating and financial auditing purposes.

### 5. Messages
- **Purpose:** Communicating with Vehicle Owners regarding active service tasks.

### 6. Profile
- **Purpose:** Personal details and certification management.

### 7. Gig Management (Crucial Flow)
- **Purpose:** Enables mechanics to productize their offerings.
- **Fields Required:** `title`, `description`, `skills` (tags), `experience`, `price_range`, `availability`, `images`.
- **UI Behavior:** CRUD interface for Gigs. Users viewing platform listings will see these structured gigs to request direct services.
- **Database:** Maps to Workshops/Gigs blueprint structure.
