import os
import json
import time
import datetime
import hashlib
import uuid
import base64
import hmac
from functools import wraps
from flask import Flask, send_from_directory, request, jsonify, g
from flask_cors import CORS

app = Flask(__name__, static_folder='../frontend')
CORS(app)

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'db', 'db.json'))
TOKEN_SECRET = b"autocare-super-secret-key-signature"

# Ensure upload folder exists
UPLOAD_FOLDER = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'uploads'))
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Helper functions for database IO
def read_db():
    if not os.path.exists(DB_PATH):
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        seed = {
            "users": [],
            "vehicles": [],
            "service_requests": [],
            "messages": [],
            "invoices": [],
            "payment_methods": [],
            "audit_logs": [],
            "workshops": [],
            "mechanics": [],
            "vehicle_owners_db": [],
            "mechanics_db": [],
            "admins_db": [],
            "service_history": [],
            "parts_used": [],
            "uploads": []
        }
        with open(DB_PATH, 'w', encoding='utf-8') as f:
            json.dump(seed, f, indent=2)
        return seed
    try:
        with open(DB_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}

def write_db(data):
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with open(DB_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

def add_audit_log(user_id, action_type, entity_type, entity_id, description, status="success"):
    data = read_db()
    logs = data.setdefault("audit_logs", [])
    new_id = max([log.get("id", 0) for log in logs]) + 1 if logs else 1
    new_log = {
        "id": new_id,
        "user_id": user_id,
        "action_type": action_type,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "description": description,
        "status": status,
        "created_at": datetime.datetime.utcnow().isoformat() + "Z"
    }
    logs.append(new_log)
    write_db(data)
    return new_log

# JWT-like Token operations
def sign_token(payload):
    payload_str = json.dumps(payload, separators=(',', ':'))
    payload_b64 = base64.b64encode(payload_str.encode('utf-8')).decode('utf-8')
    signature = base64.b64encode(
        hmac.new(TOKEN_SECRET, payload_str.encode('utf-8'), hashlib.sha256).digest()
    ).decode('utf-8')
    return f"{payload_b64}.{signature}"

def verify_token(token):
    try:
        parts = token.split(".")
        if len(parts) != 2:
            return None
        payload_b64, signature = parts
        payload_str = base64.b64decode(payload_b64).decode('utf-8')
        test_sig = base64.b64encode(
            hmac.new(TOKEN_SECRET, payload_str.encode('utf-8'), hashlib.sha256).digest()
        ).decode('utf-8')
        if signature == test_sig:
            return json.loads(payload_str)
    except Exception:
        pass
    return None

# Middleware/Decorator for Authentication
def auth_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"success": False, "message": "Authorization token required"}), 401
        token = auth_header[7:]
        user_payload = verify_token(token)
        if not user_payload:
            return jsonify({"success": False, "message": "Invalid or expired authorization token"}), 401
        
        # Verify user still exists in DB
        data = read_db()
        db_user = next((u for u in data.get("users", []) if u.get("id") == user_payload.get("id")), None)
        if not db_user:
            return jsonify({"success": False, "message": "User not registered in database"}), 403
            
        g.user = db_user
        return f(*args, **kwargs)
    return decorated

# ----------------- AUTHENTICATION & PROFILE ENDPOINTS -----------------

@app.route("/api/auth/profile/update", methods=["POST"])
@auth_required
def auth_profile_update():
    body = request.get_json() or {}
    full_name = body.get("full_name")
    if not full_name:
        return jsonify({"success": False, "message": "Full name is required"}), 400
    
    data = read_db()
    user = next((u for u in data.get("users", []) if u.get("id") == g.user["id"]), None)
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404
        
    user["full_name"] = full_name
    
    role = user.get("role", "").lower()
    if role in ["vehicle_owner", "user"]:
        vo = next((u for u in data.setdefault("vehicle_owners_db", []) if u.get("id") == g.user["id"]), None)
        if vo: vo["full_name"] = full_name
    elif role == "mechanic":
        me = next((u for u in data.setdefault("mechanics_db", []) if u.get("id") == g.user["id"]), None)
        if me: me["full_name"] = full_name
        # Update in mechanics profile too
        mech = next((m for m in data.setdefault("mechanics", []) if m.get("user_id") == g.user["id"]), None)
        if mech: mech["full_name"] = full_name
    elif role == "admin":
        ad = next((u for u in data.setdefault("admins_db", []) if u.get("id") == g.user["id"]), None)
        if ad: ad["full_name"] = full_name
        
    write_db(data)
    add_audit_log(g.user["id"], "profile_updated", "User", g.user["id"], f"User {full_name} updated their profile settings.")
    
    return jsonify({
        "success": True,
        "message": "Profile synchronized with registry databases",
        "data": {
            "id": user["id"],
            "full_name": user["full_name"],
            "email": user["email"],
            "role": user["role"]
        }
    })

@app.route("/api/auth/register", methods=["POST"])
def auth_register():
    body = request.get_json() or {}
    full_name = body.get("full_name")
    email = body.get("email")
    password = body.get("password")
    role = body.get("role")
    
    if not full_name or not email or not password or not role:
        return jsonify({"success": False, "message": "Missing required registration parameters"}), 400
        
    data = read_db()
    users = data.setdefault("users", [])
    if any(u.get("email", "").lower() == email.lower() for u in users):
        return jsonify({"success": False, "message": "Email already registered"}), 400
        
    registered_role = role.strip().lower()
    db_role_to_save = "MECHANIC" if registered_role == "mechanic" else "ADMIN" if registered_role == "admin" else "VEHICLE_OWNER"
    
    password_hash = hashlib.sha256(password.encode('utf-8')).hexdigest()
    phone = body.get("phone_number") or body.get("phone") or "0300-1234567"
    city = body.get("city") or "Islamabad"
    
    new_user_id = max([u.get("id", 0) for u in users]) + 1 if users else 1
    new_user = {
        "id": new_user_id,
        "uuid": str(uuid.uuid4()),
        "full_name": full_name,
        "email": email,
        "password": password,
        "phone_number": phone,
        "password_hash": password_hash,
        "role": db_role_to_save,
        "status": "ACTIVE",
        "city": city,
        "profile_image": f"https://ui-avatars.com/api/?name={full_name}&background=random&color=fff",
        "address": "Islamabad, Pakistan",
        "created_at": datetime.datetime.utcnow().isoformat() + "Z",
        "updated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "failed_login_attempts": 0,
        "account_locked": False,
        "account_locked_until": None
    }
    
    if registered_role in ["vehicle_owner", "user"]:
        data.setdefault("vehicle_owners_db", []).append(new_user)
    elif registered_role == "mechanic":
        data.setdefault("mechanics_db", []).append(new_user)
        
        # Create mechanic profile
        mechs = data.setdefault("mechanics", [])
        next_mech_id = max([m.get("id", 0) for m in mechs]) + 1 if mechs else 1
        new_mechanic_profile = {
            "id": next_mech_id,
            "uuid": f"mech-{next_mech_id}-{int(time.time() * 1000)}",
            "user_id": new_user_id,
            "employee_code": f"EMP-MCH-{str(next_mech_id).zfill(3)}",
            "profile_image": "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=200",
            "full_name": full_name,
            "email": email,
            "phone_number": phone,
            "specialization": ["General Repairs", "Maintenance"],
            "experience_years": 3,
            "certifications": ["AutoCare Standard Professional Certification"],
            "workshop_id": 1,
            "current_status": "ACTIVE",
            "current_location_lat": 31.5204,
            "current_location_lng": 74.3587,
            "availability_status": "AVAILABLE",
            "rating": 4.5,
            "total_jobs": 0,
            "completed_jobs": 0,
            "cancelled_jobs": 0,
            "created_at": datetime.datetime.utcnow().isoformat() + "Z",
            "updated_at": datetime.datetime.utcnow().isoformat() + "Z"
        }
        mechs.append(new_mechanic_profile)
    elif registered_role == "admin":
        data.setdefault("admins_db", []).append(new_user)
        
    users.append(new_user)
    write_db(data)
    add_audit_log(new_user_id, "user_created", "User", new_user_id, f"User {full_name} registered as {role}.")
    
    return jsonify({
        "success": True,
        "message": "Registration successful",
        "data": {
            "user": {
                "id": new_user_id,
                "full_name": full_name,
                "email": email,
                "role": db_role_to_save
            }
        }
    }), 201

@app.route("/api/auth/login-direct", methods=["POST"])
def auth_login_direct():
    body = request.get_json() or {}
    email = body.get("email")
    role = body.get("role")
    
    if not email or not role:
        return jsonify({"success": False, "message": "Email and role are required"}), 400
        
    data = read_db()
    user = next((u for u in data.get("users", []) if u.get("email", "").lower() == email.lower()), None)
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 401
        
    token = sign_token({"id": user["id"], "email": user["email"], "role": user.get("role")})
    return jsonify({
        "success": True,
        "message": "Login successful",
        "data": {
            "access_token": token,
            "user": {
                "id": user["id"],
                "full_name": user["full_name"],
                "email": user["email"],
                "role": user.get("role")
            }
        }
    })

@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    body = request.get_json() or {}
    email = body.get("email")
    password = body.get("password")
    role = body.get("role")
    
    if not email or not password:
        return jsonify({"success": False, "message": "Email and password are required"}), 400
        
    data = read_db()
    hashed_password = hashlib.sha256(password.encode('utf-8')).hexdigest()
    user = next((u for u in data.get("users", []) if u.get("email", "").lower() == email.lower() and (u.get("password") == password or u.get("password_hash") == hashed_password)), None)
    
    if not user:
        return jsonify({"success": False, "message": "Invalid email or password"}), 401
        
    selected_role = (role or "").lower()
    db_role = (user.get("role") or "").lower()
    
    role_matches = False
    if selected_role == "user":
        role_matches = db_role in ["user", "vehicle_owner", "owner"]
    else:
        role_matches = db_role == selected_role
        
    if not role_matches:
        display_selected_role = "Vehicle Owner" if selected_role == "user" else selected_role.capitalize()
        return jsonify({
            "success": False,
            "message": f"Account is not registered with the selected role: {display_selected_role}"
        }), 403
        
    token = sign_token({"id": user["id"], "email": user["email"], "role": user.get("role")})
    return jsonify({
        "success": True,
        "message": "Login successful",
        "data": {
            "access_token": token,
            "user": {
                "id": user["id"],
                "full_name": user["full_name"],
                "email": user["email"],
                "role": user.get("role")
            }
        }
    })

# ----------------- VEHICLE OWNER / VEHICLES ENDPOINTS -----------------

