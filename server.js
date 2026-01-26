// creating the server that holds the DB

const express = require('express');
const pool = require('./db');
const util = require("util");

const dbQuery = util.promisify(pool.query).bind(pool);
const dbGetConnection = pool.getConnection ? util.promisify(pool.getConnection).bind(pool) : null;

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
    pool.query(
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

                pool.query(
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
    pool.query (
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

// Function to require login to access the new-delivery.html
function requireLogin(req, res, next) {
    if (!req.session || !req.session.user) return res.status(401).send("Not logged in");
    next();
}

// Function to require the role for delivery creation
function requireRole(...roles) {
    return (req, res, next) => {
        const me = req.session.user;
        if (!me || !roles.includes(me.role)) return res.status(403).send("Forbidden");
        next();
    };
}

// Function for day range
function dayRange(dateISO) {
    const start = new Date(dateISO + "T00:00:00");
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
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
    pool.query('SELECT user_id, first_name, last_name, user_email, role, created_at FROM user_table ORDER BY created_at DESC', (err, results) => {
        if (err) {
            return res.status(500).send(err);
        }
        res.json(results);
    });
});

// Creating the API to send and retrieve deliveries
app.get('/API/deliveries', reqAuth, (req, res) => {
    pool.query('SELECT * FROM deliveries_table', (err, results) => {
        if (err) {
            return res.status(500).send(err);
        }
        res.json(results);
    });
});

// Adding the Driver API
app.get('/API/drivers', reqAuth, (req, res) => {
    pool.query(
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

        pool.query(sql, params, (err, results) => {
            if(err) {
            return res.status(500).json({ message: "DB ERROR " });
            }
            res.json(results);
    });
});

// Creating the API to send and retrieve customer information
app.get('/API/customers', reqAuth, (req, res) => {
    pool.query('SELECT * FROM customer_info', (err, results) => {
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

        pool.query(
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
    pool.query(
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

    pool.query("DELETE FROM user_table WHERE user_id=?", [id], (err,result) => {
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

// API for the delivery creation
app.get("/new-delivery.html", requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, "HTML", "new-delivery.html"));
})

// API to get the deliveries for the day
app.get("/API/deliveries/day", requireLogin, async (req, res) => {
    const me = req.session.user;
    const { date } = req.query;
    if (!date) return res.status(400).send("Missing date");

    const { start, end } = dayRange(date);

    try {
        let sql = `
            SELECT d.deliv_id, d.user_id, d.scheduled_time, d.duration_min,
                   d.deliv_status, d.del_address, d.del_city, d.del_zip, d.notes,
                   c.cust_id, c.first_name, c.last_name, c.cust_email, c.cust_phone,
                   c.cust_address, c.cust_city, c.cust_zip
            FROM deliveries_table d
            LEFT JOIN customer_info c ON c.cust_id = d.cust_id
            WHERE d.scheduled_time >= ? AND d.scheduled_time < ?
        `;
        const params = [start, end];

        if (me.role === "driver") {
            sql += " AND d.user_id = ?";
            params.push(me.user_id);
        }

        sql += " ORDER BY d.scheduled_time ASC";

        const rows = await dbQuery(sql, params);
        res.json(rows);
    } catch (e) {
        console.error(e);
        res.status(500).send("Failed to load the deliveries");
    }
});

// Creating the delivery (admin/scheduler only)
app.post("/API/deliveries", requireLogin, requireRole("admin", "scheduler"), async (req, res) => {
    const {
        // customer info
        first_name,
        last_name,
        cust_email,
        cust_phone,
        cust_address,
        cust_city,
        cust_zip,

        // deliveries table
        del_address,
        del_city,
        del_zip,
        scheduled_time,
        user_id,
        notes,
        deliv_status,
        duration_min
    } = req.body;

    // validating customer is required
    if (!first_name || !last_name || !cust_email || !cust_address || !cust_city || !cust_zip) {
        return res.status(400).send("Missing required customer fields");
    }

    // Validating the delivvery is required
    if (!del_address || !del_city || !del_zip || !scheduled_time || !user_id) {
        return res.status(400).send("Missing required delivery fields");
    }

    const duration = Number(duration_min || 60);
    if (!Number.isFinite(duration) || duration <= 0) return res.status(400).send("Invalid duration");

    const status = deliv_status || "pending";

    if (!dbGetConnection) {
        return res.status(500).send("pool.connection() not available, db.js must export MySQL pool");
    }

    let con;
    
    try {
        con = await dbGetConnection();

        // Promisfy connection methods
        const conQuery = util.promisify(con.query).bind(con);
        const begin = util.promisify(con.beginTransaction).bind(con);
        const commit = util.promisify(con.commit).bind(con);
        const rollback = util.promisify(con.rollback).bind(con);

        await begin();

        // Insert the customer
        const custResult = await conQuery(
            `INSERT INTO customer_info
             (last_name, first_name, cust_email, cust_phone, cust_address, cust_city,cust_zip)
             VALUES (?,?,?,?,?,?,?)`,
            [last_name, first_name, cust_email, cust_phone || null, cust_address, cust_city, cust_zip]
        );
        const cust_id = custResult.insertId;

        // Check for overlap with the same driver
        const newStart = new Date(scheduled_time);
        if (Number.isNaN(newStart.getTime())) throw new Error("invalid scheduled time");

        const newEnd = new Date(newStart);
        newEnd.setMinutes(newEnd.getMinutes() + duration);

        const conflicts = await conQuery(
            `
            SELECT deliv_id
            FROM deliveries_table
            WHERE user_id = ?
                AND scheduled_time < ?
                AND DATE_ADD(scheduled_time, INTERVAL duration_min MINUTE) > ?
            LIMIT 1
            `,
            [user_id, newEnd, newStart]
        );

        if(conflicts.length) {
            await rollback();
            return res.status(409).send("Driver already has a delivery in that time range");
        }

        // Insert the delivery
        const delResult = await conQuery(
            `INSERT INTO deliveries_table
             (del_address, del_city, del_zip, scheduled_time, deliv_status, notes, cust_id, user_id, duration_min)
             VALUES (?,?,?,?,?,?,?,?,?)`,
             [del_address, del_city, del_zip, scheduled_time, status, notes || null, cust_id, user_id, duration]
        );

        await commit();
        res.status(201).json({ deliv_id: delResult.insertId, cust_id });
    } catch (e) {
        console.error(e);
        if (con) {
            try {
                await util.promisify(con.rollback).bind(con)();
            } catch {}
        }
        return res.status(500).send(e.message || "Failed to create delivery");
    } finally {
        if (con) con.release();
    }
});

// Adding the delete route for scheduler/admin only
app.delete("/API/deliveries/:id", requireLogin, requireRole("admin", "scheduler"), async (req, res) => {
    const { id } = req.params;

    try {
        const result = await dbQuery("DELETE FROM deliveries_table WHERE deliv_id = ?", [id]);
        if (result.affectedRows === 0) return res.status(404).send("Delivery not found");
        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).send("Failed to delete delivery");
    }
});

// Adding a patch so driver can only complete their delivery
app.patch("/API/deliveries/:id/complete", requireLogin, async (req,res) => {
    const me = req.session.user;
    const { id } = req.params;

    try {
        const rows = await dbQuery("SELECT user_id FROM deliveries_table WHERE deliv_id = ?", [id]);
        if (!rows.length) return res.status(404).send("Delivery not found");

        const owner = rows[0].user_id;
        
        if (me.role === "driver" && String(owner) !== String(me.user_id)) {
            return res.status(403).send("Forbidden");
        }

        if (!["driver", "admin", "scheduler"].includes(me.role)) {
            return res.status(403).send("Forbidden");
        }

        await dbQuery(
            "UPDATE deliveries_table SET deliv_status='completed', completed_at=NOW() WHERE deliv_id=?",
            [id]
        );

        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).send("Failed to complete delivery");
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    seedDefaultAdmin(); // DEV only
});