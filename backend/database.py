import sqlite3
import time
import os

DB_PATH = "local_alerts.db"

def init_db():
    """Khởi tạo CSDL SQLite nếu chưa có"""
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp REAL,
            event_code TEXT,
            message TEXT,
            image_path TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS vital_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp REAL,
            bpm INTEGER,
            breath INTEGER
        )
    ''')
    conn.commit()
    conn.close()

def log_alert(event_code: str, message: str, image_path: str):
    """Ghi log cảnh báo vào CSDL"""
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('''
            INSERT INTO alerts (timestamp, event_code, message, image_path)
            VALUES (?, ?, ?, ?)
        ''', (time.time(), event_code, message, image_path))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Database error: {e}")

def log_vitals(bpm: int, breath: int):
    """Ghi log sinh hiệu vào CSDL"""
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('''
            INSERT INTO vital_logs (timestamp, bpm, breath)
            VALUES (?, ?, ?)
        ''', (time.time(), bpm, breath))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Database error: {e}")