@app.route("/api/v1/owner/dashboard", methods=["GET"])
@auth_required
def get_owner_dashboard():
    userId = g.user["id"]
    data = read_db()
    
    user_obj = next((u for u in data.get("users", []) if u.get("id") == userId), {})
    sanitized_user = {
        "id": user_obj.get("id"),
        "full_name": user_obj.get("full_name"),
        "email": user_obj.get("email"),
        "role": user_obj.get("role"),
        "profile_image": user_obj.get("profile_image")
    }
    
    vehicles = data.get("vehicles", [])
    owner_vehicles = [v for v in vehicles if v.get("user_id") == userId]
    total_vehicles = len(owner_vehicles)
    
    vehicles_map = {v["id"]: f"{v.get('make')} {v.get('model')}" for v in owner_vehicles}
    
    service_requests = data.get("service_requests", [])
    owner_requests = [r for r in service_requests if r.get("user_id") == userId]
    
    active_statuses = ["pending", "assigned", "accepted", "in_progress", "scheduled", "on_the_way", "arrived"]
    active_requests_count = len([r for r in owner_requests if (r.get("status") or "").lower() in active_statuses])
    completed_services_count = len([r for r in owner_requests if (r.get("status") or "").lower() == "completed"])
    
    invoices = data.get("invoices", [])
    owner_invoices = [inv for inv in invoices if inv.get("user_id") == userId and (inv.get("status") or "").lower() == "paid"]
    total_spent = sum([float(inv.get("amount") or 0) for inv in owner_invoices])
    
    active_requests_list = []
    for r in owner_requests:
        if (r.get("status") or "").lower() in active_statuses:
            active_requests_list.append({
                "id": r["id"],
                "vehicle": vehicles_map.get(r.get("vehicle_id"), f"Vehicle #{r.get('vehicle_id')}"),
                "request_type": r.get("request_type"),
                "status": r.get("status", "PENDING").upper(),
                "created_at": r.get("created_at"),
                "description": r.get("description")
            })
            
    audit_logs = data.get("audit_logs", [])
    user_logs = [log for log in audit_logs if log.get("user_id") == userId]
    user_logs = sorted(user_logs, key=lambda x: x.get("id", 0), reverse=True)
    
    recent_activity = []
    if user_logs:
        for log in user_logs[:15]:
            action_type = (log.get("action_type") or "").lower()
            if "request_created" in action_type or "create" in action_type:
                action_label = "Request created"
            elif "offer_received" in action_type or "bid" in action_type:
                action_label = "Offer received"
            elif "accept" in action_type or action_type == "request_accepted":
                action_label = "Request accepted"
            elif "start" in action_type or "progress" in action_type:
                action_label = "Service started"
            elif "complete" in action_type:
                action_label = "Service completed"
            else:
                action_label = log.get("action_type") or "Activity Updated"
                
            recent_activity.append({
                "id": log.get("id"),
                "action": action_label,
                "description": log.get("description", ""),
                "timestamp": log.get("created_at")
            })
    else:
        sorted_requests = sorted(owner_requests, key=lambda x: x.get("created_at", ""), reverse=True)
        for r in sorted_requests[:15]:
            status = (r.get("status") or "").lower()
            action_label = "Request Status"
            if status == "pending":
                action_label = "Request created"
            elif status == "assigned":
                action_label = "Request accepted"
            elif status == "in_progress":
                action_label = "Service started"
            elif status == "completed":
                action_label = "Service completed"
                
            recent_activity.append({
                "id": r["id"],
                "action": action_label,
                "description": f"REQ-{r['id']}: Work for {vehicles_map.get(r.get('vehicle_id'), 'your vehicle')} is {r.get('status')}.",
                "timestamp": r.get("created_at")
            })
            
    return jsonify({
        "success": True,
        "data": {
            "user": sanitized_user,
            "vehicles_count": total_vehicles,
            "active_requests_count": active_requests_count,
            "completed_services_count": completed_services_count,
            "total_spending": total_spent,
            "active_requests": active_requests_list,
            "recent_activity": recent_activity
        }
    })

@app.route("/api/v1/vehicles", methods=["GET"])
@app.route("/api/vehicles", methods=["GET"])
@auth_required
def get_vehicles():
    data = read_db()
    vehicles = [v for v in data.get("vehicles", []) if v.get("user_id") == g.user["id"]]
    return jsonify({"success": True, "data": vehicles})

@app.route("/api/v1/vehicles", methods=["POST"])
@app.route("/api/vehicles", methods=["POST"])
@auth_required
def create_vehicle():
    body = request.get_json() or {}
    make = body.get("make")
    model = body.get("model")
    year = body.get("year")
    license_plate = body.get("license_plate")
    color = body.get("color")
    mileage = body.get("mileage") or "0"
    
    if not make or not model or not year or not license_plate:
        return jsonify({"success": False, "message": "Missing vehicle specification parameters"}), 400
        
    data = read_db()
    vehicles = data.setdefault("vehicles", [])
    new_id = max([v.get("id", 0) for v in vehicles]) + 1 if vehicles else 1
    new_vehicle = {
        "id": new_id,
        "user_id": g.user["id"],
        "make": make,
        "model": model,
        "year": int(year),
        "license_plate": license_plate,
        "registration_number": body.get("registration_number") or f"REG-{new_id}",
        "color": color or "",
        "mileage": str(mileage)
    }
    vehicles.append(new_vehicle)
    write_db(data)
    add_audit_log(g.user["id"], "vehicle_created", "Vehicle", new_id, f"Registered new vehicle: {make} {model} ({license_plate})")
    
    return jsonify({"success": True, "data": new_vehicle}), 201

@app.route("/api/v1/vehicles/<int:vid>", methods=["PUT"])
@auth_required
def update_vehicle(vid):
    body = request.get_json() or {}
    data = read_db()
    vehicles = data.setdefault("vehicles", [])
    v = next((x for x in vehicles if x.get("id") == vid and x.get("user_id") == g.user["id"]), None)
    if not v:
        return jsonify({"success": False, "message": "Vehicle not found"}), 404
        
    v["make"] = body.get("make", v["make"])
    v["model"] = body.get("model", v["model"])
    if "year" in body: v["year"] = int(body["year"])
    v["license_plate"] = body.get("license_plate", v["license_plate"])
    v["registration_number"] = body.get("registration_number", v.get("registration_number", ""))
    v["color"] = body.get("color", v.get("color", ""))
    v["mileage"] = str(body.get("mileage", v.get("mileage", "0")))
    
    write_db(data)
    add_audit_log(g.user["id"], "vehicle_updated", "Vehicle", vid, f"Updated vehicle: {v['make']} {v['model']}")
    return jsonify({"success": True, "data": v})

@app.route("/api/v1/vehicles/<int:vid>", methods=["DELETE"])
@auth_required
def delete_vehicle(vid):
    data = read_db()
    vehicles = data.setdefault("vehicles", [])
    idx = next((i for i, x in enumerate(vehicles) if x.get("id") == vid and x.get("user_id") == g.user["id"]), None)
    if idx is None:
        return jsonify({"success": False, "message": "Vehicle not found"}), 404
        
    v = vehicles.pop(idx)
    write_db(data)
    add_audit_log(g.user["id"], "vehicle_deleted", "Vehicle", vid, f"Removed vehicle: {v.get('make')} {v.get('model')}")
    return jsonify({"success": True, "message": "Vehicle removed successfully"})

# ----------------- SERVICE REQUESTS & RECOVERY -----------------

@app.route("/api/service_requests", methods=["POST"])
@auth_required
def create_service_request():
    body = request.get_json() or {}
    vehicle_id = body.get("vehicle_id")
    request_type = body.get("request_type")
    description = body.get("description") or ""
    
    if not vehicle_id or not request_type:
        return jsonify({"success": False, "message": "Missing vehicle or service request type"}), 400
        
    data = read_db()
    reqs = data.setdefault("service_requests", [])
    new_id = max([r.get("id", 0) for r in reqs]) + 1 if reqs else 1
    new_req = {
        "id": new_id,
        "vehicle_id": int(vehicle_id),
        "user_id": g.user["id"],
        "request_type": request_type,
        "description": description,
        "status": "pending",
        "created_at": datetime.datetime.utcnow().isoformat() + "Z"
    }
    reqs.append(new_req)
    write_db(data)
    add_audit_log(g.user["id"], "request_created", "ServiceRequest", new_id, f"Service request created: {request_type} ({description[:40]})")
    return jsonify({"success": True, "message": "Request submitted successfully!", "data": new_req}), 201

@app.route("/api/service_requests/recovery", methods=["POST"])
@auth_required
def create_recovery_request():
    body = request.get_json() or {}
    vehicle_id = body.get("vehicle_id")
    location_lat = body.get("location_lat")
    location_lng = body.get("location_lng")
    description = body.get("description") or ""
    
    if not vehicle_id:
        return jsonify({"success": False, "message": "Missing vehicle selection for recovery"}), 400
        
    data = read_db()
    reqs = data.setdefault("service_requests", [])
    new_id = max([r.get("id", 0) for r in reqs]) + 1 if reqs else 1
    new_req = {
        "id": new_id,
        "vehicle_id": int(vehicle_id),
        "user_id": g.user["id"],
        "request_type": "recovery",
        "description": description,
        "status": "pending",
        "created_at": datetime.datetime.utcnow().isoformat() + "Z",
        "location_lat": float(location_lat or 0.0),
        "location_lng": float(location_lng or 0.0)
    }
    reqs.append(new_req)
    write_db(data)
    add_audit_log(g.user["id"], "recovery_request_created", "ServiceRequest", new_id, f"Roadside recovery request submitted: {description[:40]}")
    return jsonify({"success": True, "message": "Recovery request submitted successfully!", "data": new_req}), 201

@app.route("/api/service_requests/my_requests", methods=["GET"])
@auth_required
def get_my_requests():
    data = read_db()
    reqs = [r for r in data.get("service_requests", []) if r.get("user_id") == g.user["id"] and r.get("request_type") != "recovery"]
    return jsonify({"success": True, "data": reqs})

@app.route("/api/service_requests/my_recoveries", methods=["GET"])
@auth_required
def get_my_recoveries():
    data = read_db()
    reqs = [r for r in data.get("service_requests", []) if r.get("user_id") == g.user["id"] and r.get("request_type") == "recovery"]
    return jsonify({"success": True, "data": reqs})

@app.route("/api/service_requests/<int:rid>", methods=["DELETE"])
@auth_required
def delete_service_request_endpoint(rid):
    data = read_db()
    reqs = data.setdefault("service_requests", [])
    idx = next((i for i, r in enumerate(reqs) if r.get("id") == rid and r.get("user_id") == g.user["id"]), None)
    if idx is None:
        return jsonify({"success": False, "message": "Request not found"}), 404
    r = reqs.pop(idx)
    # Clean up associated invoices
    data["invoices"] = [inv for inv in data.setdefault("invoices", []) if inv.get("service_id") != rid]
    write_db(data)
    add_audit_log(g.user["id"], "request_deleted", "ServiceRequest", rid, f"Service request deleted: REQ-{rid}")
    return jsonify({"success": True, "message": "Request removed successfully"})

@app.route("/api/service_requests/clear_all", methods=["POST"])
@auth_required
def clear_all_service_requests():
    data = read_db()
    reqs = data.setdefault("service_requests", [])
    before_len = len(reqs)
    data["service_requests"] = [r for r in reqs if r.get("user_id") != g.user["id"]]
    cleared_count = before_len - len(data["service_requests"])
    # Clean up associated invoices
    data["invoices"] = [inv for inv in data.setdefault("invoices", []) if not (inv.get("user_id") == g.user["id"] and not any(r.get("id") == inv.get("service_id") for r in data["service_requests"]))]
    write_db(data)
    add_audit_log(g.user["id"], "requests_cleared_all", "User", g.user["id"], f"User purged all active and historic service requests ({cleared_count} requests).")
    return jsonify({"success": True, "message": f"Successfully cleared {cleared_count} requests."})

