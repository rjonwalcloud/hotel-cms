require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'central-secret-key-999';

app.use(cors());
app.use(express.json());

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ message: 'Missing token' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid token' });
        req.user = user;
        next();
    });
};

// Admin Login
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM admins WHERE username = ?", [username], async (err, admin) => {
        if (err || !admin) return res.status(401).json({ message: 'Invalid credentials' });

        const validPassword = await bcrypt.compare(password, admin.password);
        if (!validPassword) return res.status(401).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, username: admin.username });
    });
});

// Reporting Endpoint (Stealthy receiver)
app.post('/api/report', (req, res) => {
    try {
        const { data } = req.body;
        if (!data) return res.status(400).json({ message: 'Invalid data' });

        // Decode from Base64
        const decoded = JSON.parse(Buffer.from(data, 'base64').toString());
        const { ip, publicUrl, hotelName, hotelId, address, city, state, country, phone, email, gst_number, details } = decoded;

        if (!ip || !hotelId) return res.status(400).json({ message: 'Missing required fields' });

        db.get("SELECT id FROM deployments WHERE hotel_id = ? AND ip = ?", [hotelId, ip], (err, row) => {
            if (row) {
                // Update existing
                db.run(
                    "UPDATE deployments SET last_seen = CURRENT_TIMESTAMP, public_url = ?, hotel_name = ?, address = ?, city = ?, state = ?, country = ?, phone = ?, email = ?, gst_number = ?, details = ? WHERE id = ?",
                    [publicUrl, hotelName, address, city, state, country, phone, email, gst_number, JSON.stringify(details), row.id]
                );
            } else {
                // Insert new
                db.run(
                    "INSERT INTO deployments (ip, public_url, hotel_name, hotel_id, address, city, state, country, phone, email, gst_number, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [ip, publicUrl, hotelName, hotelId, address, city, state, country, phone, email, gst_number, JSON.stringify(details)]
                );
            }
        });

        res.json({ status: 'ok' });
    } catch (error) {
        console.error('Report error:', error);
        res.status(500).json({ message: 'Processing error' });
    }
});

// Get Deployments (Protected)
app.get('/api/deployments', authenticateToken, (req, res) => {
    db.all("SELECT * FROM deployments ORDER BY last_seen DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.json(rows);
    });
});

// Update Deployment Status (Mark authorized/unauthorized)
app.patch('/api/deployments/:id/status', authenticateToken, (req, res) => {
    const { status } = req.body;
    const { id } = req.params;
    db.run("UPDATE deployments SET status = ? WHERE id = ?", [status, id], function (err) {
        if (err) return res.status(500).json({ message: 'Update failed' });
        res.json({ message: 'Status updated' });
    });
});

app.listen(PORT, () => {
    console.log(`Central tracking server running on port ${PORT}`);
});
