// Creating the server connection from MySQL in XAMPP to node

const mysql = require('mysql2');

// Details for the connection
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'scheduling_app',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

// Attempting a DB connection
pool.getConnection((err, conn) => {
    if(err) {
        console.log("Error: could not connect to the DB", err);
        return;
    }
    console.log("Connection to the DB was successful!");
    conn.release();
})

// Exporting the module
module.exports = pool;