# File upload
@app.route("/api/uploads", methods=["POST"])
@auth_required
def upload_file_endpoint():
    if 'file' not in request.files:
        return jsonify({"success": False, "message": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "message": "No selected file"}), 400
        
    ext = os.path.splitext(file.filename)[1]
    filename = f"{int(time.time())}-{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(file_path)
    
    file_url = f"/uploads/{filename}"
    return jsonify({
        "success": True,
        "message": "File uploaded successfully!",
        "data": {"fileUrl": file_url},
        "url": file_url
    })

# ----------------- CHAT MESSAGING -----------------

@app.route("/api/messages/contacts", methods=["GET"])
@auth_required
def get_message_contacts():
    data = read_db()
    current_id = g.user["id"]
    current_role = (g.user.get("role") or "").upper()
    
    target_contacts = []
    vehicle_owners = data.get("vehicle_owners_db", [])
    mechanics = data.get("mechanics_db", [])
    users = data.get("users", [])
    
    if current_role == "VEHICLE_OWNER" or current_role == "USER":
        target_contacts = [u for u in users if (u.get("role") or "").upper() == "MECHANIC"]
    elif current_role == "MECHANIC":
        target_contacts = [u for u in users if (u.get("role") or "").upper() in ["VEHICLE_OWNER", "USER"]]
    else:
        target_contacts = [u for u in users if u.get("id") != current_id]
        
    contacts_with_last_msg = []
    msgs = data.setdefault("messages", [])
    
    for user in target_contacts:
        user_msgs = [m for m in msgs if (m.get("sender_id") == current_id and m.get("receiver_id") == user.get("id")) or (m.get("sender_id") == user.get("id") and m.get("receiver_id") == current_id)]
        user_msgs = sorted(user_msgs, key=lambda x: x.get("created_at", ""), reverse=True)
        last_msg = user_msgs[0] if user_msgs else None
        
        contacts_with_last_msg.append({
            "id": user.get("id"),
            "full_name": user.get("full_name"),
            "email": user.get("email"),
            "role": user.get("role"),
            "last_message": last_msg
        })
        
    return jsonify({"success": True, "data": contacts_with_last_msg})

@app.route("/api/messages", methods=["GET"])
@auth_required
def get_chat_messages():
    contact_id = request.args.get("contact_id")
    if not contact_id:
        return jsonify({"success": False, "message": "Missing contact_id parameter"}), 400
    try:
        contact_id = int(contact_id)
    except ValueError:
        return jsonify({"success": False, "message": "Invalid contact_id"}), 400
        
    data = read_db()
    current_id = g.user["id"]
    msgs = data.setdefault("messages", [])
    
    chat_msgs = [m for m in msgs if (m.get("sender_id") == current_id and m.get("receiver_id") == contact_id) or (m.get("sender_id") == contact_id and m.get("receiver_id") == current_id)]
    chat_msgs = sorted(chat_msgs, key=lambda x: x.get("created_at", ""))
    return jsonify({"success": True, "data": chat_msgs})

@app.route("/api/messages", methods=["POST"])
@auth_required
def send_chat_message():
    body = request.get_json() or {}
    receiver_id = body.get("receiver_id")
    content = body.get("content")
    
    if not receiver_id or not content or not content.strip():
        return jsonify({"success": False, "message": "receiver_id and non-empty content are required"}), 400
        
    try:
        receiver_id = int(receiver_id)
    except ValueError:
        return jsonify({"success": False, "message": "Invalid receiver_id"}), 400
        
    data = read_db()
    if not any(u.get("id") == receiver_id for u in data.get("users", [])):
        return jsonify({"success": False, "message": "Receiver not found"}), 404
        
    msgs = data.setdefault("messages", [])
    new_id = max([m.get("id", 0) for m in msgs]) + 1 if msgs else 1
    new_msg = {
        "id": new_id,
        "sender_id": g.user["id"],
        "receiver_id": receiver_id,
        "content": content.strip(),
        "created_at": datetime.datetime.utcnow().isoformat() + "Z"
    }
    msgs.append(new_msg)
    write_db(data)
    return jsonify({"success": True, "message": "Message sent", "data": new_msg}), 201

# ----------------- MECHANIC ENDPOINTS -----------------

@app.route("/api/v1/mechanic/dashboard", methods=["GET"])
@auth_required
def get_mechanic_dashboard():
    if g.user.get("role", "").upper() != "MECHANIC":
        return jsonify({"success": False, "message": "Access Denied: Mechanic profile required"}), 403
        
    data = read_db()
    reqs = data.get("service_requests", [])
    mechs = data.get("mechanics", [])
    
    mechanic_record = next((m for m in mechs if m.get("user_id") == g.user["id"]), None)
    
    def is_my_job(r):
        mech_id = r.get("mechanic_id")
        if not mech_id: return False
        return mech_id == g.user["id"] or (mechanic_record and mech_id == mechanic_record.get("id"))
        
    my_reqs = [r for r in reqs if is_my_job(r)]
    active_jobs = len([r for r in my_reqs if r.get("status") and r.get("status") != "completed"])
    pending_recovery = len([r for r in my_reqs if r.get("request_type") == "recovery" and r.get("status") != "completed"])
    completed_jobs = len([r for r in my_reqs if r.get("status") == "completed"])
    
    # Calculate revenue
    completed_job_ids = [r["id"] for r in my_reqs if r.get("status") == "completed"]
    invoice_earnings = sum([float(inv.get("amount") or 0) for inv in data.get("invoices", []) if inv.get("service_id") in completed_job_ids])
    direct_earnings = sum([float(r.get("final_cost") or 0) for r in my_reqs if r.get("status") == "completed"])
    total_revenue = max(invoice_earnings, direct_earnings) or (completed_jobs * 2500)
    
    # Priority tasks / jobs
    priority_jobs = []
    for r in my_reqs:
        v = next((x for x in data.get("vehicles", []) if x.get("id") == r.get("vehicle_id")), None)
        u = next((x for x in data.get("users", []) if x.get("id") == r.get("user_id")), None)
        priority_jobs.append({
            "id": r["id"],
            "request_type": r.get("request_type"),
            "description": r.get("description"),
            "status": r.get("status"),
            "created_at": r.get("created_at"),
            "location_lat": r.get("location_lat"),
            "location_lng": r.get("location_lng"),
            "vehicle": {
                "make": v.get("make"),
                "model": v.get("model"),
                "year": v.get("year"),
                "license_plate": v.get("license_plate") or v.get("registration_number"),
                "color": v.get("color")
            } if v else None,
            "client": {
                "full_name": u.get("full_name"),
                "phone_number": u.get("phone_number"),
                "email": u.get("email")
            } if u else None
        })
    priority_jobs = sorted(priority_jobs, key=lambda x: x.get("created_at", ""), reverse=True)
    
    return jsonify({
        "success": True,
        "data": {
            "stats": {
                "activeJobs": active_jobs,
                "pendingRecovery": pending_recovery,
                "completed": completed_jobs,
                "revenue": total_revenue
            },
            "priorityJobs": priority_jobs
        }
    })

@app.route("/api/v1/mechanic/jobs", methods=["GET"])
@auth_required
def get_mechanic_jobs():
    if g.user.get("role", "").upper() != "MECHANIC":
        return jsonify({"success": False, "message": "Access Denied: Mechanic profile required"}), 403
        
    data = read_db()
    reqs = data.get("service_requests", [])
    mechanic_record = next((m for m in data.get("mechanics", []) if m.get("user_id") == g.user["id"]), None)
    
    def is_my_job(r):
        mech_id = r.get("mechanic_id")
        if not mech_id: return False
        return mech_id == g.user["id"] or (mechanic_record and mech_id == mechanic_record.get("id"))
        
    my_reqs = [r for r in reqs if is_my_job(r)]
    jobs = []
    for r in my_reqs:
        v = next((x for x in data.get("vehicles", []) if x.get("id") == r.get("vehicle_id")), None)
        u = next((x for x in data.get("users", []) if x.get("id") == r.get("user_id")), None)
        jobs.append({
            "id": r["id"],
            "request_type": r.get("request_type"),
            "description": r.get("description"),
            "status": r.get("status"),
            "created_at": r.get("created_at"),
            "location_lat": r.get("location_lat"),
            "location_lng": r.get("location_lng"),
            "vehicle": {
                "make": v.get("make"),
                "model": v.get("model"),
                "year": v.get("year"),
                "license_plate": v.get("license_plate") or v.get("registration_number"),
                "color": v.get("color")
            } if v else {"make": "Unknown", "model": "Vehicle", "license_plate": "N/A"},
            "client": {
                "full_name": u.get("full_name"),
                "phone_number": u.get("phone_number"),
                "email": u.get("email")
            } if u else {"full_name": "Customer", "phone_number": "N/A"}
        })
    return jsonify({"success": True, "data": jobs})

@app.route("/api/v1/mechanic/jobs/<int:jid>/status", methods=["PUT"])
@auth_required
def update_job_status(jid):
    if g.user.get("role", "").upper() != "MECHANIC":
        return jsonify({"success": False, "message": "Access Denied: Mechanic profile required"}), 403
        
    body = request.get_json() or {}
    status = body.get("status")
    if not status:
        return jsonify({"success": False, "message": "Missing status parameter"}), 400
        
    data = read_db()
    mechanic_record = next((m for m in data.get("mechanics", []) if m.get("user_id") == g.user["id"]), None)
    
    def is_my_job(r):
        mech_id = r.get("mechanic_id")
        if not mech_id: return False
        return mech_id == g.user["id"] or (mechanic_record and mech_id == mechanic_record.get("id"))
        
    job = next((r for r in data.get("service_requests", []) if r.get("id") == jid and is_my_job(r)), None)
    if not job:
        return jsonify({"success": False, "message": "Assigned job not found"}), 404
        
    old_status = job.get("status")
    job["status"] = status.lower()
    
    if status.lower() == "completed":
        # Generate basic invoice if missing
        invoices = data.setdefault("invoices", [])
        if not any(inv.get("service_id") == jid for inv in invoices):
            new_inv_id = max([inv.get("id", 0) for inv in invoices]) + 1 if invoices else 1
            invoices.append({
                "id": new_inv_id,
                "user_id": job.get("user_id"),
                "vehicle_id": job.get("vehicle_id"),
                "service_id": jid,
                "amount": float(job.get("final_cost") or 2500),
                "status": "pending",
                "description": f"Professional AutoCare work completed for request #{jid}: {job.get('description') or job.get('request_type')}",
                "created_at": datetime.datetime.utcnow().isoformat() + "Z"
            })
            
    write_db(data)
    add_audit_log(g.user["id"], "job_status_updated", "ServiceRequest", jid, f"Job #{jid} status updated from {old_status} to {status}.")
    return jsonify({"success": True, "message": "Job status updated successfully", "data": job})

