const http = require('http');
const fs = require('fs');
const mysql = require('mysql2');
const url = require('url');
const message = require('../lang/messages/en/user');
require('dotenv').config();

// Create MySQL connection pool
const db = mysql.createPool({
    connectionLimit: 10,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    ssl: { ca: fs.readFileSync(process.env.CA_CERT_PATH), rejectUnauthorized: true },
});

// Check if "patients" table exists
function checkTableExists(callback) {
    db.query(
        `SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = ? AND table_name = 'patients'`,
        [process.env.DB_NAME],
        (err, results) => callback(err, results?.[0]?.count > 0)
    );
}

// Create "patients" table if missing
function createTable(callback) {
    db.query(
        `CREATE TABLE IF NOT EXISTS patients (patientid INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100), date_of_birth DATE) ENGINE=InnoDB`,
        callback
    );
}

// Handle HTTP requests
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Content-Type", "application/json");

    if (req.method === 'OPTIONS') return res.writeHead(200).end();

    if (req.method === 'POST' && parsedUrl.pathname === '/insert') {
        checkTableExists((err, exists) => {
            if (err) return res.writeHead(500).end(JSON.stringify({ success: false, message: "Database error" }));
            if (!exists) return createTable(err => err ? res.writeHead(500).end(JSON.stringify({ success: false, message: "Table creation failed" })) : handleInsert(req, res));
            handleInsert(req, res);
        });

    } else if (req.method === 'GET' && parsedUrl.pathname === '/query') {
        checkTableExists((err, exists) => {
            if (err) return res.writeHead(500).end(JSON.stringify({ success: false, message: "Database error" }));
            if (!exists) return res.writeHead(404).end(JSON.stringify({ success: false, message: "Patients table does not exist" }));

            const sql = parsedUrl.query.sql;
            if (!sql?.trim().toUpperCase().startsWith('SELECT')) return res.writeHead(403).end(JSON.stringify({ success: false, message: message.SelectOnly }));

            db.query(sql, (err, result) => res.writeHead(200).end(JSON.stringify({ success: !err, data: err ? err.message : result })));
        });

    } else {
        res.writeHead(404).end(JSON.stringify({ success: false, message: message.invalidRequest }));
    }
});

// Handle insert request
function handleInsert(req, res) {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            const sql = "INSERT INTO patients (name, date_of_birth) VALUES ?";
            const values = data.patients.map(p => [p.name, p.date_of_birth]);

            db.query(sql, [values], (err) => res.writeHead(200).end(JSON.stringify({ success: !err, message: err ? err.message : message.insertSuccess })));
        } catch {
            res.writeHead(400).end(JSON.stringify({ success: false, message: "Invalid JSON format" }));
        }
    });
}

// Start server
server.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log("Server running"));
