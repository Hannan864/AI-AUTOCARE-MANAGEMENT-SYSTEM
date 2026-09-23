# Database Master Blueprint

All collections/tables must enforce strict schema, normalization, and relational integrity.

## 1. Users
- **Fields:** id, email, password_hash, role (Enum), name, phone, address, created_at, updated_at
- **Relationships:** One-to-Many with Vehicles, ServiceRequests, AuditLogs.

## 2. Vehicles
- **Fields:** id, owner_id (FK), make, model, year, license_plate, vin, created_at
- **Relationships:** Belongs to User (Owner). One-to-Many with ServiceRequests, ServiceHistory.

## 3. Mechanics
- **Fields:** id, user_id (FK), availability_status, rating, completed_jobs
- **Relationships:** Belongs to User. One-to-Many with Assignments, ServiceOffers, Gigs.

## 4. Workshops / Gigs (Mechanic Gig System)
- **Fields:** id, mechanic_id (FK), title, description, skills (JSON/Array), experience_years, price_range_min, price_range_max, images (JSON/Array), active
- **Relationships:** Belongs to Mechanic.

## 5. ServiceRequests
- **Fields:** id, owner_id (FK), vehicle_id (FK), type, description, status (Enum: PENDING, APPROVED, IN_PROGRESS, COMPLETED, CANCELLED), created_at
- **Relationships:** Belongs to User, Vehicle. One-to-One with Assignments.

## 6. ServiceOffers
- **Fields:** id, request_id (FK), mechanic_id (FK), estimated_cost, notes, status (Enum: PENDING, ACCEPTED, REJECTED)
- **Relationships:** Belongs to ServiceRequests, Mechanics.

## 7. Assignments
- **Fields:** id, request_id (FK), mechanic_id (FK), assigned_by (FK - Admin), scheduled_date, status
- **Relationships:** Belongs to ServiceRequests, Mechanics, Admin User.

## 8. RecoveryRequests (Emergency)
- **Fields:** id, owner_id (FK), location_lat, location_lng, description, status, mechanic_id (FK, nullable)
- **Relationships:** Belongs to User, Mechanics (when accepted).

## 9. Uploads
- **Fields:** id, uploader_id (FK), file_url, entity_type, entity_id, created_at
- **Relationships:** Polymorphic relation to various tables.

## 10. PartsUsed
- **Fields:** id, request_id (FK), part_name, cost, quantity
- **Relationships:** Belongs to ServiceRequests.

## 11. ServiceHistory
- **Fields:** id, vehicle_id (FK), request_id (FK), mechanic_id (FK), final_cost, summary, date_completed
- **Relationships:** Archival records based on ServiceRequests.

## 12. Notifications
- **Fields:** id, user_id (FK), title, message, is_read, created_at
- **Relationships:** Belongs to User.

## 13. AuditLogs
- **Fields:** id, admin_id (FK), action, target_table, target_id, details (JSON), timestamp
- **Relationships:** Belongs to User (Admin).

## 14. PasswordResetTokens
- **Fields:** id, user_id (FK), token_hash, expires_at
- **Relationships:** Belongs to User.