@app.route("/api/v1/mechanic/jobs/<int:jid>/complete", methods=["POST"])
@auth_required
def complete_job_endpoint(jid):
    if g.user.get("role", "").upper() != "MECHANIC":
        return jsonify({"success": False, "message": "Access Denied: Mechanic profile required"}), 403
        
    body = request.get_json() or {}
    final_description = body.get("final_description")
    work_performed = body.get("work_performed")
    parts_used = body.get("parts_used") or []
    completion_images = body.get("completion_images") or []
    
    data = read_db()
    mechanic_record = next((m for m in data.get("mechanics", []) if m.get("user_id") == g.user["id"]), None)
    
    def is_my_job(r):
        mech_id = r.get("mechanic_id")
        if not mech_id: return False
        return mech_id == g.user["id"] or (mechanic_record and mech_id == mechanic_record.get("id"))
        
    job = next((r for r in data.get("service_requests", []) if r.get("id") == jid and is_my_job(r)), None)
    if not job:
        return jsonify({"success": False, "message": "Assigned job not found"}), 404
        
    job["status"] = "completed"
    
    # Calculate costs
    calculated_parts_cost = 0
    for pt in parts_used:
        calculated_parts_cost += (float(pt.get("quantity") or 0) * float(pt.get("price_per_part") or 0))
    labor_charges = 1500
    total_cost = calculated_parts_cost + labor_charges
    job["final_cost"] = total_cost
    
    # Service history
    history = data.setdefault("service_history", [])
    next_hist_id = max([h.get("id", 0) for h in history]) + 1 if history else 1
    history.append({
        "id": next_hist_id,
        "service_request_id": jid,
        "mechanic_id": mechanic_record["id"] if mechanic_record else g.user["id"],
        "work_performed": work_performed or "Routine Technical Maintenance",
        "final_description": final_description or job.get("description") or "Completed successfully",
        "final_cost": total_cost,
        "completed_at": datetime.datetime.utcnow().isoformat() + "Z"
    })
    
    # Parts Used
    parts_list = data.setdefault("parts_used", [])
    for pt in parts_used:
        next_part_id = max([p.get("id", 0) for p in parts_list]) + 1 if parts_list else 1
        parts_list.append({
            "id": next_part_id,
            "service_request_id": jid,
            "part_name": pt.get("part_name"),
            "quantity": int(pt.get("quantity", 1)),
            "price_per_part": float(pt.get("price_per_part", 0)),
            "total_cost": float(pt.get("quantity", 1)) * float(pt.get("price_per_part", 0)),
            "created_at": datetime.datetime.utcnow().isoformat() + "Z"
        })
        
    # Completion uploads
    uploads = data.setdefault("uploads", [])
    for img_url in completion_images:
        next_upload_id = max([u.get("id", 0) for u in uploads]) + 1 if uploads else 1
        uploads.append({
            "id": next_upload_id,
            "service_request_id": jid,
            "url": img_url,
            "uploaded_at": datetime.datetime.utcnow().isoformat() + "Z"
        })
        
    # Update Invoice
    invoices = data.setdefault("invoices", [])
    inv = next((i for i in invoices if i.get("service_id") == jid), None)
    if inv:
        inv["amount"] = total_cost
        inv["description"] = f"Final settlement for Request #{jid}: {work_performed or 'Service Complete'}. Includes Parts + Labor."
    else:
        next_inv_id = max([i.get("id", 0) for i in invoices]) + 1 if invoices else 1
        invoices.append({
            "id": next_inv_id,
            "user_id": job.get("user_id"),
            "vehicle_id": job.get("vehicle_id"),
            "service_id": jid,
            "amount": total_cost,
            "status": "pending",
            "description": f"Final settlement for Request #{jid}: {work_performed or 'Service Complete'}. Includes Parts + Labor.",
            "created_at": datetime.datetime.utcnow().isoformat() + "Z"
        })
        
    write_db(data)
    add_audit_log(g.user["id"], "job_completed_form", "ServiceRequest", jid, f"Job #{jid} finalized by mechanic. Saved service history and billing invoice successfully.")
    return jsonify({
        "success": True,
        "message": "Completion records successfully saved to persistent database registries.",
        "data": job
    })

# Gigs Management
@app.route("/api/v1/mechanic/gigs", methods=["POST"])
@auth_required
def create_service_gig():
    if g.user.get("role", "").upper() != "MECHANIC":
        return jsonify({"success": False, "message": "Access Denied: Mechanic profile required"}), 403
        
    body = request.get_json() or {}
    title = body.get("title")
    description = body.get("description")
    category = body.get("category")
    experience = body.get("experience")
    price_range = body.get("price_range")
    availability = body.get("availability")
    
    if not title or not description or not category:
        return jsonify({"success": False, "message": "Missing required gig attributes"}), 400
        
    data = read_db()
    mechanic_record = next((m for m in data.get("mechanics", []) if m.get("user_id") == g.user["id"]), None)
    m_id = mechanic_record["id"] if mechanic_record else g.user["id"]
    m_name = mechanic_record["full_name"] if mechanic_record else g.user["full_name"]
    
    gigs = data.setdefault("gigs", [])
    new_id = max([g.get("id", 0) for g in gigs]) + 1 if gigs else 1
    new_gig = {
        "id": new_id,
        "mechanic_id": m_id,
        "mechanic_name": m_name,
        "email": g.user["email"],
        "title": title,
        "description": description,
        "category": category,
        "experience": experience or f"{mechanic_record.get('experience_years', 3) if mechanic_record else 3} Years",
        "price_range": price_range or "Rs. 1500 - 5000",
        "availability": availability or "Available",
        "created_at": datetime.datetime.utcnow().isoformat() + "Z"
    }
    gigs.append(new_gig)
    write_db(data)
    add_audit_log(g.user["id"], "gig_created", "Gig", new_id, f"Mechanic created service gig profile: {title}")
    return jsonify({"success": True, "message": "Service gig created successfully", "data": new_gig}), 201

@app.route("/api/v1/mechanic/gigs", methods=["GET"])
@auth_required
def get_mechanic_gigs():
    if g.user.get("role", "").upper() != "MECHANIC":
        return jsonify({"success": False, "message": "Access Denied: Mechanic profile required"}), 403
        
    data = read_db()
    mechanic_record = next((m for m in data.get("mechanics", []) if m.get("user_id") == g.user["id"]), None)
    m_id = mechanic_record["id"] if mechanic_record else g.user["id"]
    
    my_gigs = [g for g in data.get("gigs", []) if g.get("mechanic_id") == m_id]
    return jsonify({"success": True, "data": my_gigs})

@app.route("/api/v1/mechanic/gigs/<int:gid>", methods=["PUT"])
@auth_required
def update_mechanic_gig(gid):
    if g.user.get("role", "").upper() != "MECHANIC":
        return jsonify({"success": False, "message": "Access Denied: Mechanic profile required"}), 403
        
    body = request.get_json() or {}
    data = read_db()
    mechanic_record = next((m for m in data.get("mechanics", []) if m.get("user_id") == g.user["id"]), None)
    m_id = mechanic_record["id"] if mechanic_record else g.user["id"]
    
    gig = next((x for x in data.get("gigs", []) if x.get("id") == gid and x.get("mechanic_id") == m_id), None)
    if not gig:
        return jsonify({"success": False, "message": "Service gig not found or unauthorized"}), 404
        
    gig["title"] = body.get("title", gig["title"])
    gig["description"] = body.get("description", gig["description"])
    gig["category"] = body.get("category", gig["category"])
    gig["experience"] = body.get("experience", gig["experience"])
    gig["price_range"] = body.get("price_range", gig["price_range"])
    gig["availability"] = body.get("availability", gig["availability"])
    
    write_db(data)
    return jsonify({"success": True, "message": "Service gig edited securely and saved successfully", "data": gig})

@app.route("/api/v1/mechanic/gigs/<int:gid>", methods=["DELETE"])
@auth_required
def delete_mechanic_gig(gid):
    if g.user.get("role", "").upper() != "MECHANIC":
        return jsonify({"success": False, "message": "Access Denied: Mechanic profile required"}), 403
        
    data = read_db()
    mechanic_record = next((m for m in data.get("mechanics", []) if m.get("user_id") == g.user["id"]), None)
    m_id = mechanic_record["id"] if mechanic_record else g.user["id"]
    
    gigs = data.setdefault("gigs", [])
    before_len = len(gigs)
    data["gigs"] = [g for g in gigs if not (g.get("id") == gid and g.get("mechanic_id") == m_id)]
    
    if len(data["gigs"]) == before_len:
        return jsonify({"success": False, "message": "Service gig not found or unauthorized"}), 404
        
    write_db(data)
    return jsonify({"success": True, "message": "Service gig erased from database successfully"})

@app.route("/api/v1/gigs", methods=["GET"])
@auth_required
def get_public_gigs():
    data = read_db()
    return jsonify({"success": True, "data": data.get("gigs", [])})

@app.route("/api/v1/mechanic/available_requests", methods=["GET"])
@auth_required
def get_available_requests():
    if g.user.get("role", "").upper() != "MECHANIC":
        return jsonify({"success": False, "message": "Access Denied: Mechanic profile required"}), 403
        
    data = read_db()
    reqs = data.get("service_requests", [])
    available = [r for r in reqs if not r.get("mechanic_id") and (r.get("status") == "pending" or not r.get("status"))]
    
    hydrated = []
    for r in available:
        v = next((x for x in data.get("vehicles", []) if x.get("id") == r.get("vehicle_id")), None)
        u = next((x for x in data.get("users", []) if x.get("id") == r.get("user_id")), None)
        hydrated.append({
            "id": r["id"],
            "request_type": r.get("request_type"),
            "description": r.get("description"),
            "status": r.get("status") or "pending",
            "created_at": r.get("created_at"),
            "location_lat": r.get("location_lat"),
            "location_lng": r.get("location_lng"),
            "vehicle": {
                "make": v.get("make"),
                "model": v.get("model"),
                "year": v.get("year"),
                "license_plate": v.get("license_plate") or v.get("registration_number"),
                "color": v.get("color")
            } if v else {"make": "Unknown", "model": "Vehicle"},
            "client": {
                "full_name": u.get("full_name"),
                "phone_number": u.get("phone_number"),
                "email": u.get("email")
            } if u else {"full_name": "Customer"}
        })
    return jsonify({"success": True, "data": hydrated})

@app.route("/api/v1/mechanic/jobs/<int:jid>/claim", methods=["POST"])
@auth_required
def claim_job_endpoint(jid):
    if g.user.get("role", "").upper() != "MECHANIC":
        return jsonify({"success": False, "message": "Access Denied: Mechanic profile required"}), 403
        
    data = read_db()
    job = next((r for r in data.setdefault("service_requests", []) if r.get("id") == jid), None)
    if not job:
        return jsonify({"success": False, "message": "Service request not found"}), 404
        
    if job.get("mechanic_id"):
        return jsonify({"success": False, "message": "This service request has already been assigned or claimed"}), 400
        
    mechanic_record = next((m for m in data.get("mechanics", []) if m.get("user_id") == g.user["id"]), None)
    mId = mechanic_record["id"] if mechanic_record else g.user["id"]
    
    job["mechanic_id"] = mId
    job["status"] = "accepted"
    
    write_db(data)
    add_audit_log(g.user["id"], "job_claimed", "ServiceRequest", jid, f"Job #{jid} was manually claimed & accepted by mechanic.")
    return jsonify({"success": True, "message": "Service request successfully claimed!", "data": job})

