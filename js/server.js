// server.js (Ensures "patients" table exists before any query)
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
    ssl: {
        ca: fs.readFileSync(process.env.CA_CERT_PATH),
        rejectUnauthorized: true
    },
});

// Function to ensure the "patients" table exists
function ensurePatientsTable(callback) {
    db.getConnection((err, connection) => {
        if (err) {
            console.error('Database connection error:', err);
            return callback(err);
        }
        console.log('Connected to MySQL');

        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS patients (
                patientid INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100),
                date_of_birth DATE  
            ) ENGINE=InnoDB;
        `;

        connection.query(createTableSQL, (err) => {
            connection.release(); // Release connection back to pool
            if (err) {
                console.error('Error creating patients table:', err);
                return callback(err);
            }
            console.log('Patients table ensured');
            callback(null);
        });
    });
}

// Create HTTP server
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Content-Type", "application/json");

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Ensure "patients" table exists before handling requests
    ensurePatientsTable((err) => {
        if (err) {
            res.writeHead(500);
            return res.end(JSON.stringify({ success: false, message: "Database setup failed" }));
        }

        if (req.method === 'POST' && parsedUrl.pathname === '/insert') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const sql = "INSERT INTO patients (name, date_of_birth) VALUES ?";
                    const values = data.patients.map(p => [p.name, p.date_of_birth]);

                    db.query(sql, [values], (err, result) => {
                        res.writeHead(200);
                        res.end(JSON.stringify({ success: !err, message: err ? err.message : message.insertSuccess }));
                    });
                } catch (error) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ success: false, message: "Invalid JSON format" }));
                }
            });

        } else if (req.method === 'GET' && parsedUrl.pathname === '/query') {
            const sql = parsedUrl.query.sql;
            if (!sql || !sql.trim().toUpperCase().startsWith('SELECT')) {
                res.writeHead(403);
                return res.end(JSON.stringify({ success: false, message: message.SelectOnly }));
            }

            db.query(sql, (err, result) => {
                res.writeHead(200);
                res.end(JSON.stringify({ success: !err, data: err ? err.message : result }));
            });

        } else {
            res.writeHead(404);
            res.end(JSON.stringify({ success: false, message: message.invalidRequest }));
        }
    });
});

// Start server
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
server.listen(PORT, HOST, () => console.log(`Server running on port ${PORT}`));
