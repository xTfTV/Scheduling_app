// creating the server that holds the DB

const express = require('express');
const db = require('./db');

// Requires for the express sessions
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000; // Needs to be different than 3306 (XAMPP default)

const path = require('path');

// Adding the body-parsing middleware
// Needed because login route needs to read username and password from request body
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Allows HTML forms to be submitted

// Serving the files
app.use(express.static(path.join(__dirname, 'HTML')));
app.use('/Styles', express.static(path.join(__dirname, 'Styles')));
app.use('/JS', express.static(path.join(__dirname, 'JS')));

// Adding the session middleware
// Stores user in req.session.user after successful login and browser will keep a cookie to prove login
app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 // 1 hour
    }
}));

// Adding the login endpoints
app.post('/API/login', (req, res) => {
    const {email, password} = req.body;

    // Find the user by the email
    db.query (
        'SELECT user_id, user_email, role, password_hash FROM user_table WHERE user_email = ? LIMIT 1',
        [email],
        async (err, results) => {
            if (err) return res.status(500).json({ message: 'DB Error' });
            if (results.length === 0) return res.status(401).json({ message: 'Invalid login' });

            const user = results[0];

            // Compare password to stored hash
            const ok = await bcrypt.compare(password, user.password_hash);
            if (!ok) return res.status(401).json({ message: 'Invalid login' });

            // Store minimal safe info in session
            req.session.user = {
                user_id: user.user_id,
                user_email: user.user_email,
                role: user.role,
            };
            return res.json({ ok: true });
        }
    );
});

// Creating the API to check if logged in
app.get('/API/is_logged_in', (req,res) => {
    if (!req.session.user) return res.status(401).json({ message: 'Not logged in' });
    res.json(req.session.user);
});

// Adding middleware to protect routes
function reqAuth(req, res, next) {
    if (!req.session.user) return res.status(401).json({ message: 'Not Logged in' });
    next();
}

// Making the require admin function for the users API
function reqAdmin(req, res, next) {
    if (!req.session.user) return res.status(401).json({ message: 'Not logged in' });
    if(req.session.user.role === 'admin') return res.status(403).json({ message: 'No access: need to be an admin to see' });
    next();
}

// Creating the API to send and retrieve the users
app.get('/API/users', reqAdmin, (req, res) => {
    db.query('SELECT * FROM user_table', (err, results) => {
        if (err) {
            return res.status(500).send(err);
        }
        res.json(results);
    });
});

// Creating the API to send and retrieve deliveries
app.get('/API/deliveries', reqAuth, (req, res) => {
    db.query('SELECT * FROM deliveries_table', (err, results) => {
        if (err) {
            return res.status(500).send(err);
        }
        res.json(results);
    });
});

// Creating the API to send and retrieve customer information
app.get('/API/customers', reqAuth, (req, res) => {
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