@app.route("/api/v1/user/gigs/assign", methods=["POST"])
@auth_required
def assign_gig_endpoint():
    body = request.get_json() or {}
    gig_id = body.get("gig_id")
    vehicle_id = body.get("vehicle_id")
    description = body.get("description")
    
    if not gig_id or not vehicle_id:
        return jsonify({"success": False, "message": "Missing required fields: gig_id, vehicle_id"}), 400
        
    data = read_db()
    gig = next((g for g in data.get("gigs", []) if g.get("id") == int(gig_id)), None)
    if not gig:
        return jsonify({"success": False, "message": "Gig not found"}), 404
        
    mech_record = next((m for m in data.get("mechanics", []) if m.get("id") == gig.get("mechanic_id") or m.get("user_id") == gig.get("mechanic_id")), None)
    m_id = mech_record["id"] if mech_record else gig.get("mechanic_id")
    
    reqs = data.setdefault("service_requests", [])
    new_id = max([r.get("id", 0) for r in reqs]) + 1 if reqs else 1
    new_req = {
        "id": new_id,
        "vehicle_id": int(vehicle_id),
        "user_id": g.user["id"],
        "request_type": gig.get("category") or "Gig Service",
        "description": f"Assigned via Gig \"{gig.get('title')}\" (Price: {gig.get('price_range')}). User notes: {description or 'None.'}",
        "status": "assigned",
        "priority": "STANDARD",
        "created_at": datetime.datetime.utcnow().isoformat() + "Z",
        "mechanic_id": m_id
    }
    reqs.append(new_req)
    write_db(data)
    add_audit_log(g.user["id"], "gig_assigned_to_mechanic", "ServiceRequest", new_id, f"User assigned gig \"{gig.get('title')}\" to mechanic {gig.get('mechanic_name')}.")
    return jsonify({"success": True, "message": "Task assigned to mechanic successfully!", "data": new_req})

# ----------------- ADMIN DASHBOARD ENDPOINTS -----------------

@app.route("/api/admin/dashboard", methods=["GET"])
@app.route("/api/v1/admin/dashboard", methods=["GET"])
@auth_required
def admin_dashboard_endpoint():
    if g.user.get("role", "").upper() != "ADMIN":
        return jsonify({"success": False, "message": "Access Denied: Admin role required"}), 403
        
    data = read_db()
    users = data.get("users", [])
    
    total_users = len([u for u in users if u.get("role", "").upper() != "ADMIN" and u.get("status", "").lower() not in ["suspended", "deleted"]])
    active_mechanics = len([u for u in users if u.get("role", "").upper() == "MECHANIC" and u.get("status", "").lower() not in ["suspended", "deleted", "inactive"]])
    pending_requests = len([r for r in data.get("service_requests", []) if r.get("status") and r.get("status").lower() in ['pending', 'submitted', 'waiting_assignment']])
    
    now = datetime.datetime.utcnow()
    monthly_rev = sum([float(inv.get("amount") or 0) for inv in data.get("invoices", []) if inv.get("status") == "paid" and datetime.datetime.fromisoformat(inv.get("paid_at", inv.get("created_at", "")).replace("Z", "+00:00")).month == now.month])
    
    # Activity
    recent_activity = []
    for log in reversed(data.get("audit_logs", []))[:20]:
        log_user = next((u for u in users if u.get("id") == log.get("user_id")), None)
        recent_activity.append({
            "id": log.get("id"),
            "user_name": log_user["full_name"] if log_user else f"User #{log.get('user_id')}",
            "action_type": log.get("action_type"),
            "entity_type": log.get("entity_type"),
            "entity_id": log.get("entity_id"),
            "description": log.get("description"),
            "status": log.get("status"),
            "created_at": log.get("created_at")
        })
        
    # Revenue last 7 days
    revenue_chart = []
    invoices = data.get("invoices", [])
    for i in range(6, -1, -1):
        day = now - datetime.timedelta(days=i)
        date_str = day.strftime("%b %d")
        
        day_sum = 0
        for inv in invoices:
            if inv.get("status") != "paid":
                continue
            paid_time_str = inv.get("paid_at") or inv.get("created_at", "")
            try:
                # Simple parsing fallback
                paid_time = datetime.datetime.fromisoformat(paid_time_str.replace("Z", "+00:00"))
                if paid_time.date() == day.date():
                    day_sum += float(inv.get("amount") or 0)
            except Exception:
                pass
        revenue_chart.append({"date": date_str, "value": day_sum})
        
    # System health
    health = {
        "database": "healthy" if os.path.exists(DB_PATH) else "unhealthy",
        "api": "healthy",
        "storage": "healthy" if os.path.exists(UPLOAD_FOLDER) else "unhealthy",
        "upload_service": "healthy"
    }
    
    return jsonify({
        "success": True,
        "data": {
            "dashboard_stats": {
                "total_users": total_users,
                "active_mechanics": active_mechanics,
                "pending_requests": pending_requests,
                "monthly_revenue": monthly_rev
            },
            "recent_activity": recent_activity,
            "revenue_chart": revenue_chart,
            "system_health": health
        }
    })

@app.route("/api/admin/dashboard/revenue", methods=["GET"])
@app.route("/api/v1/admin/dashboard/revenue", methods=["GET"])
@auth_required
def admin_revenue_endpoint():
    if g.user.get("role", "").upper() != "ADMIN":
        return jsonify({"success": False, "message": "Access Denied"}), 403
        
    data = read_db()
    invoices = data.get("invoices", [])
    now = datetime.datetime.utcnow()
    
    revenue_chart = []
    for i in range(6, -1, -1):
        day = now - datetime.timedelta(days=i)
        date_str = day.strftime("%b %d")
        day_sum = 0
        for inv in invoices:
            if inv.get("status") != "paid":
                continue
            paid_time_str = inv.get("paid_at") or inv.get("created_at", "")
            try:
                paid_time = datetime.datetime.fromisoformat(paid_time_str.replace("Z", "+00:00"))
                if paid_time.date() == day.date():
                    day_sum += float(inv.get("amount") or 0)
            except Exception:
                pass
        revenue_chart.append({"date": date_str, "value": day_sum})
        
    return jsonify({"success": True, "data": revenue_chart})

@app.route("/api/admin/system/reset", methods=["POST"])
@auth_required
def admin_system_reset():
    if g.user.get("role", "").upper() != "ADMIN":
        return jsonify({"success": False, "message": "Unauthorized"}), 403
        
    data = read_db()
    empty = {
        "users": [],
        "vehicles": [],
        "service_requests": [],
        "messages": [],
        "invoices": [],
        "payment_methods": [],
        "audit_logs": [],
        "workshops": data.get("workshops", []),
        "mechanics": [],
        "vehicle_owners_db": [],
        "mechanics_db": [],
        "admins_db": [],
        "service_history": [],
        "parts_used": [],
        "uploads": []
    }
    write_db(empty)
    return jsonify({"success": True, "message": "System factory reset completed successfully. All data purged."})

# ----------------- USERS ADMINISTRATION -----------------

@app.route("/api/users", methods=["GET"])
@app.route("/api/users/search", methods=["GET"])
@auth_required
def admin_get_users():
    if g.user.get("role", "").upper() != "ADMIN":
        return jsonify({"success": False, "message": "Access Denied"}), 403
        
    data = read_db()
    users = data.get("users", [])
    
    # Filter out admins
    users = [u for u in users if u.get("role", "").upper() != "ADMIN"]
    
    search = request.args.get("search")
    if search:
        q = search.lower()
        users = [u for u in users if q in u.get("full_name", "").lower() or q in u.get("email", "").lower() or q in u.get("phone_number", "").lower()]
        
    role_filter = request.args.get("role")
    if role_filter:
        users = [u for u in users if u.get("role", "").upper() == role_filter.upper()]
        
    status_filter = request.args.get("status")
    if status_filter:
        users = [u for u in users if u.get("status", "").upper() == status_filter.upper()]
        
    city_filter = request.args.get("city")
    if city_filter:
        q = city_filter.lower()
        users = [u for u in users if q in u.get("city", "").lower()]
        
    start_date = request.args.get("startDate")
    if start_date:
        users = [u for u in users if u.get("created_at", "") >= start_date]
        
    end_date = request.args.get("endDate")
    if end_date:
        users = [u for u in users if u.get("created_at", "") <= end_date]
        
    # Simple sort function
    sort_field = request.args.get("sort") or "created_at"
    order = request.args.get("order") or "desc"
    
    def get_sort_val(u):
        val = u.get(sort_field)
        if val is None: return ""
        if isinstance(val, str): return val.lower()
        return val
        
    users = sorted(users, key=get_sort_val, reverse=(order == "desc"))
    
    vehicles = data.get("vehicles", [])
    reqs = data.get("service_requests", [])
    in_list = data.get("invoices", [])
    
    hydrated = []
    for u in users:
        u_id = u.get("id")
        v_count = len([v for v in vehicles if v.get("user_id") == u_id])
        user_reqs = [r for r in reqs if r.get("user_id") == u_id]
        repair_count = len([r for r in user_reqs if r.get("request_type") != "recovery"])
        recovery_count = len([r for r in user_reqs if r.get("request_type") == "recovery"])
        inv_count = len([i for i in in_list if i.get("user_id") == u_id])
        
        hu = dict(u)
        hu["vehiclesCount"] = v_count
        hu["repairRequestsCount"] = repair_count
        hu["recoveryRequestsCount"] = recovery_count
        hu["invoicesCount"] = inv_count
        hydrated.append(hu)
        
    total = len(hydrated)
    page = int(request.args.get("page") or 1)
    limit = int(request.args.get("limit") or 10)
    start_idx = (page - 1) * limit
    paginated = hydrated[start_idx : start_idx + limit]
    
    return jsonify({
        "success": True,
        "users": paginated,
        "pagination": {
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit
        }
    })

