// server.js (Origin 2)
const http = require('http');
const fs = require('fs');
const mysql = require('mysql2');
const url = require('url');
const message = require('../lang/messages/en/user');
require('dotenv').config();
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, 
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    ssl: {
        ca: fs.readFileSync(process.env.CA_CERT_PATH), 
        rejectUnauthorized: true  
    }
});
db.connect(err => {
    if (err) throw err;
    console.log('Connected to MySQL');
    db.query("CREATE DATABASE IF NOT EXISTS patients_db", err => {
        if (err) throw err;
        db.query(`CREATE TABLE IF NOT EXISTS patients (
            patientid INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100),
            date_of_birth DATE  
        ) ENGINE=InnoDB;`, err => {
            if (err) throw err;
        });
    });
});

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);

    if (req.method === 'POST' && parsedUrl.pathname === '/insert') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const data = JSON.parse(body);
            const sql = "INSERT INTO patients (name, date_of_birth) VALUES ?";
            const values = data.patients.map(p => [p.name, p.date_of_birth]);
            db.query(sql, [values], (err, result) => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: !err, message: err ? err.message : message.insertSuccess }));
            });
        });
    } else if (req.method === 'GET' && parsedUrl.pathname === '/query') {
        const sql = parsedUrl.query.sql;
        if (!sql.trim().toUpperCase().startsWith('SELECT')) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, message: message.SelectOnly }));
        }
        db.query(sql, (err, result) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: !err, data: err ? err.message : result }));
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

const PORT = process.env.DB_PORT;
const HOST = '0.0.0.0'; // Allows external access

server.listen(PORT, HOST, () => console.log(`Server running on port ${PORT}`));

