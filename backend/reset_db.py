import sqlite3
import hashlib
import os

def reset_database():
    # Remove existing database
    if os.path.exists('smart_city_water.db'):
        os.remove('smart_city_water.db')
        print("Removed existing database")
    
    # Create new database
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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (building_id) REFERENCES buildings (id),
            UNIQUE(date, building_id)
        )
    ''')
    
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
            'both',  # All buildings use both sources
            60,  # 60% river water
            40,  # 40% groundwater
            10 + (i % 20),  # 10-30 apartments
            1 + (i % 3)  # 1-3 priority
        ))
    
    conn.commit()
    conn.close()
    print("Database reset successfully with 160 buildings!")

if __name__ == "__main__":
    reset_database() 