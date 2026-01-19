// creating the server that holds the DB

const express = require('express');
const db = require('./db');

// Requires for the express sessions
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000; // Needs to be different than 3306 (XAMPP default)

const path = require('path');

// Seeding in the default admin account (DEV ONLY)
async function seedDefaultAdmin() {
    const adminEmail = "admin@test.com";
    const adminPassword = "Admin123";
    const firstName = "admin";
    const lastName = "admin last";

    // Check if admin already exists
    db.query(
        "SELECT user_id FROM user_table WHERE user_email = ? LIMIT 1",
        [adminEmail],
        async (err, results) => {
            if (err) {
                console.log("Seed admin check failed:", err);
                return ;
            }
            if (results.length > 0) {
                console.log("Default admin already exists:", adminEmail);
                return;
            }
            try {
                const hash = await bcrypt.hash(adminPassword, 12);

                db.query(
                    `INSERT INTO user_table (last_name, first_name, password_hash, user_email, role)
                     VALUES (?,?,?,?, 'admin')`,
                     [lastName, firstName, hash, adminEmail],
                     (err2) => {
                        if(err2) {
                            console.log("Seed admin insert failed:", err2);
                            return;
                        }
                        console.log("Default admin created:", adminEmail, "password:", adminPassword);
                     }
                );
            } catch (e) {
                console.log("Seed admin hashtag failed:", e);
            }
        }
    );
}

// Adding the body-parsing middleware
// Needed because login route needs to read username and password from request body
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Allows HTML forms to be submitted

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
            return res.json({ ok: true, redirectTo: '/' });
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
    if (!req.session.user) return res.redirect('/login.html');
    next();
}

// Protecting index.html
app.get(['/', '/index.html'], reqAuth, (req,res) => {
    res.sendFile(path.join(__dirname, 'HTML', 'index.html'));
});

app.get('/weekly.html', reqAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'HTML', 'weekly.html'));
});

app.get('/login.html', (req,res) => {
    res.sendFile(path.join(__dirname, 'HTML', 'login.html'));
});

// Serving the files
app.use(express.static(path.join(__dirname, 'HTML')));
app.use('/Styles', express.static(path.join(__dirname, 'Styles')));
app.use('/JS', express.static(path.join(__dirname, 'JS')));

// Making the require admin function for the users API
function reqAdmin(req, res, next) {
    if (!req.session.user) return res.status(401).json({ message: 'Not logged in' });
    if(req.session.user.role !== 'admin') return res.status(403).json({ message: 'No access: need to be an admin to see' });
    next();
}

// Creating the API to send and retrieve the users
app.get('/API/users', reqAdmin, (req, res) => {
    db.query('SELECT user_id, first_name, last_name, user_email, role, created_at FROM user_table ORDER BY created_at DESC', (err, results) => {
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

// Adding the Driver API
app.get('/API/drivers', reqAuth, (req, res) => {
    db.query(
        `SELECT user_id, first_name, last_name, user_email
         FROM user_table
         WHERE role = 'driver'
         ORDER BY last_name, first_name`,
         (err, results) => {
            if (err) return res.status(500).json({ message: "DB error" });
            res.json(results);
         }
    );
});

// Creating the deliveries endpoint for weekly deliveries
app.get('/API/deliveries/week', reqAuth, (req, res) => {
    const { weekStart } = req.query;

    const userId = req.query.driver ?? req.query.userId ?? "all";

    if(!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
        return res.status(400).json({ message:"Missing weekStart (YYYY-MM-DD)" });
    }

    // weekStart needs to be YYYY-MM-DD (sunday)
    // We select 7 days: [weekStart, weekStart + 7 days]
    const start = `${weekStart} 00:00:00`;
    let sql = `
        SELECT *
        FROM deliveries_table
        WHERE scheduled_time >= ?
            AND scheduled_time < DATE_ADD(?, INTERVAL 7 DAY)
        `;
        const params = [start, start];

        if (userId && userId !== "all") {
            sql += ` AND user_id = ? `;
            params.push(Number(userId));
        }
        sql += ` ORDER BY scheduled_time ASC `;

        db.query(sql, params, (err, results) => {
            if(err) {
            return res.status(500).json({ message: "DB ERROR " });
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

// Adding the route for only the Admins to create the users who have access to this
app.get('/user_creation.html', reqAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'HTML', 'user_creation.html'));
});

// Admin create user API
app.post('/API/admin/users', reqAdmin, async (req, res) => {
    const { first_name, last_name, user_email, password, role } = req.body;

    if(!first_name || !last_name || !user_email || !password) {
        return res.status(400).json({ message: "Missing required fields" });
    }

    // Only allowing the admin to have creation priveleges
    if (role !== "scheduler" && role !== "driver") {
        return res.status(400).json({ message: "Role must be scheduler or driver" });
    }

    try {
        const hash = await bcrypt.hash(password, 12);

        db.query(
            `INSERT INTO user_table (first_name, last_name, user_email, password_hash, role)
            VALUES (?,?,?,?,?)`,
            [first_name.trim(), last_name.trim(), user_email.trim().toLowerCase(), hash, role],
            (err, result) => {
                if(err) {
                    if(err.code === "ER_DUP_ENTRY") {
                        // incase of dup email
                        return res.status(409).json({ message: "Email already exists" });
                    }
                    return res.status(500).json({ message: "DB error", error: err.code });
                }
                return res.json({ ok: true, user_id: result.insertId });
            }
        );
    } catch (e) {
        res.status(500).json({ message: "Hash error" })
    }
});

// Retrieving all accounts for the admin only page for creation and deletion
app.get("/API/admin/users", reqAdmin, (req, res) => {
    db.query(
        `SELECT user_id, first_name, last_name, user_email, role, created_at
         FROM user_table
         ORDER BY created_at DESC`,
        (err, results) => {
            if(err) return res.status(500).json({ message: "DB error" });
            res.json(results);
        }
    );
});

// Deleting the users
app.delete("/API/admin/users/:id", reqAdmin, (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "bad id" });

    // Not allowing self deletion
    if(req.session.user && Number(req.session.user.user_id) === id){
        return res.status(400).json({ message: "Cannot delete your own account" });
    }

    db.query("DELETE FROM user_table WHERE user_id=?", [id], (err,result) => {
        if(err) return res.status(500).json({ message: "DB error"});
        res.json({ ok: true, deleted: result.affectedRows });
    });
});

app.post("/API/logout", (req,res) => {
    // Destroy the session and clear the cookies
    req.session.destroy((err) => {
        res.clearCookie("connect.sid", { path: "/" });
        if (err) return res.status(500).json({ message: "Logout failed" });
        return res.json({ ok: true });
    });
});


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    seedDefaultAdmin(); // DEV only
});