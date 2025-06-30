from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
import os
import sqlite3
from datetime import datetime, date
import hashlib
import jwt
from functools import wraps
import random

app = Flask(__name__)
CORS(app)

# Configuration
app.config['SECRET_KEY'] = 'your-secret-key-here'
GEMINI_API_KEY = "AIzaSyBjNqmnCaStB_J1IqDz8lrNvhnYs7Keg4g"

# Initialize Gemini
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-1.5-pro')

# Database setup
def init_db():
    conn = sqlite3.connect('smart_city_water.db')
    cursor = conn.cursor()
    
    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            user_type TEXT NOT NULL,
            email TEXT,
            organization TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Buildings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS buildings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            building_name TEXT NOT NULL,
            building_code TEXT UNIQUE NOT NULL,
            water_requirement INTEGER DEFAULT 50,
            preferred_source TEXT DEFAULT 'both',
            river_water_ratio INTEGER DEFAULT 60,
            ground_water_ratio INTEGER DEFAULT 40,
            apartments INTEGER DEFAULT 20,
            priority INTEGER DEFAULT 2,
            is_active BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Water requests table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS water_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            requester_id INTEGER,
            requester_type TEXT NOT NULL,
            building_id INTEGER,
            water_amount INTEGER NOT NULL,
            request_type TEXT NOT NULL,
            reason TEXT,
            event_type TEXT,
            duration INTEGER DEFAULT 1,
            status TEXT DEFAULT 'pending',
            ai_recommendation TEXT,
            admin_notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (requester_id) REFERENCES users (id),
            FOREIGN KEY (building_id) REFERENCES buildings (id)
        )
    ''')
    
    # Daily water distribution table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS daily_distribution (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date DATE UNIQUE NOT NULL,
            river_water_total INTEGER DEFAULT 0,
            ground_water_total INTEGER DEFAULT 0,
            total_delivered INTEGER DEFAULT 0,
            wastage INTEGER DEFAULT 0,
            efficiency_percentage REAL DEFAULT 0,
            simulation_status TEXT DEFAULT 'not_started',
            reservoir_storage INTEGER DEFAULT 0,
            water_shortage INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Building daily water allocation table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS building_allocation (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date DATE NOT NULL,
            building_id INTEGER NOT NULL,
            river_water INTEGER DEFAULT 0,
            ground_water INTEGER DEFAULT 0,
            total_water INTEGER DEFAULT 0,
            is_default BOOLEAN DEFAULT 1,
            required_water INTEGER DEFAULT 0,
            shortage INTEGER DEFAULT 0,
            excess INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (building_id) REFERENCES buildings (id),
            UNIQUE(date, building_id)
        )
    ''')
    
    # Houses table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS houses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            building_id INTEGER NOT NULL,
            house_number INTEGER NOT NULL,
            num_people INTEGER NOT NULL,
            water_requirement INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (building_id) REFERENCES buildings (id),
            UNIQUE(building_id, house_number)
        )
    ''')
    
    # House extra water requests table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS house_extra_water_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            house_id INTEGER NOT NULL,
            building_id INTEGER NOT NULL,
            extra_water_amount INTEGER NOT NULL,
            reason TEXT,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (house_id) REFERENCES houses (id),
            FOREIGN KEY (building_id) REFERENCES buildings (id)
        )
    ''')
    
    # Add new columns to existing tables if they don't exist
    try:
        cursor.execute('ALTER TABLE daily_distribution ADD COLUMN reservoir_storage INTEGER DEFAULT 0')
    except:
        pass  # Column already exists
    
    try:
        cursor.execute('ALTER TABLE daily_distribution ADD COLUMN water_shortage INTEGER DEFAULT 0')
    except:
        pass  # Column already exists
    
    try:
        cursor.execute('ALTER TABLE building_allocation ADD COLUMN required_water INTEGER DEFAULT 0')
    except:
        pass  # Column already exists
    
    try:
        cursor.execute('ALTER TABLE building_allocation ADD COLUMN shortage INTEGER DEFAULT 0')
    except:
        pass  # Column already exists
    
    try:
        cursor.execute('ALTER TABLE building_allocation ADD COLUMN excess INTEGER DEFAULT 0')
    except:
        pass  # Column already exists
    
    # Insert admin user
    admin_password = hashlib.sha256('admin123'.encode()).hexdigest()
    cursor.execute('''
        INSERT OR IGNORE INTO users (username, password_hash, user_type, email)
        VALUES (?, ?, ?, ?)
    ''', ('admin', admin_password, 'admin', 'admin@smartcity.com'))
    
    # Insert 160 building users with simple credentials
    building_password = hashlib.sha256('12345'.encode()).hexdigest()
    for i in range(1, 161):
        building_username = f'building{i}'
        cursor.execute('''
            INSERT OR IGNORE INTO users (username, password_hash, user_type, email, organization)
            VALUES (?, ?, ?, ?, ?)
        ''', (building_username, building_password, 'building', f'{building_username}@smartcity.com', f'Building {i} Management'))
    
    # Insert default buildings
    for i in range(1, 161):
        building_code = f"BLD{i:03d}"
        cursor.execute('''
            INSERT OR IGNORE INTO buildings 
            (building_name, building_code, water_requirement, preferred_source, river_water_ratio, ground_water_ratio, apartments, priority)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            f"Building {i}",
            building_code,
            50 + (i % 30),  # 50-80 units
            'both' if i % 3 == 0 else ('river' if i % 2 == 0 else 'ground'),
            60 if i % 3 == 0 else (100 if i % 2 == 0 else 0),
            40 if i % 3 == 0 else (0 if i % 2 == 0 else 100),
            10 + (i % 20),  # 10-30 apartments
            1 + (i % 3)  # 1-3 priority
        ))
        # Insert houses for each building
        cursor.execute('SELECT id, apartments FROM buildings WHERE building_code = ?', (building_code,))
        building_row = cursor.fetchone()
        if building_row:
            building_id = building_row[0]
            num_apartments = building_row[1]
            for house_num in range(1, num_apartments + 1):
                num_people = random.randint(4, 8)
                water_requirement = num_people * 175
                cursor.execute('''
                    INSERT OR IGNORE INTO houses (building_id, house_number, num_people, water_requirement)
                    VALUES (?, ?, ?, ?)
                ''', (building_id, house_num, num_people, water_requirement))
    
    conn.commit()
    conn.close()

# Initialize database on startup
init_db()

# Authentication decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'message': 'Token is missing'}), 401
        try:
            token = token.split(' ')[1]
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user = data['user_id']
        except:
            return jsonify({'message': 'Token is invalid'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

# Helper functions
def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def generate_token(user_id):
    return jwt.encode({'user_id': user_id}, app.config['SECRET_KEY'], algorithm='HS256')

def get_db_connection():
    conn = sqlite3.connect('smart_city_water.db')
    conn.row_factory = sqlite3.Row
    return conn

# Routes
@app.route('/')
def index():
    return "Backend is running!"

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'message': 'Username and password required'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM users WHERE username = ?', (username,))
    user = cursor.fetchone()
    conn.close()
    
    if user and user['password_hash'] == hash_password(password):
        token = generate_token(user['id'])
        return jsonify({
            'token': token,
            'user': {
                'id': user['id'],
                'username': user['username'],
                'user_type': user['user_type'],
                'email': user['email'],
                'organization': user['organization']
            }
        })
    else:
        return jsonify({'message': 'Invalid credentials'}), 401

@app.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    user_type = data.get('user_type', 'building')
    email = data.get('email')
    organization = data.get('organization')
    
    if not username or not password:
        return jsonify({'message': 'Username and password required'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if username exists
    cursor.execute('SELECT id FROM users WHERE username = ?', (username,))
    if cursor.fetchone():
        conn.close()
        return jsonify({'message': 'Username already exists'}), 400
    
    # Create user
    password_hash = hash_password(password)
    cursor.execute('''
        INSERT INTO users (username, password_hash, user_type, email, organization)
        VALUES (?, ?, ?, ?, ?)
    ''', (username, password_hash, user_type, email, organization))
    
    user_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    token = generate_token(user_id)
    return jsonify({
        'token': token,
        'user': {
            'id': user_id,
            'username': username,
            'user_type': user_type,
            'email': email,
            'organization': organization
        }
    })

@app.route('/api/buildings', methods=['GET'])
@token_required
def get_buildings(current_user):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM buildings WHERE is_active = 1')
    buildings = cursor.fetchall()
    conn.close()
    
    return jsonify([dict(building) for building in buildings])

@app.route('/api/buildings/<int:building_id>', methods=['GET'])
@token_required
def get_building(current_user, building_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM buildings WHERE id = ?', (building_id,))
    building = cursor.fetchone()
    conn.close()
    
    if building:
        return jsonify(dict(building))
    else:
        return jsonify({'message': 'Building not found'}), 404

@app.route('/api/buildings/<int:building_id>/water-requirement', methods=['PUT'])
@token_required
def update_water_requirement(current_user, building_id):
    data = request.get_json()
    water_requirement = data.get('water_requirement')
    
    if not water_requirement or water_requirement < 0:
        return jsonify({'message': 'Valid water requirement required'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if building exists
    cursor.execute('SELECT id FROM buildings WHERE id = ?', (building_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'message': 'Building not found'}), 404
    
    # Update water requirement
    cursor.execute('''
        UPDATE buildings SET water_requirement = ? WHERE id = ?
    ''', (water_requirement, building_id))
    
    # Update today's allocation
    today = date.today().isoformat()
    cursor.execute('''
        INSERT OR REPLACE INTO building_allocation 
        (date, building_id, river_water, ground_water, total_water, is_default)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (
        today, building_id,
        int(water_requirement * 0.6),  # Default 60% river
        int(water_requirement * 0.4),  # Default 40% ground
        water_requirement,
        0  # Not default since user updated
    ))
    
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Water requirement updated successfully'})

