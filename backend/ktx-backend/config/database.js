const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT, 10),
    options: {
        encrypt: true, // Use this if you're on Windows Azure
        trustServerCertificate: true // Change to true for local dev / self-signed certs
    }
};

const connectToDatabase = async () => {
    try {
        await sql.connect(config);
        console.log('Database connected successfully');
    } catch (err) {
        console.error('Database connection failed:', err);
        throw err;
    }
};

module.exports = {
    connectToDatabase,
    sql
};