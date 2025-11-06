const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require("path");

const app = express();
const PORT = 3000;

const axios = require("axios");

const OPENROUTE_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjllMzhmNmVjZDgwODQwM2U5YWM0NmNkNGNkZjgwOWJiIiwiaCI6Im11cm11cjY0In0=';

// Get directions between two points - SIMPLIFIED (will need addresses)
app.post('/api/directions', async (req, res) => {
  try {
    const { origin, destination, profile = 'driving-car' } = req.body;
    
    if (!origin || !destination) {
      return res.status(400).json({ error: "Origin and destination required" });
    }

    // Note: Without coordinates, we'll need to geocode first
    // For now, return a simple response
    res.json({
      success: true,
      message: "Directions service - coordinates needed for routing",
      origin: origin,
      destination: destination
    });

  } catch (error) {
    console.error('Directions error:', error);
    res.status(500).json({ error: 'Failed to get directions' });
  }
});

//get user's current location (simplified)
app.get('/api/user-location', async (req, res) => {
  if(!req.session.user){
    return res.status(401).json({ error: "Unauthorized" });
  }

  try{
    // Return default location
    res.json({
      success: true,
      location: {
        lat: 51.505,
        lon: -0.09
      }
    });
  } catch (error){
    console.error("User location error:", error);
    res.status(500).json({ error: "Failed to get user location" });
  }
});

//optimized route (simplified)
app.get('/api/optimized-route', async (req, res) => {
  if(!req.session.user){
    return res.status(401).json({ error: "Unauthorized" });
  }

  try{
    //get all tasks
    const sql = `
      SELECT task_id, title, origin, location, priority
      FROM tasks
      WHERE user_id = ?`;

    db.query(sql, [req.session.user.user_id], async (err, results) => {
      if(err){
        console.error("DB Fetch Error:", err);
        return res.status(500).json( { error: "Database error"} );
      }

      if(results.length == 0){
        return res.json( { success: true, message: "No tasks found"});
      }

      const locations = results.map(task => ({
        id: task.task_id,
        title: task.title,
        address: task.location,
        priority: task.priority
      }));

      res.json({
        success: true,
        tasks: locations,
        message: "Tasks loaded (address-based)"
      });
    });
  } catch (error){
    console.error("Route optimization error:", error);
    res.status(500).json( {error: "Route optimization failed" });
  }
});

// Remove geocodeWithORS function entirely

app.post("/api/predict-priority", async (req, res) => {
  try{
    const { category, urgency, deadline_hours } = req.body;

    const response = await axios.post("http://localhost:5000/predict", {
      category,
      urgency,
      deadline_hours
    });

    res.json(response.data);
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

//serve static html files
app.use(express.static(path.join(__dirname, "views")));
app.use(express.static(path.join(__dirname, "public")));

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

// MySQL pool
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'erruns_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

db.on('error', (err) => {
  console.error('⚠️ MySQL Pool Error:', err.code);
});

db.getConnection((err, connection) => {
  if (err) {
    console.error('❌ MySQL connection failed:', err);
  } else {
    console.log('✅ MySQL connected!');
    connection.release();
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
      res.redirect("/login");
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
    return res.redirect('/login');
  }

  res.sendFile(path.join(__dirname, "views", "home.html"));
});

// GET TASKS - SIMPLIFIED (no coordinates)
app.get('/tasks', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const sql = `
    SELECT 
      task_id AS id, 
      title, 
      category, 
      remarks, 
      origin, 
      location AS destination,
      deadline, 
      priority, 
      complete
    FROM tasks
    WHERE user_id = ?
  `;
  
  db.query(sql, [req.session.user.user_id], (err, results) => {
    if (err) {
      console.error("DB Fetch Error:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// ADD TASK ROUTE - SIMPLIFIED (no coordinates)
app.post('/add-task', async (req, res) => {
  if (!req.session.user) return res.status(401).send("Unauthorized");

  try {
    const { title, category, remarks, origin, destination, deadline } = req.body;

    // Calculate hours until deadline
    const now = new Date();
    const deadlineDate = new Date(`${deadline}T23:59:59`);
    const diffMs = deadlineDate.getTime() - now.getTime();
    const hoursUntilDeadline = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));

    let predictedPriority = "Medium";

    try {
      const mlResponse = await axios.post("http://127.0.0.1:5000/predict", {
        category: category || "General",
        urgency: "Medium",
        deadline_hours: hoursUntilDeadline
      });
      predictedPriority = mlResponse.data.priority || "Medium";
    } catch (mlErr) {
      console.warn("⚠️ ML Server not reachable, using fallback priority");
    }

    // Insert into DB without coordinates
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
        destination || "",
        deadline,
        predictedPriority,
        0
      ],
      (err, result) => {
        if (err) {
          console.error("DB Insert Error:", err);
          return res.status(500).json({ error: "Error saving task" });
        }
        res.json({ 
          success: true, 
          id: result.insertId, 
          priority: predictedPriority
        });
      }
    );

  } catch (err) {
    console.error("Add Task Error:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// REMOVE the coordinates update route entirely

// UPDATE TASK ROUTE - SIMPLIFIED (no coordinates)
app.put('/tasks/:id', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { title, category, remarks, origin, destination, deadline } = req.body;

    // Calculate hours until deadline
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const timeDiff = deadlineDate.getTime() - now.getTime();
    const hoursUntilDeadline = Math.max(1, Math.ceil(timeDiff / (1000 * 3600)));

    let predictedPriority = "Medium";

    try {
      const mlResponse = await axios.post("http://127.0.0.1:5000/predict", {
        category: category || "General",
        urgency: "Medium",
        deadline_hours: hoursUntilDeadline
      });
      predictedPriority = mlResponse.data.priority || "Medium";
    } catch (mlErr) {
      console.warn("⚠️ ML Server not reachable, using existing priority");
    }

    // Update without coordinates
    db.query(
      `UPDATE tasks 
       SET title=?, category=?, remarks=?, origin=?, location=?, deadline=?, priority=?
       WHERE task_id=? AND user_id=?`,
      [
        title,
        category,
        remarks,
        origin,
        destination || "",
        deadline,
        predictedPriority,
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
    [req.params.id, req.session.user.user_id],
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