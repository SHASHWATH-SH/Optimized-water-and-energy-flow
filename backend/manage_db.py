#!/usr/bin/env python3
"""
Database Management Script for Smart City Water Management
Provides options to view, reset, and manage the database
"""

import sqlite3
import os
import sys
from datetime import datetime

def print_menu():
    print("\n🔧 Smart City Water Management - Database Manager")
    print("=" * 50)
    print("1. View all tables and data")
    print("2. View users only")
    print("3. View buildings only")
    print("4. View water requests only")
    print("5. Reset database (delete and recreate)")
    print("6. Add test water request")
    print("7. Exit")
    print("=" * 50)

def view_table(table_name, limit=10):
    """View a specific table with formatted output"""
    db_path = 'smart_city_water.db'
    
    if not os.path.exists(db_path):
        print("❌ Database file not found!")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Get table schema
        cursor.execute(f"PRAGMA table_info({table_name});")
        columns = cursor.fetchall()
        
        # Get row count
        cursor.execute(f"SELECT COUNT(*) FROM {table_name};")
        count = cursor.fetchone()[0]
        
        print(f"\n📊 Table: {table_name}")
        print(f"Total rows: {count}")
        print("-" * 50)
        
        if count == 0:
            print("No data found.")
            return
        
        # Get column names
        column_names = [col[1] for col in columns]
        print("Columns:", ", ".join(column_names))
        print("-" * 50)
        
        # Get data
        cursor.execute(f"SELECT * FROM {table_name} LIMIT {limit};")
        rows = cursor.fetchall()
        
        for i, row in enumerate(rows, 1):
            print(f"Row {i}:")
            for j, value in enumerate(row):
                print(f"  {column_names[j]}: {value}")
            print()
        
        if count > limit:
            print(f"... and {count - limit} more rows")
            
    except sqlite3.Error as e:
        print(f"❌ Error viewing table {table_name}: {e}")
    finally:
        conn.close()

def reset_database():
    """Reset the database by deleting and recreating it"""
    db_path = 'smart_city_water.db'
    
    if os.path.exists(db_path):
        backup_path = f"smart_city_water_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
        os.rename(db_path, backup_path)
        print(f"✅ Database backed up to: {backup_path}")
    
    print("🔄 Recreating database...")
    
    # Import and run the init_db function
    try:
        from app import init_db
        init_db()
        print("✅ Database reset successfully!")
        print("📋 Created tables:")
        print("  - users (admin + 50 building users)")
        print("  - buildings (50 buildings)")
        print("  - water_requests")
        print("  - daily_distribution")
        print("  - building_allocation")
        print("\n🔑 Login Credentials:")
        print("  Admin: admin / admin123")
        print("  Buildings: building1-50 / 12345")
        
    except Exception as e:
        print(f"❌ Error resetting database: {e}")

def add_test_request():
    """Add a test water request"""
    db_path = 'smart_city_water.db'
    
    if not os.path.exists(db_path):
        print("❌ Database file not found!")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Get first building user and building
        cursor.execute("SELECT id FROM users WHERE user_type = 'building' LIMIT 1;")
        user_result = cursor.fetchone()
        
        cursor.execute("SELECT id FROM buildings LIMIT 1;")
        building_result = cursor.fetchone()
        
        if not user_result or not building_result:
            print("❌ No building users or buildings found!")
            return
        
        user_id = user_result[0]
        building_id = building_result[0]
        
        # Insert test request
        cursor.execute('''
            INSERT INTO water_requests 
            (requester_id, requester_type, building_id, water_amount, request_type, reason, event_type, duration)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            user_id,
            'building',
            building_id,
            25,
            'event',
            'Test request for additional water',
            'party',
            1
        ))
        
        conn.commit()
        print("✅ Test water request added successfully!")
        
    except sqlite3.Error as e:
        print(f"❌ Error adding test request: {e}")
    finally:
        conn.close()

def main():
    while True:
        print_menu()
        choice = input("Enter your choice (1-7): ").strip()
        
        if choice == '1':
            # View all tables
            tables = ['users', 'buildings', 'water_requests', 'daily_distribution', 'building_allocation']
            for table in tables:
                view_table(table, 5)  # Show only 5 rows per table
                
        elif choice == '2':
            view_table('users', 20)
            
        elif choice == '3':
            view_table('buildings', 20)
            
        elif choice == '4':
            view_table('water_requests', 10)
            
        elif choice == '5':
            confirm = input("⚠️  This will delete all data and recreate the database. Continue? (y/N): ")
            if confirm.lower() == 'y':
                reset_database()
            else:
                print("❌ Database reset cancelled.")
                
        elif choice == '6':
            add_test_request()
            
        elif choice == '7':
            print("👋 Goodbye!")
            break
            
        else:
            print("❌ Invalid choice. Please enter 1-7.")

if __name__ == "__main__":
    main() 