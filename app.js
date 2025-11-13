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

// Middleware
app.use(session({
    secret: 'secret_key', 
    resave: false,
    saveUninitialized: true
}));

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

// Serve static files
app.use(express.static(path.join(__dirname, "views")));
app.use(express.static(path.join(__dirname, "public")));

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Session debugging middleware
app.use((req, res, next) => {
    console.log('   Session Debug:');
    console.log('   Session ID:', req.sessionID);
    console.log('   User in session:', req.session.user);
    console.log('   Session keys:', Object.keys(req.session));
    next();
});

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
    console.error('MySQL connection failed:', err);
  } else {
    console.log('MySQL connected!');
    connection.release();
  }
});

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login_page.html"));
});

app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "sign_up_page.html"));
});

// Handle sign up
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

// Handle login
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

// Get directions between two points
app.post('/api/directions', async (req, res) => {
  try {
    const { origin, destination, profile = 'driving-car' } = req.body;
    
    if (!origin || !destination) {
      return res.status(400).json({ error: "Origin and destination required" });
    }

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

// Get user's current location
app.get('/api/user-location', async (req, res) => {
  if(!req.session.user){
    return res.status(401).json({ error: "Unauthorized" });
  }

  try{
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

// Optimized route
app.get('/api/optimized-route', async (req, res) => {
  if(!req.session.user){
    return res.status(401).json({ error: "Unauthorized" });
  }

  try{
    const sql = `
      SELECT task_id, title, origin, location, priority, urgency
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
        priority: task.priority,
        urgency: task.urgency
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

// ML Prediction API with better error handling
app.post("/api/predict-priority", async (req, res) => {
  try {
    const { category, urgency, deadline_hours } = req.body;

    console.log('📊 ML Prediction Request:', { category, urgency, deadline_hours });

    // Validate inputs
    if (!category || !urgency || !deadline_hours) {
      console.error('❌ Missing required fields for ML prediction');
      return res.status(400).json({ error: "Missing required fields: category, urgency, deadline_hours" });
    }

    // Ensure category is one of the expected values
    const validCategories = ['Bills', 'Delivery', 'Groceries', 'Others'];
    const normalizedCategory = validCategories.includes(category) ? category : 'Others';

    // Ensure urgency is valid
    const validUrgencies = ['Low', 'Medium', 'High'];
    const normalizedUrgency = validUrgencies.includes(urgency) ? urgency : 'Medium';

    // Ensure deadline_hours is a number
    const hours = parseInt(deadline_hours);
    if (isNaN(hours) || hours <= 0) {
      console.error('❌ Invalid deadline_hours:', deadline_hours);
      return res.status(400).json({ error: "Invalid deadline_hours" });
    }

    console.log('📊 Normalized ML Input:', { 
      normalizedCategory, 
      normalizedUrgency, 
      hours 
    });

    try {
      const response = await axios.post("http://127.0.0.1:5000/predict", {
        category: normalizedCategory,
        urgency: normalizedUrgency,
        deadline_hours: hours
      }, {
        timeout: 5000 // 5 second timeout
      });

      console.log('✅ ML Response:', response.data);
      res.json(response.data);

    } catch (mlError) {
      console.error('⚠️ ML Server Error:', mlError.message);
      
      // Fallback priority logic when ML server is down
      let fallbackPriority = "Medium";
      
      if (normalizedUrgency === "High") {
        fallbackPriority = "High";
      } else if (hours < 24) {
        fallbackPriority = "High";
      } else if (normalizedUrgency === "Low" && hours >= 72) {
        fallbackPriority = "Low";
      } else if (normalizedUrgency === "Medium" && hours < 72) {
        fallbackPriority = "Medium";
      } else {
        fallbackPriority = "Medium";
      }

      console.log('🔄 Using fallback priority:', fallbackPriority);
      res.json({ 
        priority: fallbackPriority,
        fallback: true,
        message: "ML server unavailable, using fallback logic"
      });
    }

  } catch (error) {
    console.error("❌ ML API error:", error.message);
    res.status(500).json({ 
      error: "Could not get prediction",
      message: error.message
    });
  }
});

// Store route information for a task - IMPROVED VERSION
app.post('/tasks/:id/route', (req, res) => {
    console.log('POST /tasks/:id/route called');
    console.log('Task ID:', req.params.id);
    console.log('Request body:', req.body);

    if (!req.session.user) {
        console.log('Unauthorized - no user session');
        return res.status(401).json({ error: "Unauthorized" });
    }

    const { originLat, originLon, destLat, destLon, distance, duration } = req.body;
    
    console.log('Route data received:');
    console.log('   Origin:', originLat, originLon);
    console.log('   Destination:', destLat, destLon);
    console.log('   Distance:', distance);
    console.log('   Duration:', duration);

    // Validate coordinates
    if (!originLat || !originLon || !destLat || !destLon) {
        console.log('Missing coordinates');
        return res.status(400).json({ error: "Missing coordinates" });
    }

    // Validate numeric values
    if (isNaN(parseFloat(originLat)) || isNaN(parseFloat(originLon)) || 
        isNaN(parseFloat(destLat)) || isNaN(parseFloat(destLon))) {
        console.log('Invalid coordinate values');
        return res.status(400).json({ error: "Invalid coordinate values" });
    }

    db.query(
        `UPDATE tasks 
         SET origin_lat = ?, origin_lon = ?,
             dest_lat = ?, dest_lon = ?,
             route_distance = ?, route_duration = ?
         WHERE task_id = ? AND user_id = ?`,
        [
            parseFloat(originLat), parseFloat(originLon),
            parseFloat(destLat), parseFloat(destLon),
            parseFloat(distance), parseInt(duration),
            req.params.id, req.session.user.user_id
        ],
        (err, result) => {
            if (err) {
                console.error("Database error:", err);
                return res.status(500).json({ error: "Database error: " + err.message });
            }
            
            console.log('Database result:', result);
            
            if (result.affectedRows === 0) {
                console.log('No task found or no permission');
                return res.status(404).json({ error: "Task not found" });
            }
            
            console.log('Route saved successfully!');
            res.json({ 
                success: true,
                message: "Route saved successfully",
                affectedRows: result.affectedRows
            });
        }
    );
});

// Get route information for a task
app.get('/tasks/:id/route', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });

    const sql = `
        SELECT origin, destination, 
               origin_lat, origin_lon,
               dest_lat, dest_lon,
               route_distance, route_duration
        FROM tasks 
        WHERE task_id = ? AND user_id = ?`;
    
    db.query(sql, [req.params.id, req.session.user.user_id], (err, results) => {
        if (err) {
            console.error("Route fetch error:", err);
            return res.status(500).json({ error: "Database error" });
        }
        
        if (results.length > 0 && results[0].origin_lat !== null) {
            res.json({ 
                success: true, 
                route: results[0] 
            });
        } else {
            res.json({ 
                success: false, 
                message: "No route saved" 
            });
        }
    });
});

// GET TASKS - FIXED VERSION
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
      complete,
      origin_lat,
      origin_lon,
      dest_lat, 
      dest_lon,
      route_distance,
      route_duration
    FROM tasks
    WHERE user_id = ?
  `;
  
  db.query(sql, [req.session.user.user_id], (err, results) => {
    if (err) {
      console.error("DB Fetch Error:", err);
      return res.status(500).json({ error: "Database error" });
    }
    
    // Debug: Log what we're getting from database
    console.log('📋 TASKS FROM DATABASE:');
    results.forEach(task => {
      console.log(`   Task ${task.id} "${task.title}":`, {
        origin_lat: task.origin_lat,
        origin_lon: task.origin_lon,
        dest_lat: task.dest_lat,
        dest_lon: task.dest_lon,
        route_distance: task.route_distance,
        route_duration: task.route_duration,
        hasRoute: !!(task.origin_lat && task.dest_lat)
      });
    });
    
    res.json(results);
  });
});

// ADD TASK ROUTE - SIMPLIFIED (NO URGENCY)
app.post('/add-task', async (req, res) => {
  if (!req.session.user) return res.status(401).send("Unauthorized");

  try {
    const { title, category, remarks, origin, destination, deadline } = req.body;

    console.log('📝 Add Task Request:', { title, category, deadline });

    // Calculate hours until deadline
    const now = new Date();
    const deadlineDate = new Date(`${deadline}T23:59:59`);
    const diffMs = deadlineDate.getTime() - now.getTime();
    const hoursUntilDeadline = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));

    let predictedPriority = "Medium";

    try {
      const mlResponse = await axios.post("http://127.0.0.1:5000/predict", {
        category: category || "Others",
        deadline_hours: hoursUntilDeadline
      });

      predictedPriority = mlResponse.data.priority || "Medium";
      console.log("✅ ML Predicted Priority:", predictedPriority);

    } catch (mlErr) {
      console.warn("⚠️ ML Server not reachable, using fallback");
      
      // Simple fallback based on deadline only
      if (hoursUntilDeadline < 24) {
        predictedPriority = "High";
      } else if (hoursUntilDeadline < 72) {
        predictedPriority = "Medium";
      } else {
        predictedPriority = "Low";
      }
    }

    // Insert into DB - NO URGENCY
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

// UPDATE TASK ROUTE - NO URGENCY
app.put('/tasks/:id', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { title, category, remarks, origin, destination, deadline } = req.body;

    console.log('📝 Edit Task Request:', { 
      title, category, deadline 
    });

    // Calculate hours until deadline
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const timeDiff = deadlineDate.getTime() - now.getTime();
    const hoursUntilDeadline = Math.max(1, Math.ceil(timeDiff / (1000 * 3600)));

    let predictedPriority = "Medium";

    try {
      const mlResponse = await axios.post("http://127.0.0.1:5000/predict", {
        category: category || "Others",
        deadline_hours: hoursUntilDeadline
      });

      predictedPriority = mlResponse.data.priority || "Medium";
      console.log("✅ ML Recalculated Priority:", predictedPriority);
      
    } catch (mlErr) {
      console.warn("⚠️ ML Server not reachable, using fallback priority");
      
      // Simple fallback based on deadline only
      if (hoursUntilDeadline < 24) {
        predictedPriority = "High";
      } else if (hoursUntilDeadline < 72) {
        predictedPriority = "Medium";
      } else {
        predictedPriority = "Low";
      }
      
      console.log("🔄 Fallback priority:", predictedPriority);
    }

    // Update without urgency
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
        res.json({ 
          success: true, 
          newPriority: predictedPriority
        });
      }
    );

  } catch (err) {
    console.error("Edit Task Error:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// Delete task
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

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.send('Logged out!');
});

// Start server
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});