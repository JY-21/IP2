const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require("path");
const MySQLStore = require('express-mysql-session')(session);

const app = express();
const PORT = 3000;

const axios = require("axios");

const OPENROUTE_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjllMzhmNmVjZDgwODQwM2U5YWM0NmNkNGNkZjgwOWJiIiwiaCI6Im11cm11cjY0In0=';

// MySQL pool configuration
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'erruns_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Session store configuration
const sessionStore = new MySQLStore({
  clearExpired: true,
  checkExpirationInterval: 900000, // 15 minutes
  expiration: 86400000, // 24 hours
  createDatabaseTable: true,
  schema: {
    tableName: 'sessions',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data'
    }
  }
}, db);

// Session configuration
app.use(session({
  key: 'session_cookie_name',
  secret: 'your_strong_secret_key_here_change_this', // Change this to a strong secret
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, "views")));
app.use(express.static(path.join(__dirname, "public")));

// Session debugging middleware
app.use((req, res, next) => {
  console.log('Session Debug:');
  console.log('  Session ID:', req.sessionID);
  console.log('  User in session:', req.session.user ? 'Logged in' : 'Not logged in');
  console.log('  Path:', req.path);
  next();
});

// Database connection check
db.getConnection((err, connection) => {
  if (err) {
    console.error('MySQL connection failed:', err);
  } else {
    console.log('✅ MySQL connected!');
    connection.release();
  }
});

db.on('error', (err) => {
  console.error('⚠️ MySQL Pool Error:', err.code);
});

// Authentication middleware
const requireAuth = (req, res, next) => {
  console.log('🔐 Auth check for:', req.path);
  console.log('   Session user:', req.session.user);
  
  if (req.session && req.session.user) {
    next();
  } else {
    console.log('❌ Unauthorized access attempt to:', req.path);
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.status(401).json({ error: "Unauthorized - Please login again" });
    } else {
      return res.redirect('/login');
    }
  }
};

// Apply auth middleware to protected routes
const protectedRoutes = ['/home', '/profile', '/tasks', '/api/tasks', '/api/profile', '/api/optimized-route', '/api/user-location'];
protectedRoutes.forEach(route => {
  if (route.startsWith('/api')) {
    app.all(route, requireAuth);
  } else {
    app.get(route, requireAuth);
  }
});

// Public Routes
app.get("/", (req, res) => {
  if (req.session.user) {
    return res.redirect('/home');
  }
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

app.get("/login", (req, res) => {
  if (req.session.user) {
    return res.redirect('/home');
  }
  res.sendFile(path.join(__dirname, "views", "login_page.html"));
});

app.get("/signup", (req, res) => {
  if (req.session.user) {
    return res.redirect('/home');
  }
  res.sendFile(path.join(__dirname, "views", "sign_up_page.html"));
});

// Handle sign up
app.post("/signup", (req, res) => {
  const { first_name, last_name, email, username, password } = req.body;

  // Check if user already exists
  db.query(
    "SELECT user_id FROM users WHERE username = ? OR email = ?",
    [username, email],
    (err, results) => {
      if (err) {
        console.error("Signup DB Error:", err);
        return res.status(500).json({ success: false, message: "Database error" });
      }

      if (results.length > 0) {
        return res.status(400).json({ success: false, message: "Username or email already exists" });
      }

      const hashedPassword = bcrypt.hashSync(password, 10);

      db.query(
        "INSERT INTO users (first_name, last_name, email, username, password) VALUES (?, ?, ?, ?, ?)",
        [first_name, last_name, email, username, hashedPassword],
        (err, result) => {
          if (err) {
            console.error("Signup Insert Error:", err);
            return res.status(500).json({ success: false, message: "Error creating account" });
          }
          res.json({ success: true, message: "Account created successfully" });
        }
      );
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
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const user = results[0];
    if (bcrypt.compareSync(password, user.password)) {
      // Set session with user data (excluding password)
      req.session.user = {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name
      };

      // Explicitly save session
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ success: false, message: "Session error" });
        }
        console.log('✅ Login successful for user:', user.username);
        res.json({ success: true, user: req.session.user });
      });
    } else {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  });
});

// Auth check endpoint
app.get('/api/check-auth', (req, res) => {
  if (req.session && req.session.user) {
    res.json({ 
      authenticated: true, 
      user: req.session.user 
    });
  } else {
    res.status(401).json({ 
      authenticated: false,
      message: "Not authenticated" 
    });
  }
});

// Profile routes
app.get("/profile", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "views", "profile.html"));
});

