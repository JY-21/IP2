const express = require('express'); //web server
const mysql = require('mysql2'); //connect Node.js to MySQL
const bcrypt = require('bcryptjs'); //hash passowrds
const session = require('express-session'); //manage login sessions
const bodyParser = require('body-parser'); //parse form input
const path = require("path");

const app = express();
const PORT = 3000;

const axios = require("axios"); //install: npm install axios

app.post("/api/predict-priority", async (req, res) => {
  try{
    const { category, urgency, deadline_hours } = req.body;

    const response = await axios.post("http://localhost:5000/predict", {
      category,
      urgency,
      deadline_hours
    });

    res.json(response.data); //{ priority: "High"}
  } catch (error) {
    console.error("ML API error:", error.message);
    res.status(500).json({ error: "Could not get prediction"});
  }
});

//middleware
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(session({
    secret: 'secret_key', 
    resave: false,
    saveUninitialized: true
}));

//serve static html files (login and sign up)
app.use(express.static(path.join(__dirname, "views")));
app.use(express.static(path.join(__dirname, "public")));

app.use(express.json()); //built-in JSON parser
app.use(bodyParser.urlencoded({ extended: false })); // form parse if needed

// ✅ Persistent MySQL pool (won't close between queries)
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'erruns_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// optional: monitor pool errors
db.on('error', (err) => {
  console.error('⚠️ MySQL Pool Error:', err.code);
});


db.getConnection((err, connection) => {
  if (err) {
    console.error('❌ MySQL connection failed:', err);
  } else {
    console.log('✅ MySQL connected!');
    connection.release(); // release back to pool
  }
});


//routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login_page.html"));
});

app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "sign_up_page.html"));
});

//handle sign up
app.post("/signup", (req, res) => {
  const { first_name, last_name, email, username, password } = req.body;

  const hashedPassword = bcrypt.hashSync(password, 10);

  db.query(
    "INSERT INTO users (first_name, last_name, email, username, password) VALUES (?, ?, ?, ?, ?)",
    [first_name, last_name, email, username, hashedPassword],
    (err, result) => {
      if (err) throw err;
      res.redirect("/login"); // redirect user to login page
    }
  );
});

//handle login
app.post("/login", (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Missing username or password" });
  }

  db.query("SELECT * FROM users WHERE username = ?", [username], (err, results) => {
    if (err) {
      console.error("Login DB Error:", err);
      return res.status(500).json({ success: false, message: "Database error" });
    }

    if (results.length === 0) {
      return res.status(401).json({ success: false, message: "User not found!" });
    }

    const user = results[0];
    if (bcrypt.compareSync(password, user.password)) {
      req.session.user = user;
      return res.json({ success: true });
    } else {
      return res.status(401).json({ success: false, message: "Incorrect password!" });
    }
  });
});

app.get('/home', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login'); //prevent direct access
  }

  res.sendFile(path.join(__dirname, "views", "home.html"));
});

//get tasks from database
app.get('/tasks', (req, res)=>{
  if(!req.session.user){
    return res.status(401).json({error: "Unauthorized"});
  }

  const sql = `
    SELECT task_id AS id, title, category, remarks, origin, location, deadline, priority, complete
    FROM tasks
    WHERE user_id = ?
  `;
  db.query(sql, [req.session.user.user_id], (err, results) => {
    if(err){
      console.error("DB Fetch Error:", err);
      return res.status(500).json({ error: "Database error"});
    }
    res.json(results);
  });
});

// ADD TASK ROUTE (with ML)
app.post('/add-task', async (req, res) => {
  if (!req.session.user) return res.status(401).send("Unauthorized");

  try {
    const { title, category, remarks, origin, deadline } = req.body;
    let locations = req.body["taskLocations[]"];
    if (Array.isArray(locations)) locations = locations.join(", ");

    // calculate hours until deadline
    const deadlineDate = new Date(deadline + 'T23:59:59');// end of the selected day
    const hoursUntilDeadline = Math.max(1, Math.floor((deadlineDate - new Date()) / 36e5));

    let predictedPriority = "Medium"; // default fallback

    try {
      // send request to ML
      const mlResponse = await axios.post("http://127.0.0.1:5000/predict", {
        category: category || "General",
        urgency: req.body.priority || "Medium",   // default if missing
        deadline_hours: hoursUntilDeadline
      });
      predictedPriority = mlResponse.data.priority || "Medium";
      console.log("✅ ML Response:", mlResponse.data);
    } catch (mlErr) {
      console.warn("⚠️ ML Server not reachable, using fallback priority:", mlErr.message);
    }

    // insert into DB
    db.query(
      `INSERT INTO tasks 
       (user_id, title, category, remarks, origin, location, deadline, priority, complete) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.session.user.user_id,
        title,
        category,
        remarks,
        origin,
        locations || "",
        deadline,
        predictedPriority,
        0
      ],
      (err, result) => {
        if (err) {
          console.error("DB Insert Error:", err);
          return res.status(500).json({ error: "Error saving task" });
        }
        console.log("✅ Task saved:", result.insertId);
        res.json({ success: true, taskId: result.insertId, priority: predictedPriority });
      }
    );

  } catch (err) {
    console.error("ML/DB Error:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// EDIT TASK ROUTE (with ML priority recalculation)
app.put('/tasks/:id', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });

    try {
        const { title, category, remarks, origin, deadline, priority, complete } = req.body;
        let locations = req.body["taskLocations[]"];

        // Handle multiple locations
        if (Array.isArray(locations)) {
            locations = locations.join(", ");
        }

        // Calculate hours until new deadline for ML prediction
        const deadlineDate = new Date(deadline + 'T23:59:59');
        const hoursUntilDeadline = Math.max(1, Math.floor((deadlineDate - new Date()) / 36e5));

        let predictedPriority = priority || "Medium"; // Use existing priority as fallback

        // Recalculate priority using ML if deadline changed
        try {
            const mlResponse = await axios.post("http://127.0.0.1:5000/predict", {
                category: category || "General",
                urgency: priority || "Medium",
                deadline_hours: hoursUntilDeadline
            });
            predictedPriority = mlResponse.data.priority || "Medium";
            console.log("✅ ML Recalculated Priority:", predictedPriority);
        } catch (mlErr) {
            console.warn("⚠️ ML Server not reachable, using existing priority:", mlErr.message);
        }

        // Update task with potentially new priority
        db.query(
            `UPDATE tasks 
             SET title=?, category=?, remarks=?, origin=?, location=?, deadline=?, priority=?, complete=? 
             WHERE task_id=? AND user_id=?`,
            [
                title,
                category,
                remarks,
                origin,
                locations || "",
                deadline,
                predictedPriority, // Use the recalculated priority
                complete || 0,
                req.params.id,
                req.session.user.user_id 
            ],
            (err, result) => {
                if (err) {
                    console.error("DB Update Error:", err);
                    return res.status(500).json({ error: "Database error" });
                }
                res.json({ success: true, newPriority: predictedPriority });
            }
        );

    } catch (err) {
        console.error("Edit Task Error:", err);
        res.status(500).json({ error: "Something went wrong" });
    }
});

// delete task
app.delete('/tasks/:id', (req, res) => {
    db.query(
        "DELETE FROM tasks WHERE task_id=? AND user_id=?",
        [req.params.id, req.session.user.user_id], // ✅ FIX HERE
        (err) => {
            if (err) {
                console.error("DB Delete Error:", err);
                return res.status(500).json({ error: "Database error" });
            }
            res.json({ success: true });
        }
    );
}); 

//logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.send('Logged out!');
});

//start server
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});