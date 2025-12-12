// creating the server that holds the DB

const express = require('express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000; // Needs to be different than 3306 (XAMPP default)

const path = require('path');

// Serving the files
app.use(express.static(path.join(__dirname, 'HTML')));
app.use('/Styles', express.static(path.join(__dirname, 'Styles')));
app.use('/JS', express.static(path.join(__dirname, 'JS')));



// Creating the API to send and retrieve the users
app.get('/API/users', (req, res) => {
    db.query('SELECT * FROM user_table', (err, results) => {
        if (err) {
            return res.status(500).send(err);
        }
        res.json(results);
    });
});

// Creating the API to send and retrieve deliveries
app.get('/API/deliveries', (req, res) => {
    db.query('SELECT * FROM deliveries_table', (err, results) => {
        if (err) {
            return res.status(500).send(err);
        }
        res.json(results);
    });
});

// Creating the API to send and retrieve customer information
app.get('/API/customers', (req, res) => {
    db.query('SELECT * FROM customer_info', (err, results) => {
        if (err) {
            return res.status(500).send(err);
        }
        res.json(results);
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});