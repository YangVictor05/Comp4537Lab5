require('dotenv').config();  // Load environment variables from the .env file
const mysql = require('mysql2');
const fs = require('fs');

// Read the CA certificate from the specified path
const caCertificate = fs.readFileSync(process.env.CA_CERT_PATH);

// Create a MySQL connection using environment variables
const connection = mysql.createConnection({
  host: process.env.DB_HOST,          // Database host
  user: process.env.DB_USER,          // Database user
  password: process.env.DB_PASSWORD,  // Database password
  database: process.env.DB_NAME,      // Database name
  port: process.env.DB_PORT,          // Database port
  ssl: {
    ca: caCertificate                 // CA certificate for secure connection
  }
});

// Test the connection
connection.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err.stack);
    return;
  }
  console.log('Connected to the database!');
  
  // Close the connection
  connection.end();
});