app.get("/api/profile", requireAuth, (req, res) => {
  const sql = "SELECT first_name, last_name, email, username FROM users WHERE user_id = ?";
  db.query(sql, [req.session.user.user_id], (err, results) => {
    if (err) {
      console.error("Profile fetch error:", err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(results[0]);
  });
});

app.put("/api/profile", requireAuth, (req, res) => {
  const { first_name, last_name, email, username, password } = req.body;
  let sql = "UPDATE users SET first_name=?, last_name=?, email=?, username=?";
  let params = [first_name, last_name, email, username];

  if (password && password.trim() !== "") {
    const hashedPassword = bcrypt.hashSync(password, 10);
    sql += ", password=?";
    params.push(hashedPassword);
  }

  sql += " WHERE user_id=?";
  params.push(req.session.user.user_id);

  db.query(sql, params, (err, result) => {
    if (err) {
      console.error("Profile update error:", err);
      return res.status(500).json({ error: "Database error" });
    }
    
    // Update session data
    req.session.user.first_name = first_name;
    req.session.user.last_name = last_name;
    req.session.user.email = email;
    req.session.user.username = username;
    
    res.json({ success: true, message: "Profile updated successfully" });
  });
});

app.delete("/api/profile", requireAuth, (req, res) => {
  const sql = "DELETE FROM users WHERE user_id = ?";
  db.query(sql, [req.session.user.user_id], (err, result) => {
    if (err) {
      console.error("Account deletion error:", err);
      return res.status(500).json({ error: "Database error" });
    }

    req.session.destroy((err) => {
      if (err) {
        console.error("Session destruction error:", err);
      }
      res.json({ success: true, message: "Account deleted successfully" });
    });
  });
});

// Home route
app.get('/home', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "views", "home.html"));
});

// Task routes
app.get('/tasks', requireAuth, (req, res) => {
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
    
    console.log('📋 Tasks loaded for user:', req.session.user.username);
    res.json(results);
  });
});