@app.route('/api/water-requests', methods=['POST'])
@token_required
def create_water_request(current_user):
    data = request.get_json()
    
    # Get user info
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT user_type FROM users WHERE id = ?', (current_user,))
    user = cursor.fetchone()
    
    if not user:
        conn.close()
        return jsonify({'message': 'User not found'}), 404
    
    # Create request
    cursor.execute('''
        INSERT INTO water_requests 
        (requester_id, requester_type, building_id, water_amount, request_type, reason, event_type, duration)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        current_user,
        user['user_type'],
        data.get('building_id'),
        data.get('water_amount'),
        data.get('request_type', 'event'),
        data.get('reason'),
        data.get('event_type'),
        data.get('duration', 1)
    ))
    
    request_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    # Generate AI recommendation
    ai_recommendation = generate_ai_recommendation(data)
    
    # Update request with AI recommendation
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE water_requests SET ai_recommendation = ? WHERE id = ?
    ''', (ai_recommendation, request_id))
    conn.commit()
    conn.close()
    
    return jsonify({
        'message': 'Water request created successfully',
        'request_id': request_id,
        'ai_recommendation': ai_recommendation
    })

@app.route('/api/water-requests', methods=['GET'])
@token_required
def get_water_requests(current_user):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get user info
    cursor.execute('SELECT user_type FROM users WHERE id = ?', (current_user,))
    user = cursor.fetchone()
    
    if user['user_type'] == 'admin':
        # Admin sees all requests
        cursor.execute('''
            SELECT wr.*, u.username, u.organization, b.building_name
            FROM water_requests wr
            LEFT JOIN users u ON wr.requester_id = u.id
            LEFT JOIN buildings b ON wr.building_id = b.id
            ORDER BY wr.created_at DESC
        ''')
    else:
        # Users see only their requests
        cursor.execute('''
            SELECT wr.*, u.username, u.organization, b.building_name
            FROM water_requests wr
            LEFT JOIN users u ON wr.requester_id = u.id
            LEFT JOIN buildings b ON wr.building_id = b.id
            WHERE wr.requester_id = ?
            ORDER BY wr.created_at DESC
        ''', (current_user,))
    
    requests = cursor.fetchall()
    conn.close()
    
    return jsonify([dict(req) for req in requests])

