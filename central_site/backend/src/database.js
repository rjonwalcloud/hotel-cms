const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../data/central.db');
const dataDir = path.dirname(dbPath);

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Deployments table
    db.run(`CREATE TABLE IF NOT EXISTS deployments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip TEXT,
        public_url TEXT,
        hotel_name TEXT,
        hotel_id TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        country TEXT,
        phone TEXT,
        email TEXT,
        gst_number TEXT,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'AUTHORIZED',
        details TEXT
    )`);

    // Migration for new columns (SQLite doesn't add columns to existing tables automatically)
    const columnsToAdd = [
        'address', 'city', 'state', 'country', 'phone', 'email', 'gst_number'
    ];

    columnsToAdd.forEach(col => {
        db.get(`PRAGMA table_info(deployments)`, (err, rows) => {
            // Check if column already exists in table_info (actually we need to check all rows)
        });
        // Simpler way: try to add and ignore error if it exists
        db.run(`ALTER TABLE deployments ADD COLUMN ${col} TEXT`, (err) => {
            // Silently fail if column already exists or other error
        });
    });

    // Admins table
    db.run(`CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
    )`);

    // Insert default admin if not exists (Zoohn321)
    const bcrypt = require('bcrypt');
    const saltRounds = 10;
    const pass = 'Zoohn321';

    db.get("SELECT id FROM admins WHERE username = 'admin'", (err, row) => {
        if (!row) {
            bcrypt.hash(pass, saltRounds, (err, hash) => {
                db.run("INSERT INTO admins (username, password) VALUES (?, ?)", ['admin', hash]);
            });
        }
    });
});

module.exports = db;