app.post('/add-task', requireAuth, async (req, res) => {
  try {
    const { title, category, remarks, origin, destination, deadline } = req.body;

    console.log('📝 Add Task Request from user:', req.session.user.username);

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
      }, { timeout: 5000 });

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

    // Insert into DB
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

app.put('/tasks/:id', requireAuth, async (req, res) => {
  try {
    const { title, category, remarks, origin, destination, deadline, complete, completedAt } = req.body;

    console.log('📝 Edit/Complete Task Request for task:', req.params.id, 'Complete:', complete);

    // If this is a completion request
    if (complete === 1) {
      db.query(
        `UPDATE tasks 
         SET complete = ?, completed_at = ?
         WHERE task_id = ? AND user_id = ?`,
        [
          1,
          completedAt || new Date(),
          req.params.id,
          req.session.user.user_id
        ],
        (err, result) => {
          if (err) {
            console.error("DB Completion Error:", err);
            return res.status(500).json({ error: "Database error" });
          }
          console.log('✅ Task marked as complete:', req.params.id);
          res.json({ 
            success: true, 
            message: "Task completed successfully"
          });
        }
      );
      return; // Exit early for completion requests
    }

    // Original edit task logic for non-completion requests
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const timeDiff = deadlineDate.getTime() - now.getTime();
    const hoursUntilDeadline = Math.max(1, Math.ceil(timeDiff / (1000 * 3600)));

    let predictedPriority = "Medium";

    try {
      const mlResponse = await axios.post("http://127.0.0.1:5000/predict", {
        category: category || "Others",
        deadline_hours: hoursUntilDeadline
      }, { timeout: 5000 });

      predictedPriority = mlResponse.data.priority || "Medium";
      console.log("✅ ML Recalculated Priority:", predictedPriority);
      
    } catch (mlErr) {
      console.warn("⚠️ ML Server not reachable, using fallback priority");
      
      if (hoursUntilDeadline < 24) {
        predictedPriority = "High";
      } else if (hoursUntilDeadline < 72) {
        predictedPriority = "Medium";
      } else {
        predictedPriority = "Low";
      }
    }

    // Update task for editing
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
    console.error("Edit/Complete Task Error:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.delete('/tasks/:id', requireAuth, (req, res) => {
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

// Route management
app.post('/tasks/:id/route', requireAuth, (req, res) => {
    console.log('POST /tasks/:id/route called by user:', req.session.user.username);

    const { originLat, originLon, destLat, destLon, distance, duration } = req.body;
    
    // Validate coordinates
    if (!originLat || !originLon || !destLat || !destLon) {
        return res.status(400).json({ error: "Missing coordinates" });
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
            
            if (result.affectedRows === 0) {
                return res.status(404).json({ error: "Task not found" });
            }
            
            console.log('✅ Route saved successfully for task:', req.params.id);
            res.json({ 
                success: true,
                message: "Route saved successfully"
            });
        }
    );
});

app.get('/tasks/:id/route', requireAuth, (req, res) => {
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

// API routes
app.post('/api/directions', requireAuth, async (req, res) => {
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

app.get('/api/user-location', requireAuth, async (req, res) => {
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

app.get('/api/optimized-route', requireAuth, async (req, res) => {
  try{
    const sql = `
      SELECT task_id, title, origin, location, priority
      FROM tasks
      WHERE user_id = ? AND complete = 0`;

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

// ML Prediction API
app.post("/api/predict-priority", requireAuth, async (req, res) => {
  try {
    const { category, deadline_hours } = req.body;

    console.log('📊 ML Prediction Request from user:', req.session.user.username);

    if (!category || !deadline_hours) {
      return res.status(400).json({ error: "Missing required fields: category, deadline_hours" });
    }

    const validCategories = ['Bills', 'Delivery', 'Groceries', 'Others'];
    const normalizedCategory = validCategories.includes(category) ? category : 'Others';

    const hours = parseInt(deadline_hours);
    if (isNaN(hours) || hours <= 0) {
      return res.status(400).json({ error: "Invalid deadline_hours" });
    }

    try {
      const response = await axios.post("http://127.0.0.1:5000/predict", {
        category: normalizedCategory,
        deadline_hours: hours
      }, { timeout: 5000 });

      console.log('✅ ML Response:', response.data);
      res.json(response.data);

    } catch (mlError) {
      console.error('⚠️ ML Server Error:', mlError.message);
      
      // Fallback priority logic
      let fallbackPriority = "Medium";
      if (hours < 24) {
        fallbackPriority = "High";
      } else if (hours >= 72) {
        fallbackPriority = "Low";
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

// History routes
app.get("/history", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "views", "history.html"));
});

// Get completed tasks for history page
app.get('/api/completed-tasks', requireAuth, (req, res) => {
  const sql = `
    SELECT 
      task_id AS id, 
      title, 
      category, 
      remarks, 
      origin, 
      location AS destination,
      multi_destinations,
      deadline, 
      priority, 
      complete,
      completed_at,
      origin_lat,
      origin_lon,
      dest_lat, 
      dest_lon,
      route_distance,
      route_duration,
      total_route_distance,
      total_route_duration
    FROM tasks
    WHERE user_id = ? AND complete = 1
    ORDER BY completed_at DESC
  `;
  
  db.query(sql, [req.session.user.user_id], (err, results) => {
    if (err) {
      console.error("History DB Fetch Error:", err);
      return res.status(500).json({ error: "Database error" });
    }
    
    // Parse multi_destinations JSON
    results.forEach(task => {
      if (task.multi_destinations) {
        try {
          task.multi_destinations = JSON.parse(task.multi_destinations);
        } catch (e) {
          task.multi_destinations = null;
        }
      }
    });
    
    console.log('📜 Loaded completed tasks:', results.length);
    res.json(results);
  });
});

// Get history statistics
app.get('/api/history-stats', requireAuth, (req, res) => {
  const sql = `
    SELECT 
      COUNT(*) as total_completed,
      SUM(CASE WHEN completed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as this_week,
      SUM(CASE WHEN completed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) as this_month
    FROM tasks 
    WHERE user_id = ? AND complete = 1
  `;
  
  db.query(sql, [req.session.user.user_id], (err, results) => {
    if (err) {
      console.error("History Stats DB Error:", err);
      return res.status(500).json({ error: "Database error" });
    }
    
    res.json(results[0] || { total_completed: 0, this_week: 0, this_month: 0 });
  });
});

// Logout
app.post('/logout', (req, res) => {
  console.log('🚪 Logout request from user:', req.session.user?.username);
  req.session.destroy((err) => {
    if (err) {
      console.error("Session destruction error:", err);
      return res.status(500).json({ error: "Logout failed" });
    }
    res.json({ success: true, message: "Logged out successfully" });
  });
});

// 404 handler
app.use((req, res) => {
  if (req.xhr || req.headers.accept.indexOf('json') > -1) {
    res.status(404).json({ error: "Route not found" });
  } else {
    res.status(404).send('Page not found');
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('🚨 Server Error:', err);
  res.status(500).json({ error: "Internal server error" });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📝 Session storage: MySQL database`);
});