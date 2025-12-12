// Creating the server connection from MySQL in XAMPP to node

const mysql = require('mysql');

// Details for the connection
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    port: 3306 
});

// Attempting a DB connection
connection.connect((err) => {
    if(err) {
        console.log("Error: could not connect to the DB", err);
        return;
    }
    console.log("Connection to the DB was successful!");
})