@app.route('/api/water-requests/<int:request_id>/approve', methods=['PUT'])
@token_required
def approve_water_request(current_user, request_id):
    # Check if user is admin
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT user_type FROM users WHERE id = ?', (current_user,))
    user = cursor.fetchone()
    
    if user['user_type'] != 'admin':
        conn.close()
        return jsonify({'message': 'Admin access required'}), 403
    
    data = request.get_json()
    status = data.get('status', 'approved')
    admin_notes = data.get('admin_notes', '')
    
    cursor.execute('''
        UPDATE water_requests 
        SET status = ?, admin_notes = ?
        WHERE id = ?
    ''', (status, admin_notes, request_id))
    
    conn.commit()
    conn.close()
    
    return jsonify({'message': f'Request {status} successfully'})

@app.route('/api/simulation/start', methods=['POST'])
@token_required
def start_simulation(current_user):
    # Check if user is admin
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT user_type FROM users WHERE id = ?', (current_user,))
    user = cursor.fetchone()
    
    if user['user_type'] != 'admin':
        conn.close()
        return jsonify({'message': 'Admin access required'}), 403
    
    today = date.today().isoformat()
    
    # Check if simulation already exists for today
    cursor.execute('SELECT id FROM daily_distribution WHERE date = ?', (today,))
    if cursor.fetchone():
        conn.close()
        return jsonify({'message': 'Simulation already exists for today'}), 400
    
    # Create new simulation
    cursor.execute('''
        INSERT INTO daily_distribution (date, simulation_status)
        VALUES (?, ?)
    ''', (today, 'started'))
    
    # Create default allocations for all buildings
    cursor.execute('SELECT * FROM buildings WHERE is_active = 1')
    buildings = cursor.fetchall()
    
    for building in buildings:
        cursor.execute('''
            INSERT OR REPLACE INTO building_allocation 
            (date, building_id, river_water, ground_water, total_water, is_default)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            today, building['id'],
            int(building['water_requirement'] * building['river_water_ratio'] / 100),
            int(building['water_requirement'] * building['ground_water_ratio'] / 100),
            building['water_requirement'],
            1
        ))
    
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Simulation started successfully'})

@app.route('/api/simulation/status', methods=['GET'])
@token_required
def get_simulation_status(current_user):
    today = date.today().isoformat()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM daily_distribution WHERE date = ?', (today,))
    distribution = cursor.fetchone()
    
    if not distribution:
        conn.close()
        return jsonify({'status': 'not_started'})
    
    # Get building allocations
    cursor.execute('''
        SELECT ba.*, b.building_name, b.building_code
        FROM building_allocation ba
        JOIN buildings b ON ba.building_id = b.id
        WHERE ba.date = ?
        ORDER BY b.building_code
    ''', (today,))
    
    allocations = cursor.fetchall()
    conn.close()
    
    return jsonify({
        'status': distribution['simulation_status'],
        'distribution': dict(distribution),
        'allocations': [dict(allocation) for allocation in allocations]
    })

@app.route('/api/simulation/run', methods=['POST'])
@token_required
def run_simulation(current_user):
    # Check if user is admin
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT user_type FROM users WHERE id = ?', (current_user,))
    user = cursor.fetchone()
    
    if not user or user['user_type'] != 'admin':
        conn.close()
        return jsonify({'message': 'Admin access required'}), 403
    
    try:
        data = request.get_json()
        disruptions = data.get('disruptions', {})
        river_water_amount = data.get('river_water_amount', 1000)
        ground_water_amount = data.get('ground_water_amount', 1000)
        buildings = data.get('buildings', [])
        approved_requests = data.get('approved_requests', [])
        extra_water_requests = data.get('extra_water_requests', [])
        event_water_requests = data.get('event_water_requests', [])
        
        # Calculate total water needed
        total_water_needed = sum(building['water_requirement'] for building in buildings)
        
        # Calculate extra water from approved requests
        extra_water_total = sum(req['water_amount'] for req in extra_water_requests)
        event_water_total = sum(req['water_amount'] for req in event_water_requests)
        total_extra_water = extra_water_total + event_water_total
        
        # Calculate wastage based on disruptions
        wastage = {
            'pipeLeak': disruptions.get('pipeLeak', False) * (river_water_amount * 0.1),
            'wellDry': disruptions.get('wellDry', False) * (ground_water_amount * 0.15),
            'riverPollution': disruptions.get('riverPollution', False) * (river_water_amount * 0.2),
            'pumpFailure': disruptions.get('pumpFailure', False) * ((river_water_amount + ground_water_amount) * 0.12)
        }
        total_wastage = sum(wastage.values())
        
        # Calculate available water after wastage
        available_river = river_water_amount - wastage['pipeLeak'] - wastage['riverPollution']
        available_ground = ground_water_amount - wastage['wellDry'] - wastage['pumpFailure']
        total_available = available_river + available_ground
        
        # Check if we have enough water for all requirements
        total_required = total_water_needed + total_extra_water
        water_shortage = max(0, total_required - total_available)
        excess_water = max(0, total_available - total_required)
        
        # Calculate proportional distribution factor if there's a shortage
        distribution_factor = 1.0
        if total_required > total_available and total_required > 0:
            distribution_factor = total_available / total_required
        
        # Calculate water distribution to buildings with proportional allocation
        building_allocations = {}
        total_delivered = 0
        reservoir_storage = 0
        
        for building in buildings:
            building_id = building['id']
            base_requirement = building['water_requirement']
            
            # Calculate proportional allocation based on available water
            proportional_requirement = base_requirement * distribution_factor
            
            # Calculate river and groundwater allocation based on building preferences
            river_ratio = building.get('river_water_ratio', 60) / 100
            ground_ratio = building.get('ground_water_ratio', 40) / 100
            
            # Adjust ratios if one source is unavailable due to disruptions
            if disruptions.get('riverPollution', False) or disruptions.get('pipeLeak', False):
                river_ratio = 0
                ground_ratio = 1
            if disruptions.get('wellDry', False) or disruptions.get('pumpFailure', False):
                ground_ratio = 0
                river_ratio = 1
            
            # Calculate allocation with proportional distribution
            river_allocation = min(available_river * river_ratio, proportional_requirement * river_ratio)
            ground_allocation = min(available_ground * ground_ratio, proportional_requirement * ground_ratio)
            
            # Add extra water if building has approved requests
            extra_for_building = sum(req['water_amount'] for req in extra_water_requests if req.get('building_id') == building_id)
            event_for_building = sum(req['water_amount'] for req in event_water_requests if req.get('building_id') == building_id)
            total_extra_for_building = extra_for_building + event_for_building
            
            total_allocation = river_allocation + ground_allocation + total_extra_for_building
            
            building_allocations[building_id] = {
                'river_water': river_allocation,
                'ground_water': ground_allocation,
                'total_water': total_allocation,
                'extra_water': total_extra_for_building,
                'required_water': base_requirement,
                'proportional_requirement': proportional_requirement,
                'requirement_met': total_allocation >= base_requirement,
                'satisfaction_percentage': min(100, (total_allocation / base_requirement) * 100) if base_requirement > 0 else 100,
                'shortage': max(0, base_requirement - total_allocation),
                'excess': max(0, total_allocation - base_requirement)
            }
            
            total_delivered += total_allocation
            available_river -= river_allocation
            available_ground -= ground_allocation
        
        # Store excess water in reservoir
        reservoir_storage = excess_water
        
        # Calculate efficiency
        efficiency_percentage = (total_delivered / total_required) * 100 if total_required > 0 else 0
        
        # Prepare results
        results = {
            'river_water': river_water_amount - available_river,
            'ground_water': ground_water_amount - available_ground,
            'total_delivered': total_delivered,
            'total_water_needed': total_water_needed,
            'extra_water_delivered': total_extra_water,
            'total_required': total_required,
            'total_available': total_available,
            'water_shortage': water_shortage,
            'excess_water': excess_water,
            'reservoir_storage': reservoir_storage,
            'distribution_factor': distribution_factor,
            'wastage': wastage,
            'total_wastage': total_wastage,
            'efficiency_percentage': round(efficiency_percentage, 2),
            'disruptions': disruptions,
            'buildings_served': len([b for b in building_allocations.values() if b['requirement_met']]),
            'buildings_shortage': len([b for b in building_allocations.values() if not b['requirement_met']]),
            'proportional_distribution': distribution_factor < 1.0
        }
        
        # Store results in database
        today = date.today()
        cursor.execute('''
            INSERT OR REPLACE INTO daily_distribution 
            (date, river_water_total, ground_water_total, total_delivered, wastage, efficiency_percentage, simulation_status, reservoir_storage, water_shortage)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (today, results['river_water'], results['ground_water'], total_delivered, total_wastage, efficiency_percentage, 'completed', reservoir_storage, water_shortage))
        
        # Store building allocations
        for building_id, allocation in building_allocations.items():
            cursor.execute('''
                INSERT OR REPLACE INTO building_allocation 
                (date, building_id, river_water, ground_water, total_water, is_default, required_water, shortage, excess)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (today, building_id, allocation['river_water'], allocation['ground_water'], allocation['total_water'], 0, allocation['required_water'], allocation['shortage'], allocation['excess']))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'message': 'Simulation completed successfully',
            'results': results,
            'building_allocations': building_allocations
        })
        
    except Exception as e:
        conn.close()
        return jsonify({'message': f'Error running simulation: {str(e)}'}), 500

@app.route('/api/simulation/reset', methods=['POST'])
@token_required
def reset_simulation(current_user):
    # Check if user is admin
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT user_type FROM users WHERE id = ?', (current_user,))
    user = cursor.fetchone()
    
    if user['user_type'] != 'admin':
        conn.close()
        return jsonify({'message': 'Admin access required'}), 403
    
    today = date.today().isoformat()
    
    # Delete today's data
    cursor.execute('DELETE FROM daily_distribution WHERE date = ?', (today,))
    cursor.execute('DELETE FROM building_allocation WHERE date = ?', (today,))
    
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Simulation reset successfully'})

@app.route('/api/ai-suggestions', methods=['POST'])
def get_ai_suggestions():
    try:
        data = request.get_json()
        delivery_data = data.get('delivery_data', {})
        disruptions = data.get('disruptions', {})
        buildings = data.get('buildings', [])
        approved_requests = data.get('approved_requests', [])
        extra_water_requests = data.get('extra_water_requests', [])
        event_water_requests = data.get('event_water_requests', [])
        total_water_needed = data.get('total_water_needed', 0)
        
        # Use the new function with better error handling
        suggestions = generate_simulation_ai_suggestions(delivery_data, buildings, approved_requests, extra_water_requests, event_water_requests, total_water_needed)
        return jsonify({'suggestions': suggestions})
        
    except Exception as e:
        print(f"Error in AI suggestions endpoint: {e}")
        # Fallback to simulated suggestions
        return jsonify({'suggestions': generate_fallback_comprehensive_suggestions(delivery_data, disruptions, buildings, approved_requests, extra_water_requests, event_water_requests, total_water_needed)})

def generate_ai_recommendation(request_data):
    try:
        water_amount = request_data.get('water_amount', 0)
        request_type = request_data.get('request_type', 'general')
        event_type = request_data.get('event_type', '')
        reason = request_data.get('reason', '')

        prompt = f"""
        As a smart city water management AI advisor, analyze this water request and provide a professional recommendation:

        Request Details:
        - Water Amount: {water_amount} units
        - Request Type: {request_type}
        - Event Type: {event_type}
        - Reason: {reason}

        Please provide a structured recommendation including:
        1. **Assessment**: Is this request reasonable and sustainable?
        2. **Impact Analysis**: What would be the impact on the water system?
        3. **Recommendation**: Approve, reject, or modify with conditions
        4. **Alternative Solutions**: Suggest water conservation measures
        5. **Risk Factors**: Any potential issues to consider

        Format your response professionally with clear sections and actionable insights.
        """

        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        print(f"Gemini API Error: {e}")
        # Fallback to simulated recommendation
        return generate_simulated_recommendation(request_data)

def generate_simulated_recommendation(request_data):
    """Generate a simulated AI recommendation when the API is unavailable"""
    water_amount = request_data.get('water_amount', 0)
    request_type = request_data.get('request_type', 'general')
    event_type = request_data.get('event_type', '')
    
    if water_amount > 100:
        recommendation = f"""
        **Assessment**: This is a high-volume request ({water_amount} units) that requires careful consideration.
        
        **Impact Analysis**: This request represents approximately {water_amount/50:.1f}% of a typical building's daily requirement, which could strain the system during peak hours.
        
        **Recommendation**: APPROVE with conditions
        - Implement water conservation measures
        - Schedule delivery during off-peak hours
        - Monitor usage patterns
        
        **Alternative Solutions**: 
        - Consider rainwater harvesting for {event_type} events
        - Implement greywater recycling systems
        - Use water-efficient fixtures and equipment
        
        **Risk Factors**: 
        - Potential system overload during peak demand
        - May affect other users if not properly managed
        - Environmental impact of increased water consumption
        """
    else:
        recommendation = f"""
        **Assessment**: This is a reasonable request ({water_amount} units) that should be manageable.
        
        **Impact Analysis**: Low impact on the overall system, representing approximately {water_amount/50:.1f}% of typical building usage.
        
        **Recommendation**: APPROVE
        - Standard approval process
        - Normal delivery scheduling
        
        **Alternative Solutions**: 
        - Consider water-saving practices for {event_type}
        - Use efficient water management during the event
        
        **Risk Factors**: 
        - Minimal risk to system stability
        - Ensure proper water quality monitoring
        """
    
    return recommendation

def generate_simulation_ai_suggestions(results, buildings=None, approved_requests=None, extra_water_requests=None, event_water_requests=None, total_water_needed=0):
    try:
        # Prepare comprehensive data for AI analysis
        analysis_data = {
            'delivery_results': results,
            'system_metrics': {
                'total_buildings': len(buildings) if buildings else 0,
                'total_water_needed': total_water_needed,
                'approved_requests_count': len(approved_requests) if approved_requests else 0,
                'extra_water_requests_count': len(extra_water_requests) if extra_water_requests else 0,
                'event_requests_count': len(event_water_requests) if event_water_requests else 0
            },
            'building_data': buildings or [],
            'approved_requests': approved_requests or [],
            'extra_water_requests': extra_water_requests or [],
            'event_water_requests': event_water_requests or []
        }
        
        # Create a comprehensive prompt for the AI
        prompt = f"""
        As a Smart City Water Management AI Advisor, analyze this comprehensive water distribution simulation and provide detailed, professional recommendations:

        **SIMULATION RESULTS:**
        - Total Water Delivered: {results.get('total_delivered', 0)} units
        - River Water Used: {results.get('river_water', 0)} units
        - Groundwater Used: {results.get('ground_water', 0)} units
        - System Efficiency: {results.get('efficiency_percentage', 0)}%
        - Total Wastage: {results.get('total_wastage', 0)} units
        - Buildings Served: {results.get('buildings_served', 0)}
        - Buildings with Shortage: {results.get('buildings_shortage', 0)}

        **SYSTEM OVERVIEW:**
        - Total Buildings: {analysis_data['system_metrics']['total_buildings']}
        - Total Water Needed: {analysis_data['system_metrics']['total_water_needed']} units
        - Approved Requests: {analysis_data['system_metrics']['approved_requests_count']}
        - Extra Water Requests: {analysis_data['system_metrics']['extra_water_requests_count']}
        - Event Requests: {analysis_data['system_metrics']['event_requests_count']}

        **WATER DISTRIBUTION ANALYSIS:**
        - River Water Distribution: {results.get('river_water', 0)} units
        - Groundwater Distribution: {results.get('ground_water', 0)} units
        - Extra Water Delivered: {results.get('extra_water_delivered', 0)} units

        **DISRUPTIONS IMPACT:**
        - Pipe Leak Wastage: {results.get('wastage', {}).get('pipeLeak', 0)} units
        - Well Dry Wastage: {results.get('wastage', {}).get('wellDry', 0)} units
        - River Pollution Wastage: {results.get('wastage', {}).get('riverPollution', 0)} units
        - Pump Failure Wastage: {results.get('wastage', {}).get('pumpFailure', 0)} units

        Please provide a comprehensive analysis with the following sections:

        1. **SYSTEM PERFORMANCE ASSESSMENT**
           - Efficiency analysis and performance metrics
           - Comparison with optimal water distribution
           - Identification of bottlenecks and inefficiencies

        2. **WATER SOURCE OPTIMIZATION**
           - River vs groundwater utilization analysis
           - Recommendations for source balancing
           - Infrastructure improvement suggestions

        3. **BUILDING ALLOCATION ANALYSIS**
           - Distribution fairness and equity
           - Priority-based allocation effectiveness
           - Shortage impact assessment

        4. **REQUEST MANAGEMENT INSIGHTS**
           - Approved requests impact analysis
           - Extra water request patterns
           - Event water management effectiveness

        5. **DISRUPTION MITIGATION STRATEGIES**
           - Wastage reduction recommendations
           - Infrastructure resilience improvements
           - Emergency response protocols

        6. **SUSTAINABILITY RECOMMENDATIONS**
           - Water conservation measures
           - System optimization opportunities
           - Long-term planning suggestions

        7. **IMMEDIATE ACTION ITEMS**
           - Priority improvements needed
           - Quick wins for efficiency gains
           - Critical infrastructure updates

        Format your response with clear headings, bullet points, and quantified recommendations where possible. Focus on actionable insights that can improve the water management system.
        """

        # Call Gemini API
        response = genai.generate_content(prompt)
        
        if response and response.text:
            return response.text
        else:
            return generate_fallback_comprehensive_suggestions(results, buildings, approved_requests, extra_water_requests, event_water_requests, total_water_needed)
            
    except Exception as e:
        print(f"Error generating AI suggestions: {e}")
        return generate_fallback_comprehensive_suggestions(results, buildings, approved_requests, extra_water_requests, event_water_requests, total_water_needed)

def generate_fallback_comprehensive_suggestions(results, buildings=None, approved_requests=None, extra_water_requests=None, event_water_requests=None, total_water_needed=0):
    """Generate comprehensive fallback suggestions when AI is unavailable"""
    
    suggestions = []
    
    # System Performance Assessment
    efficiency = results.get('efficiency_percentage', 0)
    suggestions.append("**SYSTEM PERFORMANCE ASSESSMENT**")
    if efficiency >= 90:
        suggestions.append("✅ **Excellent Performance**: System operating at optimal efficiency")
    elif efficiency >= 80:
        suggestions.append("✅ **Good Performance**: System performing well with room for improvement")
    elif efficiency >= 70:
        suggestions.append("⚠️ **Moderate Performance**: System needs optimization")
    else:
        suggestions.append("❌ **Poor Performance**: Immediate intervention required")
    
    suggestions.append(f"• Current Efficiency: {efficiency}%")
    suggestions.append(f"• Target Efficiency: 85%+")
    suggestions.append("")
    
    # Water Source Optimization
    river_water = results.get('river_water', 0)
    ground_water = results.get('ground_water', 0)
    total_delivered = results.get('total_delivered', 0)
    
    suggestions.append("**WATER SOURCE OPTIMIZATION**")
    if total_delivered > 0:
        river_percentage = (river_water / total_delivered) * 100
        ground_percentage = (ground_water / total_delivered) * 100
        
        suggestions.append(f"• River Water Usage: {river_percentage:.1f}% ({river_water} units)")
        suggestions.append(f"• Groundwater Usage: {ground_percentage:.1f}% ({ground_water} units)")
        
        if river_percentage > 70:
            suggestions.append("⚠️ **High River Dependency**: Consider increasing groundwater usage")
        elif ground_percentage > 70:
            suggestions.append("⚠️ **High Groundwater Dependency**: Consider increasing river water usage")
        else:
            suggestions.append("✅ **Balanced Source Usage**: Good distribution between sources")
    suggestions.append("")
    
    # Building Allocation Analysis
    buildings_served = results.get('buildings_served', 0)
    buildings_shortage = results.get('buildings_shortage', 0)
    total_buildings = len(buildings) if buildings else 0
    
    suggestions.append("**BUILDING ALLOCATION ANALYSIS**")
    suggestions.append(f"• Buildings Fully Served: {buildings_served}/{total_buildings}")
    suggestions.append(f"• Buildings with Shortage: {buildings_shortage}/{total_buildings}")
    
    if buildings_shortage > 0:
        suggestions.append("❌ **Water Shortage Detected**: Some buildings not receiving adequate water")
        suggestions.append("• Prioritize high-priority buildings")
        suggestions.append("• Implement water rationing if necessary")
    else:
        suggestions.append("✅ **All Buildings Served**: Excellent distribution coverage")
    suggestions.append("")
    
    # Request Management Insights
    if approved_requests and len(approved_requests) > 0:
        suggestions.append("**REQUEST MANAGEMENT INSIGHTS**")
        suggestions.append(f"• Total Approved Requests: {len(approved_requests)}")
        
        if extra_water_requests and len(extra_water_requests) > 0:
            total_extra = sum(req.get('water_amount', 0) for req in extra_water_requests)
            suggestions.append(f"• Extra Water Requests: {len(extra_water_requests)} ({total_extra} units)")
        
        if event_water_requests and len(event_water_requests) > 0:
            total_event = sum(req.get('water_amount', 0) for req in event_water_requests)
            suggestions.append(f"• Event Water Requests: {len(event_water_requests)} ({total_event} units)")
        
        suggestions.append("• Monitor request patterns for future planning")
        suggestions.append("")
    
    # Disruption Mitigation
    wastage = results.get('wastage', {})
    total_wastage = results.get('total_wastage', 0)
    
    if total_wastage > 0:
        suggestions.append("**DISRUPTION MITIGATION STRATEGIES**")
        suggestions.append(f"• Total Wastage: {total_wastage} units")
        
        if wastage.get('pipeLeak', 0) > 0:
            suggestions.append("• **Pipe Leak Detected**: Implement leak detection system")
        if wastage.get('wellDry', 0) > 0:
            suggestions.append("• **Well Dry Issue**: Diversify water sources")
        if wastage.get('riverPollution', 0) > 0:
            suggestions.append("• **River Pollution**: Implement water treatment")
        if wastage.get('pumpFailure', 0) > 0:
            suggestions.append("• **Pump Failure**: Regular maintenance schedule")
        
        suggestions.append("• Implement predictive maintenance")
        suggestions.append("• Install real-time monitoring systems")
        suggestions.append("")
    
    # Sustainability Recommendations
    suggestions.append("**SUSTAINABILITY RECOMMENDATIONS**")
    suggestions.append("• Implement water conservation programs")
    suggestions.append("• Install smart meters for usage tracking")
    suggestions.append("• Promote rainwater harvesting")
    suggestions.append("• Regular system audits and optimization")
    suggestions.append("")
    
    # Immediate Action Items
    suggestions.append("**IMMEDIATE ACTION ITEMS**")
    if efficiency < 80:
        suggestions.append("🔴 **High Priority**: Optimize water distribution system")
    if buildings_shortage > 0:
        suggestions.append("🔴 **High Priority**: Address water shortages")
    if total_wastage > 0:
        suggestions.append("🟡 **Medium Priority**: Reduce system wastage")
    
    suggestions.append("• Schedule maintenance for critical infrastructure")
    suggestions.append("• Review and update water allocation policies")
    suggestions.append("• Implement emergency response protocols")
    
    return "\n".join(suggestions)

@app.route('/api/guest/water-request', methods=['POST'])
def guest_water_request():
    """Handle water requests from guests (no authentication required)"""
    data = request.get_json()
    
    required_fields = ['water_amount', 'event_type', 'reason']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'message': f'{field} is required'}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Create guest water request
        cursor.execute('''
            INSERT INTO water_requests 
            (requester_id, requester_type, water_amount, request_type, reason, event_type, duration, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            None,  # No user ID for guests
            'guest',
            data['water_amount'],
            'event',
            data['reason'],
            data['event_type'],
            data.get('duration', 1),
            'pending'
        ))
        
        request_id = cursor.lastrowid
        
        # Generate AI recommendation for the request
        ai_recommendation = generate_ai_recommendation({
            'water_amount': data['water_amount'],
            'event_type': data['event_type'],
            'reason': data['reason'],
            'request_type': 'event'
        })
        
        # Update the request with AI recommendation
        cursor.execute('''
            UPDATE water_requests 
            SET ai_recommendation = ? 
            WHERE id = ?
        ''', (ai_recommendation, request_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'message': 'Water request submitted successfully',
            'request_id': request_id,
            'ai_recommendation': ai_recommendation
        })
        
    except Exception as e:
        return jsonify({'message': f'Error creating request: {str(e)}'}), 500

