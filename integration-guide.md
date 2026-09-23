# Integration Guide: AutoCare Pro Frontend with Flask

This guide explains how to integrate the pure HTML/CSS/JS frontend files into a Python Flask backend application.

## 1. Directory Structure

In a standard Flask application, static files (CSS, JS, Images) go into the `static/` folder, and HTML templates go into the `templates/` folder.

Move the generated files into your Flask project like this:

```text
your_flask_app/
âââ app.py
âââ static/
â   âââ styles.css
â   âââ app.js
âââ templates/
    âââ index.html
    âââ register.html
    âââ user-dashboard.html
    âââ ... (all other .html files)
```

## 2. Converting HTML to Jinja2 Templates

To make the HTML files work with Flask, you need to update the paths for CSS and JS files using Flask's `url_for` function.

### Update CSS and JS Links

In **every** HTML file, change the `<link>` and `<script>` tags:

**From:**
```html
<link rel="stylesheet" href="styles.css">
<script src="app.js"></script>
```

**To:**
```html
<link rel="stylesheet" href="{{ url_for('static', filename='styles.css') }}">
<script src="{{ url_for('static', filename='app.js') }}"></script>
```

### Update Navigation Links

Change standard HTML links to Flask route links:

**From:**
```html
<a href="user-dashboard.html">Dashboard</a>
```

**To:**
```html
<a href="{{ url_for('user_dashboard') }}">Dashboard</a>
```

## 3. Handling Form Submissions (Fetch API)

Currently, the frontend uses vanilla JavaScript with `setTimeout` to simulate API calls. You need to replace this with actual `fetch` calls to your Flask backend.

Example for `index.html` (Login):

**Current Fake Logic:**
```javascript
// Fake API call
setTimeout(() => {
    window.showToast('Login successful! Redirecting...', 'success');
    window.location.href = 'user-dashboard.html';
}, 1500);
```

**New Real Logic (Flask API):**
```javascript
fetch('/api/login', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password })
})
.then(response => response.json())
.then(data => {
    if (data.success) {
        window.showToast('Login successful!', 'success');
        // Redirect based on role returned from Flask
        window.location.href = data.redirect_url; 
    } else {
        window.showToast(data.message || 'Login failed', 'error');
        btn.innerHTML = originalText; // Reset button
    }
})
.catch(error => {
    window.showToast('Network error occurred', 'error');
    btn.innerHTML = originalText;
});
```

## 4. Flask Backend Example (`app.py`)

Here is a basic example of how your Flask routes should look to serve these templates:

```python
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# --- Page Routes ---

@app.route('/')
def login():
    return render_template('index.html')

@app.route('/register')
def register():
    return render_template('register.html')

@app.route('/user/dashboard')
def user_dashboard():
    # You can pass dynamic data here
    # return render_template('user-dashboard.html', user_name="Ahmed Khan")
    return render_template('user-dashboard.html')

# --- API Routes ---

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    # Add your database validation logic here
    if email == "admin@autocare.pk" and password == "admin123":
        return jsonify({"success": True, "redirect_url": "/admin/dashboard"})
    elif email == "ahmed@example.com":
        return jsonify({"success": True, "redirect_url": "/user/dashboard"})
    else:
        return jsonify({"success": False, "message": "Invalid credentials"})

if __name__ == '__main__':
    app.run(debug=True)
```

## 5. Dynamic Data Rendering (Jinja2)

Instead of hardcoding data in the HTML, pass it from Flask and loop through it.

**Flask:**
```python
@app.route('/user/vehicles')
def user_vehicles():
    vehicles = [
        {"make": "Honda", "model": "Civic", "plate": "ABC-1234"},
        {"make": "Suzuki", "model": "Alto", "plate": "XYZ-9876"}
    ]
    return render_template('user-vehicles.html', vehicles=vehicles)
```

**HTML (user-vehicles.html):**
```html
<div class="vehicle-grid" id="vehicleGrid">
    {% for v in vehicles %}
    <div class="vehicle-card">
        <div class="vehicle-header">
            <div>
                <h3>{{ v.make }} {{ v.model }}</h3>
            </div>
            <div class="vehicle-plate">{{ v.plate }}</div>
        </div>
        <!-- ... rest of card ... -->
    </div>
    {% endfor %}
</div>
```

## 6. Security Notes

1. **CSRF Protection**: If using Flask-WTF, ensure you add `<input type="hidden" name="csrf_token" value="{{ csrf_token() }}"/>` to your forms and pass it in your fetch headers.
2. **Authentication**: Use `Flask-Login` to protect the dashboard routes (`@login_required`) so users cannot access them without logging in.