@app.route("/api/users", methods=["POST"])
@auth_required
def admin_create_user():
    if g.user.get("role", "").upper() != "ADMIN":
        return jsonify({"success": False, "message": "Access Denied"}), 403
        
    body = request.get_json() or {}
    email = body.get("email")
    phone = body.get("phone_number")
    full_name = body.get("full_name")
    role = body.get("role") or "VEHICLE_OWNER"
    
    if not email or not phone:
        return jsonify({"success": False, "message": "Email and Phone Number are required"}), 400
        
    data = read_db()
    users = data.setdefault("users", [])
    if any(u.get("email", "").lower() == email.lower() for u in users):
        return jsonify({"success": False, "message": "Email already registered"}), 400
    if any(u.get("phone_number") == phone for u in users):
        return jsonify({"success": False, "message": "Phone number already registered"}), 400
        
    temp_password = "".join([str(uuid.uuid4())[:8]])
    hash_p = hashlib.sha256(temp_password.encode('utf-8')).hexdigest()
    
    new_id = max([u.get("id", 0) for u in users]) + 1 if users else 1
    new_user = {
        "id": new_id,
        "uuid": str(uuid.uuid4()),
        "full_name": full_name or "New Employee",
        "email": email,
        "phone_number": phone,
        "password": temp_password,
        "password_hash": hash_p,
        "role": role.upper(),
        "status": "ACTIVE",
        "profile_image": f"https://ui-avatars.com/api/?name={full_name}&background=random&color=fff",
        "address": body.get("address") or "Main Street Address",
        "city": body.get("city") or "Islamabad",
        "created_at": datetime.datetime.utcnow().isoformat() + "Z",
        "updated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "failed_login_attempts": 0,
        "account_locked": False,
        "account_locked_until": None
    }
    
    users.append(new_user)
    write_db(data)
    add_audit_log(g.user["id"], "user_created", "User", new_id, f"Created {role} user: {full_name} ({email}) with temporary password.")
    return jsonify({"success": True, "data": new_user, "temporaryPassword": temp_password}), 201

@app.route("/api/users/<int:uid>", methods=["GET"])
@auth_required
def admin_get_user_detail(uid):
    if g.user.get("role", "").upper() != "ADMIN":
        return jsonify({"success": False, "message": "Access Denied"}), 403
        
    data = read_db()
    user = next((u for u in data.get("users", []) if u.get("id") == uid), None)
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404
        
    return jsonify({"success": True, "data": user})

@app.route("/api/users/<int:uid>", methods=["PUT"])
@auth_required
def admin_update_user(uid):
    if g.user.get("role", "").upper() != "ADMIN":
        return jsonify({"success": False, "message": "Access Denied"}), 403
        
    body = request.get_json() or {}
    data = read_db()
    user = next((u for u in data.setdefault("users", []) if u.get("id") == uid), None)
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404
        
    user["full_name"] = body.get("full_name", user.get("full_name"))
    user["phone_number"] = body.get("phone_number", user.get("phone_number"))
    user["address"] = body.get("address", user.get("address"))
    user["city"] = body.get("city", user.get("city"))
    user["status"] = body.get("status", user.get("status")).upper()
    user["profile_image"] = body.get("profile_image", user.get("profile_image"))
    user["role"] = body.get("role", user.get("role")).upper()
    user["updated_at"] = datetime.datetime.utcnow().isoformat() + "Z"
    
    write_db(data)
    add_audit_log(g.user["id"], "user_updated", "User", uid, f"Updated account information for {user['full_name']}.")
    return jsonify({"success": True, "data": user})

@app.route("/api/users/<int:uid>", methods=["DELETE"])
@auth_required
def admin_delete_user(uid):
    if g.user.get("role", "").upper() != "ADMIN":
        return jsonify({"success": False, "message": "Access Denied"}), 403
        
    data = read_db()
    users = data.setdefault("users", [])
    idx = next((i for i, u in enumerate(users) if u.get("id") == uid), None)
    if idx is None:
         return jsonify({"success": False, "message": "User not found"}), 404
         
    user = users[idx]
    # Check relations
    vehicles = [v for v in data.get("vehicles", []) if v.get("user_id") == uid]
    reqs = [r for r in data.get("service_requests", []) if r.get("user_id") == uid]
    
    if vehicles or reqs:
        # Soft delete
        user["status"] = "INACTIVE"
        write_db(data)
        add_audit_log(g.user["id"], "user_deleted", "User", uid, f"Soft deleted user [{user['full_name']}] due to active dependencies.")
        return jsonify({"success": True, "mode": "soft_delete"})
        
    users.pop(idx)
    write_db(data)
    add_audit_log(g.user["id"], "user_deleted", "User", uid, f"Permanently purged user registry record for [{user['full_name']}].")
    return jsonify({"success": True, "mode": "permanent_delete"})

@app.route("/api/users/<int:uid>/activate", methods=["PATCH"])
@auth_required
def admin_activate_user(uid):
    return admin_set_user_status_helper(uid, "ACTIVE")

@app.route("/api/users/<int:uid>/suspend", methods=["PATCH"])
@auth_required
def admin_suspend_user(uid):
    return admin_set_user_status_helper(uid, "SUSPENDED")

@app.route("/api/users/<int:uid>/block", methods=["PATCH"])
@auth_required
def admin_block_user(uid):
    return admin_set_user_status_helper(uid, "BLOCKED")

@app.route("/api/users/<int:uid>/unlock", methods=["PATCH"])
@auth_required
def admin_unlock_user(uid):
    if g.user.get("role", "").upper() != "ADMIN":
        return jsonify({"success": False, "message": "Access Denied"}), 403
    data = read_db()
    user = next((u for u in data.setdefault("users", []) if u.get("id") == uid), None)
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404
    user["account_locked"] = False
    user["failed_login_attempts"] = 0
    user["account_locked_until"] = None
    write_db(data)
    add_audit_log(g.user["id"], "account_unlocked", "User", uid, f"Admin unlocked profile or reset attempts of [{user['full_name']}].")
    return jsonify({"success": True, "data": user})

@app.route("/api/users/<int:uid>/reset-password", methods=["PATCH"])
@auth_required
def admin_reset_user_password(uid):
    if g.user.get("role", "").upper() != "ADMIN":
        return jsonify({"success": False, "message": "Access Denied"}), 403
    data = read_db()
    user = next((u for u in data.setdefault("users", []) if u.get("id") == uid), None)
    if not user:
         return jsonify({"success": False, "message": "User not found"}), 404
    temp = "".join([str(uuid.uuid4())[:8]])
    user["password_hash"] = hashlib.sha256(temp.encode('utf-8')).hexdigest()
    user["password"] = temp
    write_db(data)
    add_audit_log(g.user["id"], "password_reset", "User", uid, f"Forced random temporary password credentials update on {user['full_name']}.")
    return jsonify({"success": True, "temporaryPassword": temp})

def admin_set_user_status_helper(uid, status):
    if g.user.get("role", "").upper() != "ADMIN":
        return jsonify({"success": False, "message": "Access Denied"}), 403
    data = read_db()
    user = next((u for u in data.setdefault("users", []) if u.get("id") == uid), None)
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404
    user["status"] = status.upper()
    user["updated_at"] = datetime.datetime.utcnow().isoformat() + "Z"
    
    action = "user_updated"
    if status == "ACTIVE": action = "user_activated"
    elif status == "SUSPENDED": action = "user_suspended"
    elif status == "BLOCKED": action = "user_blocked"
    
    write_db(data)
    add_audit_log(g.user["id"], action, "User", uid, f"Updated user status of [{user['full_name']}] to {status}.")
    return jsonify({"success": True, "data": user})

# ----------------- MECHANICS ADMINISTRATION -----------------

@app.route("/api/mechanics", methods=["GET"])
@app.route("/api/mechanics/search", methods=["GET"])
@auth_required
def admin_get_mechanics():
    if g.user.get("role", "").upper() != "ADMIN":
        return jsonify({"success": False, "message": "Access Denied"}), 403
        
    data = read_db()
    mechs = data.get("mechanics", [])
    
    search = request.args.get("search")
    if search:
        q = search.lower()
        mechs = [m for m in mechs if q in m.get("full_name", "").lower() or q in m.get("email", "").lower() or q in m.get("phone_number", "").lower() or q in m.get("employee_code", "").lower()]
        
    spec = request.args.get("specialization")
    if spec:
        mechs = [m for m in mechs if any(spec.lower() in s.lower() for s in m.get("specialization", []))]
        
    status = request.args.get("status")
    if status:
        mechs = [m for m in mechs if m.get("current_status", "").upper() == status.upper()]
        
    avail = request.args.get("availability")
    if avail:
        mechs = [m for m in mechs if m.get("availability_status", "").upper() == avail.upper()]
        
    rating = request.args.get("rating")
    if rating:
        mechs = [m for m in mechs if float(m.get("rating", 0)) >= float(rating)]
        
    exp = request.args.get("experience")
    if exp:
        mechs = [m for m in mechs if int(m.get("experience_years", 0)) >= int(exp)]
        
    ws_id = request.args.get("workshop_id")
    if ws_id:
        mechs = [m for m in mechs if m.get("workshop_id") == int(ws_id)]
        
    total = len(mechs)
    page = int(request.args.get("page") or 1)
    limit = int(request.args.get("limit") or 10)
    start_idx = (page - 1) * limit
    paginated = mechs[start_idx : start_idx + limit]
    
    return jsonify({
        "success": True,
        "mechanics": paginated,
        "pagination": {
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit
        }
    })

@app.route("/api/requests", methods=["GET"])
@auth_required
def admin_get_all_requests():
    if g.user.get("role", "").upper() != "ADMIN":
         return jsonify({"success": False, "message": "Access Denied"}), 403
    data = read_db()
    return jsonify({"success": True, "data": data.get("service_requests", [])})

@app.route("/api/mechanics", methods=["POST"])
@auth_required
def admin_create_mechanic():
    if g.user.get("role", "").upper() != "ADMIN":
        return jsonify({"success": False, "message": "Access Denied"}), 403
        
    body = request.get_json() or {}
    email = body.get("email")
    phone = body.get("phone_number")
    full_name = body.get("full_name")
    
    if not email or not phone or not full_name:
        return jsonify({"success": False, "message": "Missing mechanic profile parameters"}), 400
        
    data = read_db()
    users = data.setdefault("users", [])
    if any(u.get("email", "").lower() == email.lower() for u in users):
        return jsonify({"success": False, "message": "Email already registered"}), 400
        
    temp_password = "".join([str(uuid.uuid4())[:8]])
    hash_p = hashlib.sha256(temp_password.encode('utf-8')).hexdigest()
    
    new_user_id = max([u.get("id", 0) for u in users]) + 1 if users else 1
    new_user = {
        "id": new_user_id,
        "uuid": str(uuid.uuid4()),
        "full_name": full_name,
        "email": email,
        "phone_number": phone,
        "password": temp_password,
        "password_hash": hash_p,
        "role": "MECHANIC",
        "status": "ACTIVE",
        "profile_image": f"https://ui-avatars.com/api/?name={full_name}&background=random&color=fff",
        "address": body.get("address") or "Main Street Address",
        "city": body.get("city") or "Islamabad",
        "created_at": datetime.datetime.utcnow().isoformat() + "Z",
        "updated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "failed_login_attempts": 0,
        "account_locked": False,
        "account_locked_until": None
    }
    users.append(new_user)
    data.setdefault("mechanics_db", []).append(new_user)
    
    mechs = data.setdefault("mechanics", [])
    next_mech_id = max([m.get("id", 0) for m in mechs]) + 1 if mechs else 1
    new_mech_profile = {
        "id": next_mech_id,
        "uuid": f"mech-{next_mech_id}-{int(time.time() * 1000)}",
        "user_id": new_user_id,
        "employee_code": f"EMP-MCH-{str(next_mech_id).zfill(3)}",
        "profile_image": body.get("profile_image") or "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=200",
        "full_name": full_name,
        "email": email,
        "phone_number": phone,
        "specialization": body.get("specialization") or ["General Repairs"],
        "experience_years": int(body.get("experience_years") or 3),
        "certifications": body.get("certifications") or ["AutoCare Standard Professional Certification"],
        "workshop_id": int(body.get("workshop_id") or 1),
        "current_status": "ACTIVE",
        "current_location_lat": float(body.get("current_location_lat") or 31.5204),
        "current_location_lng": float(body.get("current_location_lng") or 74.3587),
        "availability_status": body.get("availability_status") or "AVAILABLE",
        "rating": float(body.get("rating") or 4.5),
        "total_jobs": 0,
        "completed_jobs": 0,
        "cancelled_jobs": 0,
        "created_at": datetime.datetime.utcnow().isoformat() + "Z",
        "updated_at": datetime.datetime.utcnow().isoformat() + "Z"
    }
    mechs.append(new_mech_profile)
    write_db(data)
    add_audit_log(g.user["id"], "user_created", "User", new_user_id, f"Created MECHANIC user: {full_name} ({email}) with temporary password.")
    return jsonify({"success": True, "data": new_mech_profile, "temporaryPassword": temp_password}), 201