@app.route('/api/guest/water-requests', methods=['GET'])
def get_guest_requests():
    """Get all guest water requests (for admin review)"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM water_requests 
            WHERE requester_type = 'guest' 
            ORDER BY created_at DESC
        ''')
        
        requests = []
        for row in cursor.fetchall():
            requests.append({
                'id': row['id'],
                'water_amount': row['water_amount'],
                'request_type': row['request_type'],
                'reason': row['reason'],
                'event_type': row['event_type'],
                'duration': row['duration'],
                'status': row['status'],
                'ai_recommendation': row['ai_recommendation'],
                'admin_notes': row['admin_notes'],
                'created_at': row['created_at']
            })
        
        conn.close()
        return jsonify(requests)
        
    except Exception as e:
        return jsonify({'message': f'Error fetching requests: {str(e)}'}), 500

@app.route('/api/daily-distribution/<date>', methods=['GET'])
@token_required
def get_daily_distribution(current_user, date):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get today's distribution
        cursor.execute('''
            SELECT * FROM daily_distribution WHERE date = ?
        ''', (date,))
        distribution = cursor.fetchone()
        
        # Get previous day's reservoir data
        cursor.execute('''
            SELECT reservoir_storage, water_shortage FROM daily_distribution 
            WHERE date < ? ORDER BY date DESC LIMIT 1
        ''', (date,))
        previous_day = cursor.fetchone()
        
        conn.close()
        
        if distribution:
            return jsonify({
                'distribution': {
                    'date': distribution['date'],
                    'river_water_total': distribution['river_water_total'],
                    'ground_water_total': distribution['ground_water_total'],
                    'total_delivered': distribution['total_delivered'],
                    'wastage': distribution['wastage'],
                    'efficiency_percentage': distribution['efficiency_percentage'],
                    'simulation_status': distribution['simulation_status'],
                    'reservoir_storage': distribution['reservoir_storage'],
                    'water_shortage': distribution['water_shortage'],
                    'previous_day_reservoir': previous_day['reservoir_storage'] if previous_day else 0,
                    'previous_day_shortage': previous_day['water_shortage'] if previous_day else 0
                }
            })
        else:
            return jsonify({'distribution': {}})
            
    except Exception as e:
        return jsonify({'message': f'Error fetching daily distribution: {str(e)}'}), 500

@app.route('/api/buildings/<int:building_id>/houses', methods=['GET'])
@token_required
def get_houses_for_building(current_user, building_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT house_number, num_people, water_requirement FROM houses WHERE building_id = ?', (building_id,))
    houses = [
        {
            'house_number': row[0],
            'num_people': row[1],
            'water_requirement': row[2]
        }
        for row in cursor.fetchall()
    ]
    conn.close()
    return jsonify({'houses': houses})

if __name__ == '__main__':
    app.run(debug=True, port=5000) 