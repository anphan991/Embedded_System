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
    c.execute('''
        CREATE TABLE IF NOT EXISTS radar_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp REAL,
            pos_x REAL,
            pos_y REAL,
            speed REAL
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS zones_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            zone_type TEXT,
            name TEXT,
            x_min REAL,
            x_max REAL,
            y_min REAL,
            y_max REAL
        )
    ''')
    conn.commit()
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS room_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room_width REAL,
            room_length REAL,
            radar_x REAL,
            radar_y REAL,
            radar_angle REAL DEFAULT 0.0
        )
    ''')
    conn.commit()
    
    # Khởi tạo dữ liệu mặc định nếu bảng trống
    c.execute('SELECT COUNT(*) FROM zones_config')
    if c.fetchone()[0] == 0:
        default_zones = [
            ("SAFE", "Bed Zone", 0.0, 3.0, 0.0, 6.0),
            ("DANGER", "Balcony Zone", 4.0, 6.0, 4.0, 6.0)
        ]
        c.executemany('''
            INSERT INTO zones_config (zone_type, name, x_min, x_max, y_min, y_max)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', default_zones)
        conn.commit()
        
    c.execute('SELECT COUNT(*) FROM room_config')
    if c.fetchone()[0] == 0:
        c.execute('''
            INSERT INTO room_config (room_width, room_length, radar_x, radar_y, radar_angle)
            VALUES (6.0, 6.0, 3.0, 0.0, 0.0)
        ''')
        conn.commit()

    conn.close()

def get_room_config():
    """Lấy cấu hình phòng"""
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('SELECT room_width, room_length, radar_x, radar_y, radar_angle FROM room_config ORDER BY id DESC LIMIT 1')
        row = c.fetchone()
        conn.close()
        if row:
            return {"width": row[0], "length": row[1], "radar_x": row[2], "radar_y": row[3], "radar_angle": row[4] if len(row) > 4 and row[4] is not None else 0.0}
        return {"width": 6.0, "length": 6.0, "radar_x": 3.0, "radar_y": 0.0, "radar_angle": 0.0}
    except Exception as e:
        print(f"Database error: {e}")
        return {"width": 6.0, "length": 6.0, "radar_x": 3.0, "radar_y": 0.0, "radar_angle": 0.0}

def update_room_config(width: float, length: float, radar_x: float, radar_y: float, radar_angle: float):
    """Cập nhật cấu hình phòng"""
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('DELETE FROM room_config')
        c.execute('''
            INSERT INTO room_config (room_width, room_length, radar_x, radar_y, radar_angle)
            VALUES (?, ?, ?, ?, ?)
        ''', (width, length, radar_x, radar_y, radar_angle))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Database error: {e}")

def get_all_zones():
    """Lấy danh sách các vùng không gian"""
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('SELECT zone_type, name, x_min, x_max, y_min, y_max FROM zones_config')
        rows = c.fetchall()
        conn.close()
        return [{"type": r[0], "name": r[1], "x_min": r[2], "x_max": r[3], "y_min": r[4], "y_max": r[5]} for r in rows]
    except Exception as e:
        print(f"Database error: {e}")
        return []

def update_zones(zones: list):
    """Xóa các vùng cũ và lưu cấu hình vùng mới"""
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('DELETE FROM zones_config')
        for z in zones:
            c.execute('''
                INSERT INTO zones_config (zone_type, name, x_min, x_max, y_min, y_max)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (z["type"], z["name"], z["x_min"], z["x_max"], z["y_min"], z["y_max"]))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Database error: {e}")

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

def log_radar_data(pos_x: float, pos_y: float, speed: float):
    """Ghi log dữ liệu không gian Radar 2D"""
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('''
            INSERT INTO radar_logs (timestamp, pos_x, pos_y, speed)
            VALUES (?, ?, ?, ?)
        ''', (time.time(), pos_x, pos_y, speed))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Database error: {e}")
