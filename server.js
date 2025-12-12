// creating the server that holds the DB

const express = require('express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000; // Needs to be different than 3306 (XAMPP default)

// Testing a route for the DB connection
app.get('/users', (req, res) => {
    db.query('SELECT * FROM users', (err, results) => {
        if (err) {
            return res.status(500).send(err);
        }
        res.json(results);
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});