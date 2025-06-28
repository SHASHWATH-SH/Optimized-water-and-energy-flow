#!/usr/bin/env python3
"""
Simple script to view the Smart City Water Management database
Run this script to see all tables and their contents
"""

import sqlite3
import os

def view_database():
    db_path = 'smart_city_water.db'
    
    if not os.path.exists(db_path):
        print("❌ Database file not found!")
        print("Please run the Flask app first to create the database.")
        return
    
    print("🔍 Smart City Water Management Database Viewer")
    print("=" * 50)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    
    print(f"📋 Found {len(tables)} tables:")
    for table in tables:
        print(f"  - {table[0]}")
    
    print("\n" + "=" * 50)
    
    # View each table
    for table in tables:
        table_name = table[0]
        print(f"\n📊 Table: {table_name}")
        print("-" * 30)
        
        # Get table schema
        cursor.execute(f"PRAGMA table_info({table_name});")
        columns = cursor.fetchall()
        
        print("Columns:")
        for col in columns:
            print(f"  - {col[1]} ({col[2]})")
        
        # Get row count
        cursor.execute(f"SELECT COUNT(*) FROM {table_name};")
        count = cursor.fetchone()[0]
        print(f"Total rows: {count}")
        
        if count > 0:
            # Get sample data (limit to 10 rows for large tables)
            limit = min(10, count)
            cursor.execute(f"SELECT * FROM {table_name} LIMIT {limit};")
            rows = cursor.fetchall()
            
            print(f"Sample data (showing {limit} rows):")
            for i, row in enumerate(rows, 1):
                print(f"  Row {i}: {row}")
            
            if count > limit:
                print(f"  ... and {count - limit} more rows")
        
        print()
    
    conn.close()
    print("✅ Database viewing complete!")

if __name__ == "__main__":
    view_database() 