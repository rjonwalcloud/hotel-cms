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
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'AUTHORIZED',
        details TEXT
    )`);

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