@app.route("/api/mechanics/all", methods=["DELETE"])
@auth_required
def admin_delete_all_mechanics():
    if g.user.get("role", "").upper() != "ADMIN":
         return jsonify({"success": False, "message": "Access Denied"}), 403
    data = read_db()
    mechs = data.setdefault("mechanics", [])
    count = len(mechs)
    data["mechanics"] = []
    # Set status of associated users to inactive
    mech_user_ids = [m.get("user_id") for m in mechs]
    for u in data.setdefault("users", []):
        if u.get("id") in mech_user_ids:
            u["status"] = "INACTIVE"
    write_db(data)
    add_audit_log(g.user["id"], "mechanics_deleted_all", "Mechanic", 0, f"Purged {count} mechanic profiles from registries.")
    return jsonify({"success": True, "deletedCount": count})

@app.route("/api/mechanics/<int:mid>", methods=["GET"])
@auth_required
def admin_get_mechanic(mid):
    if g.user.get("role", "").upper() != "ADMIN":
         return jsonify({"success": False, "message": "Access Denied"}), 403
    data = read_db()
    m = next((x for x in data.get("mechanics", []) if x.get("id") == mid), None)
    if not m:
         return jsonify({"success": False, "message": "Mechanic not found"}), 404
    return jsonify({"success": True, "data": m})

@app.route("/api/mechanics/<int:mid>", methods=["PUT"])
@auth_required
def admin_update_mechanic(mid):
    if g.user.get("role", "").upper() != "ADMIN":
         return jsonify({"success": False, "message": "Access Denied"}), 403
    body = request.get_json() or {}
    data = read_db()
    m = next((x for x in data.setdefault("mechanics", []) if x.get("id") == mid), None)
    if not m:
         return jsonify({"success": False, "message": "Mechanic not found"}), 404
         
    m["full_name"] = body.get("full_name", m.get("full_name"))
    m["phone_number"] = body.get("phone_number", m.get("phone_number"))
    m["specialization"] = body.get("specialization", m.get("specialization"))
    if "experience_years" in body: m["experience_years"] = int(body["experience_years"])
    if "workshop_id" in body: m["workshop_id"] = int(body["workshop_id"])
    m["availability_status"] = body.get("availability_status", m.get("availability_status"))
    m["updated_at"] = datetime.datetime.utcnow().isoformat() + "Z"
    
    # Update associated user
    u = next((x for x in data.setdefault("users", []) if x.get("id") == m.get("user_id")), None)
    if u:
        u["full_name"] = m["full_name"]
        u["phone_number"] = m["phone_number"]
        u["updated_at"] = m["updated_at"]
        
    write_db(data)
    add_audit_log(g.user["id"], "mechanic_updated", "Mechanic", mid, f"Updated mechanic details for {m['full_name']}.")
    return jsonify({"success": True, "data": m})

@app.route("/api/mechanics/<int:mid>", methods=["DELETE"])
@auth_required
def admin_delete_mechanic(mid):
    if g.user.get("role", "").upper() != "ADMIN":
         return jsonify({"success": False, "message": "Access Denied"}), 403
    data = read_db()
    mechs = data.setdefault("mechanics", [])
    idx = next((i for i, x in enumerate(mechs) if x.get("id") == mid), None)
    if idx is None:
         return jsonify({"success": False, "message": "Mechanic not found"}), 404
    m = mechs.pop(idx)
    u = next((x for x in data.setdefault("users", []) if x.get("id") == m.get("user_id")), None)
    if u:
        u["status"] = "INACTIVE"
    write_db(data)
    add_audit_log(g.user["id"], "mechanic_deleted", "Mechanic", mid, f"Purged mechanic profile: {m['full_name']}.")
    return jsonify({"success": True, "deleted": True})

@app.route("/api/mechanics/<int:mid>/status", methods=["PATCH"])
@auth_required
def admin_mechanic_status(mid):
    if g.user.get("role", "").upper() != "ADMIN":
         return jsonify({"success": False, "message": "Access Denied"}), 403
    body = request.get_json() or {}
    status = body.get("status") or request.args.get("status")
    if not status:
         return jsonify({"success": False, "message": "Status parameter is required"}), 400
    data = read_db()
    m = next((x for x in data.setdefault("mechanics", []) if x.get("id") == mid), None)
    if not m:
         return jsonify({"success": False, "message": "Mechanic not found"}), 404
    m["current_status"] = status.upper()
    u = next((x for x in data.setdefault("users", []) if x.get("id") == m.get("user_id")), None)
    if u:
        u["status"] = "ACTIVE" if status.upper() == "ACTIVE" else "INACTIVE"
    write_db(data)
    add_audit_log(g.user["id"], "mechanic_status_updated", "Mechanic", mid, f"Updated status of mechanic {m['full_name']} to {status}.")
    return jsonify({"success": True, "data": m})

@app.route("/api/mechanics/<int:mid>/availability", methods=["PATCH"])
@auth_required
def admin_mechanic_availability(mid):
    if g.user.get("role", "").upper() != "ADMIN":
         return jsonify({"success": False, "message": "Access Denied"}), 403
    body = request.get_json() or {}
    avail = body.get("availability") or request.args.get("availability")
    if not avail:
         return jsonify({"success": False, "message": "Availability parameter is required"}), 400
    data = read_db()
    m = next((x for x in data.setdefault("mechanics", []) if x.get("id") == mid), None)
    if not m:
         return jsonify({"success": False, "message": "Mechanic not found"}), 404
    m["availability_status"] = avail.upper()
    write_db(data)
    add_audit_log(g.user["id"], "mechanic_availability_updated", "Mechanic", mid, f"Updated availability of mechanic {m['full_name']} to {avail}.")
    return jsonify({"success": True, "data": m})

@app.route("/api/mechanics/performance", methods=["GET"])
@auth_required
def admin_get_performance():
    if g.user.get("role", "").upper() != "ADMIN":
         return jsonify({"success": False, "message": "Access Denied"}), 403
         
    data = read_db()
    mechs = data.get("mechanics", [])
    reqs = data.get("service_requests", [])
    
    perf_metrics = []
    for m in mechs:
        m_id = m.get("id")
        mech_reqs = [r for r in reqs if r.get("mechanic_id") == m_id]
        total = len(mech_reqs)
        completed = len([r for r in mech_reqs if r.get("status") == "completed"])
        cancelled = len([r for r in mech_reqs if r.get("status") == "cancelled"])
        active = total - completed - cancelled
        
        perf_metrics.append({
            "mechanic_id": m_id,
            "full_name": m.get("full_name"),
            "employee_code": m.get("employee_code"),
            "total_jobs": total,
            "completed_jobs": completed,
            "active_jobs": active,
            "cancelled_jobs": cancelled,
            "rating": m.get("rating", 4.5)
        })
        
    return jsonify({"success": True, "data": perf_metrics})

@app.route("/api/mechanics/<int:mid>/assign", methods=["POST"])
@auth_required
def admin_assign_job(mid):
    if g.user.get("role", "").upper() != "ADMIN":
         return jsonify({"success": False, "message": "Access Denied"}), 403
    body = request.get_json() or {}
    req_id = body.get("request_id")
    if not req_id:
         return jsonify({"success": False, "message": "request_id parameter is required"}), 400
         
    data = read_db()
    m = next((x for x in data.get("mechanics", []) if x.get("id") == mid), None)
    if not m:
         return jsonify({"success": False, "message": "Mechanic not found"}), 404
         
    job = next((r for r in data.setdefault("service_requests", []) if r.get("id") == int(req_id)), None)
    if not job:
         return jsonify({"success": False, "message": "Service request not found"}), 404
         
    job["mechanic_id"] = mid
    job["status"] = "assigned"
    
    write_db(data)
    add_audit_log(g.user["id"], "job_assigned", "ServiceRequest", req_id, f"Admin assigned Job #{req_id} to mechanic {m['full_name']}.")
    return jsonify({"success": True, "message": "Job assigned successfully", "data": job})

# ----------------- SERVICE REQUESTS ADMINISTRATION -----------------

@app.route("/api/requests", methods=["POST"])
@auth_required
def admin_create_request():
    if g.user.get("role", "").upper() != "ADMIN":
         return jsonify({"success": False, "message": "Access Denied"}), 403
         
    body = request.get_json() or {}
    vehicle_id = body.get("vehicle_id")
    request_type = body.get("request_type")
    description = body.get("description") or ""
    user_id = body.get("user_id")
    
    if not vehicle_id or not request_type or not user_id:
         return jsonify({"success": False, "message": "Missing vehicle, service type, or owner selection"}), 400
         
    data = read_db()
    reqs = data.setdefault("service_requests", [])
    new_id = max([r.get("id", 0) for r in reqs]) + 1 if reqs else 1
    new_req = {
        "id": new_id,
        "vehicle_id": int(vehicle_id),
        "user_id": int(user_id),
        "request_type": request_type,
        "description": description,
        "status": "pending",
        "priority": body.get("priority") or "STANDARD",
        "created_at": datetime.datetime.utcnow().isoformat() + "Z"
    }
    reqs.append(new_req)
    write_db(data)
    add_audit_log(g.user["id"], "request_created", "ServiceRequest", new_id, f"Admin created service request: {request_type} for User #{user_id}.")
    return jsonify({"success": True, "message": "Request created successfully", "data": new_req}), 201

@app.route("/api/requests/<int:rid>", methods=["GET"])
@auth_required
def admin_get_request_detail(rid):
    if g.user.get("role", "").upper() != "ADMIN":
         return jsonify({"success": False, "message": "Access Denied"}), 403
    data = read_db()
    r = next((x for x in data.get("service_requests", []) if x.get("id") == rid), None)
    if not r:
         return jsonify({"success": False, "message": "Request not found"}), 404
    return jsonify({"success": True, "data": r})

@app.route("/api/requests/<int:rid>", methods=["PUT"])
@auth_required
def admin_update_request(rid):
    if g.user.get("role", "").upper() != "ADMIN":
         return jsonify({"success": False, "message": "Access Denied"}), 403
    body = request.get_json() or {}
    data = read_db()
    r = next((x for x in data.setdefault("service_requests", []) if x.get("id") == rid), None)
    if not r:
         return jsonify({"success": False, "message": "Request not found"}), 404
         
    r["request_type"] = body.get("request_type", r["request_type"])
    r["description"] = body.get("description", r["description"])
    if "vehicle_id" in body: r["vehicle_id"] = int(body["vehicle_id"])
    if "user_id" in body: r["user_id"] = int(body["user_id"])
    if "priority" in body: r["priority"] = body["priority"]
    if "status" in body: r["status"] = body["status"]
    
    write_db(data)
    add_audit_log(g.user["id"], "request_updated", "ServiceRequest", rid, f"Admin updated service request details for REQ-{rid}.")
    return jsonify({"success": True, "message": "Request updated successfully", "data": r})

@app.route("/api/requests/<int:rid>", methods=["DELETE"])
@auth_required
def admin_delete_request(rid):
    if g.user.get("role", "").upper() != "ADMIN":
         return jsonify({"success": False, "message": "Access Denied"}), 403
    data = read_db()
    reqs = data.setdefault("service_requests", [])
    idx = next((i for i, x in enumerate(reqs) if x.get("id") == rid), None)
    if idx is None:
         return jsonify({"success": False, "message": "Request not found"}), 404
    reqs.pop(idx)
    write_db(data)
    add_audit_log(g.user["id"], "request_deleted", "ServiceRequest", rid, f"Permanently deleted request REQ-{rid}.")
    return jsonify({"success": True, "message": "Service request permanently deleted."})

@app.route("/api/requests/<int:rid>/status", methods=["PATCH"])
@auth_required
def admin_patch_request_status(rid):
    if g.user.get("role", "").upper() != "ADMIN":
         return jsonify({"success": False, "message": "Access Denied"}), 403
    body = request.get_json() or {}
    status = body.get("status")
    if not status:
         return jsonify({"success": False, "message": "Missing status parameter"}), 400
    data = read_db()
    r = next((x for x in data.setdefault("service_requests", []) if x.get("id") == rid), None)
    if not r:
         return jsonify({"success": False, "message": "Request not found"}), 404
    old = r.get("status")
    r["status"] = status.lower()
    write_db(data)
    add_audit_log(g.user["id"], "request_status_updated", "ServiceRequest", rid, f"Admin updated request REQ-{rid} status from {old} to {status}.")
    return jsonify({"success": True, "message": "Operational status transitioned successfully.", "data": r})

@app.route("/api/requests/<int:rid>/priority", methods=["PATCH"])
@auth_required
def admin_patch_request_priority(rid):
    if g.user.get("role", "").upper() != "ADMIN":
         return jsonify({"success": False, "message": "Access Denied"}), 403
    body = request.get_json() or {}
    priority = body.get("priority")
    if not priority:
         return jsonify({"success": False, "message": "Missing priority parameter"}), 400
    data = read_db()
    r = next((x for x in data.setdefault("service_requests", []) if x.get("id") == rid), None)
    if not r:
         return jsonify({"success": False, "message": "Request not found"}), 404
    r["priority"] = priority.upper()
    write_db(data)
    add_audit_log(g.user["id"], "request_priority_updated", "ServiceRequest", rid, f"Admin updated request REQ-{rid} priority to {priority}.")
    return jsonify({"success": True, "message": "Priority updated successfully.", "data": r})

@app.route("/api/requests/<int:rid>/assign", methods=["PATCH"])
@app.route("/api/requests/<int:rid>/reassign", methods=["PATCH"])
@auth_required
def admin_patch_request_assign(rid):
    if g.user.get("role", "").upper() != "ADMIN":
         return jsonify({"success": False, "message": "Access Denied"}), 403
    body = request.get_json() or {}
    mech_id = body.get("mechanic_id")
    if not mech_id:
         return jsonify({"success": False, "message": "Missing mechanic_id parameter"}), 400
    data = read_db()
    r = next((x for x in data.setdefault("service_requests", []) if x.get("id") == rid), None)
    if not r:
         return jsonify({"success": False, "message": "Request not found"}), 404
    r["mechanic_id"] = int(mech_id)
    r["status"] = "assigned"
    write_db(data)
    add_audit_log(g.user["id"], "request_assigned", "ServiceRequest", rid, f"Admin assigned/reassigned request REQ-{rid} to mechanic #{mech_id}.")
    return jsonify({"success": True, "message": "Mechanic assigned successfully.", "data": r})

@app.route("/api/requests/<int:rid>/notes", methods=["POST"])
@auth_required
def admin_add_request_note(rid):
    if g.user.get("role", "").upper() != "ADMIN":
         return jsonify({"success": False, "message": "Access Denied"}), 403
    body = request.get_json() or {}
    content = body.get("content")
    if not content:
         return jsonify({"success": False, "message": "Missing content parameter"}), 400
    data = read_db()
    r = next((x for x in data.setdefault("service_requests", []) if x.get("id") == rid), None)
    if not r:
         return jsonify({"success": False, "message": "Request not found"}), 404
         
    notes = r.setdefault("admin_notes", [])
    author = g.user.get("full_name") or "Admin Agent"
    new_note = {
        "id": len(notes) + 1,
        "author": author,
        "content": content,
        "created_at": datetime.datetime.utcnow().isoformat() + "Z"
    }
    notes.append(new_note)
    write_db(data)
    add_audit_log(g.user["id"], "request_note_added", "ServiceRequest", rid, f"Admin added note to REQ-{rid}: {content[:30]}")
    return jsonify({"success": True, "message": "Internal note registered.", "data": r})

# ----------------- INVOICES & PAYMENT METHODS -----------------

@app.route("/api/invoices", methods=["GET"])
@auth_required
def get_invoices():
    data = read_db()
    role = g.user.get("role", "").upper()
    
    if role == "ADMIN":
        user_invoices = data.get("invoices", [])
    else:
        user_invoices = [inv for inv in data.get("invoices", []) if inv.get("user_id") == g.user["id"]]
        
    return jsonify({"success": True, "data": user_invoices})

@app.route("/api/invoices/<int:iid>/pay", methods=["POST"])
@auth_required
def pay_invoice_endpoint(iid):
    body = request.get_json() or {}
    payment_method_id = body.get("payment_method_id")
    payment_details = body.get("payment_details")
    
    data = read_db()
    inv = next((x for x in data.setdefault("invoices", []) if x.get("id") == iid), None)
    if not inv:
        return jsonify({"success": False, "message": "Invoice not found"}), 404
        
    role = g.user.get("role", "").upper()
    if inv.get("user_id") != g.user["id"] and role != "ADMIN":
        return jsonify({"success": False, "message": "Unauthorized to pay this invoice"}), 403
        
    if inv.get("status") == "paid":
        return jsonify({"success": False, "message": "Invoice is already paid"}), 400
        
    inv["status"] = "paid"
    inv["paid_at"] = datetime.datetime.utcnow().isoformat() + "Z"
    if payment_method_id:
        inv["payment_method_id"] = int(payment_method_id)
    elif payment_details:
        inv["paid_via"] = payment_details.get("type", "Cash")
        inv["offline_reference"] = payment_details.get("reference", "N/A")
        inv["offline_notes"] = payment_details.get("notes", "")
        
    # Set request to completed
    req = next((r for r in data.setdefault("service_requests", []) if r.get("id") == inv.get("service_id")), None)
    if req:
        req["status"] = "completed"
        
    write_db(data)
    add_audit_log(g.user["id"], "payment_completed", "Invoice", iid, f"Payment of Rs. {inv['amount']} completed for Invoice #{iid}.")
    if req:
        add_audit_log(g.user["id"], "request_completed", "ServiceRequest", inv.get("service_id"), f"Service request #{inv.get('service_id')} marked as completed.")
        
    return jsonify({"success": True, "message": "Payment successfully processed!", "data": inv})

@app.route("/api/payment_methods", methods=["GET"])
@auth_required
def get_payment_methods():
    data = read_db()
    user_methods = [pm for pm in data.setdefault("payment_methods", []) if pm.get("user_id") == g.user["id"]]
    return jsonify({"success": True, "data": user_methods})

@app.route("/api/payment_methods", methods=["POST"])
@auth_required
def add_payment_method():
    body = request.get_json() or {}
    type_pm = body.get("type")
    title = body.get("title")
    account_number = body.get("account_number")
    is_default = body.get("is_default")
    
    if not type_pm or not title or not account_number:
        return jsonify({"success": False, "message": "Type, title, and account number are required fields"}), 400
        
    data = read_db()
    methods = data.setdefault("payment_methods", [])
    next_id = max([pm.get("id", 0) for pm in methods]) + 1 if methods else 1
    
    is_default_bool = bool(is_default)
    
    # Reset other defaults for this user
    if is_default_bool:
        for pm in methods:
            if pm.get("user_id") == g.user["id"]:
                pm["is_default"] = False
                
    new_method = {
        "id": next_id,
        "user_id": g.user["id"],
        "type": type_pm.lower(),
        "title": title,
        "account_number": account_number,
        "is_default": is_default_bool or (len([pm for pm in methods if pm.get("user_id") == g.user["id"]]) == 0)
    }
    methods.append(new_method)
    write_db(data)
    return jsonify({"success": True, "message": "Payment method added successfully!", "data": new_method}), 201

@app.route("/api/payment_methods/<int:pmid>/default", methods=["POST"])
@auth_required
def set_default_payment_method(pmid):
    data = read_db()
    methods = data.setdefault("payment_methods", [])
    method = next((pm for pm in methods if pm.get("id") == pmid and pm.get("user_id") == g.user["id"]), None)
    if not method:
        return jsonify({"success": False, "message": "Payment method not found"}), 404
        
    for pm in methods:
        if pm.get("user_id") == g.user["id"]:
            pm["is_default"] = (pm.get("id") == pmid)
            
    write_db(data)
    return jsonify({"success": True, "message": "Default payment method updated successfully!"})

@app.route("/api/payment_methods/<int:pmid>", methods=["DELETE"])
@auth_required
def delete_payment_method(pmid):
    data = read_db()
    methods = data.setdefault("payment_methods", [])
    idx = next((i for i, pm in enumerate(methods) if pm.get("id") == pmid and pm.get("user_id") == g.user["id"]), None)
    if idx is None:
        return jsonify({"success": False, "message": "Payment method not found"}), 404
        
    was_default = methods[idx].get("is_default")
    methods.pop(idx)
    
    if was_default:
        remaining = [pm for pm in methods if pm.get("user_id") == g.user["id"]]
        if remaining:
            remaining[0]["is_default"] = True
            
    write_db(data)
    return jsonify({"success": True, "message": "Payment method removed successfully!"})

# Exports & health
@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok"})

# ----------------- STATIC ASSET & SINGLE-PAGE APP ROUTER -----------------

@app.route('/uploads/<path:filename>')
def serve_uploaded_files(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_static(path):
    static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'frontend'))
    if path == "" or path is None:
        return send_from_directory(static_dir, 'index.html')
    
    file_path = os.path.join(static_dir, path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return send_from_directory(static_dir, path)
        
    return send_from_directory(static_dir, 'index.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000)
