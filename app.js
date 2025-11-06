const express = require('express'); //web server
const mysql = require('mysql2'); //connect Node.js to MySQL
const bcrypt = require('bcryptjs'); //hash passowrds
const session = require('express-session'); //manage login sessions
const bodyParser = require('body-parser'); //parse form input
const path = require("path");

const app = express();
const PORT = 3000;

const axios = require("axios"); //install: npm install axios

const OPENROUTE_API_KEY = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjllMzhmNmVjZDgwODQwM2U5YWM0NmNkNGNkZjgwOWJiIiwiaCI6Im11cm11cjY0In0=';

// Get directions between two points - CORRECTED SYNTAX
app.post('/api/directions', async (req, res) => {
  try {
    const { origin, destination, profile = 'driving-car' } = req.body;
    
    if (!origin.lat || !origin.lon || !destination.lat || !destination.lon) {
      return res.status(400).json({ error: "Invalid coordinates" });
    }

    const coordinates = [
      [origin.lon, origin.lat],
      [destination.lon, destination.lat]
    ];

    const response = await axios.post(
      `https://api.openrouteservice.org/v2/directions/${profile}/geojson`,
      {
        coordinates: coordinates,
        instructions: true,
        instructions_format: 'text'
      },
      {
        headers: {
          'Authorization': OPENROUTE_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({
      success: true,
      route: response.data,
      distance: response.data.features[0].properties.segments[0].distance,
      duration: response.data.features[0].properties.segments[0].duration
    });

  } catch (error) {
    console.error('Directions error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to get directions' });
  }
});

//get user's current location (for route starting point)
app.get('/api/user-location', async (req, res) => {
  if(!req.session.user){
    return res.status(401).json({ error: "Unauthorized" });
  }

  try{
    //for now, return the first task's location as reference
     // In a real app, you'd use browser geolocation or user's saved address
    const sql =`
    SELECT latitude, longitue
    FROM tasks
    WHERE user_id = ? AND latitude IS NOT NULL
    LIMIT 1`;

    db.query(sql, [req.session.user.user_id], (err, results) => {
      if(err){
        console.error("DB Fetch Error:", err);
        return res.status(500).json({ error: "Database error" });
      }

      if(results.length>0){
        res.json({
          success: true,
          location: {
            lat: results[0].latitude,
            lon: results[0].longitude
          }
        });
      } else {
        //default location if no tasks exists
        res.json({
          success: true,
          location: {
            lat: 51.505,
            lon: -0.09
          }
        });
      }
    });
  } catch (error){
    console.error("User location error:", error);
    res.status(500).json({ error: "Failed to get user location" });
  }
});

//add the new routes after existing routes
app.get('/api/optimized-route', async (req, res) => {
  if(!req.session.user){
    return res.status(401).json({ error: "Unauthorized" });
  }

  try{
    //get all tasks with coordinates
    const sql = `
      SELECT task_id, title, origin, location, latitude, longitude, priority
      FROM  tasks
      WHERE user_id = ? AND latitude IS NOT NULL AND longitude IS NOT NULL`;

    db.query(sql, [req.session.user.user_id], async (err, results) => {
      if(err){
        console.error("DB Fetch Error:", err);
        return res.status(500).json( { error: "Database error"} );
      }

      if(results.length == 0){
        return res.json( { success: true, message: "No geocoded tasks found"});
      }

      const locations = results.map(task => ({
        id: task.task_id,
        title: task.title,
        lat: task.latitude,
        lon: task.longitude,
        priority: task.priority
      }));

      res.json({
        success: true,
        tasks: locations,
        message: "Task locations loaded (basic version - full optimization coming soon)"
      });
    });
  } catch (error){
    console.error("Route optimization error:", error);
    res.status(500).json( {error: "Route optimization failed" });
  }
});

async function geocodeWithORS(address){
  try{
    const response = await axios.post(
      'https://api.openrouteservice.org/geocode/search',
      {
        text: address,
        size: 1
      },
      {
        headers: {
          'Authorization': OPENROUTE_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data && response.data.features && response.data.features.length > 0){
      const feature = response.data.features[0];
      return {
        lat: feature.geometry.coordinates[1],
        lon: feature.geometry.coordinates[0],
        address: feature.properties.label,
        confidence: feature.properties.confidence
      };
    }
    return null;
  } catch (error){
    console.error('ORS Geocoding error:', error.response?.data || error.message);
    return null;
  }
}

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

// Persistent MySQL pool (won't close between queries)
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

//get tasks from database - UPDATED to include coordinates
app.get('/tasks', (req, res)=>{
  if(!req.session.user){
    return res.status(401).json({error: "Unauthorized"});
  }

  const sql = `
    SELECT task_id AS id, title, category, remarks, origin, location, deadline, priority, complete, latitude, longitude
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

// ADD TASK ROUTE (with ML and AUTO-GEOCODING) - UPDATED
app.post('/add-task', async (req, res) => {
  if (!req.session.user) return res.status(401).send("Unauthorized");

  try {
    const { title, category, remarks, origin, deadline } = req.body;
    let locations = req.body["taskLocations[]"];
    if (Array.isArray(locations)) locations = locations.join(", ");

    // ✅ AUTO-GEOCODE: Geocode the origin address
    let originCoords = null;
    if (origin) {
      originCoords = await geocodeWithORS(origin);
      console.log("📍 Origin geocoded:", originCoords);
    }

    // Calculate hours until deadline
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const timeDiff = deadlineDate.getTime() - now.getTime();
    const daysUntilDeadline = Math.ceil(timeDiff / (1000 * 3600 * 24));
    const hoursUntilDeadline = Math.max(1, daysUntilDeadline * 24);

    let predictedPriority = "Medium";

    try {
      const mlResponse = await axios.post("http://127.0.0.1:5000/predict", {
        category: category || "General",
        urgency: req.body.priority || "Medium",
        deadline_hours: hoursUntilDeadline
      });
      predictedPriority = mlResponse.data.priority || "Medium";
      console.log("✅ ML Response Priority:", predictedPriority);
    } catch (mlErr) {
      console.warn("⚠️ ML Server not reachable, using fallback priority");
    }

    // Insert into DB with coordinates
    db.query(
      `INSERT INTO tasks 
       (user_id, title, category, remarks, origin, location, deadline, priority, complete, latitude, longitude) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.session.user.user_id,
        title,
        category,
        remarks,
        origin,
        locations || "",
        deadline,
        predictedPriority,
        0,
        originCoords ? originCoords.lat : null,
        originCoords ? originCoords.lon : null
      ],
      (err, result) => {
        if (err) {
          console.error("DB Insert Error:", err);
          return res.status(500).json({ error: "Error saving task" });
        }
        res.json({ 
          success: true, 
          taskId: result.insertId, 
          priority: predictedPriority,
          coordinates: originCoords
        });
      }
    );

  } catch (err) {
    console.error("ML/DB Error:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// EDIT TASK ROUTE (with ML and AUTO-GEOCODING) - UPDATED
app.put('/tasks/:id', async (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });

    try {
        const { title, category, remarks, origin, deadline, priority, complete } = req.body;
        let locations = req.body["taskLocations[]"];

        if (Array.isArray(locations)) {
            locations = locations.join(", ");
        }

        // ✅ AUTO-GEOCODE: Geocode the origin address
        let originCoords = null;
        if (origin) {
          originCoords = await geocodeWithORS(origin);
          console.log("📍 Edit - Origin geocoded:", originCoords);
        }

        // Calculate hours until deadline
        const now = new Date();
        const deadlineDate = new Date(deadline);
        const timeDiff = deadlineDate.getTime() - now.getTime();
        const daysUntilDeadline = Math.ceil(timeDiff / (1000 * 3600 * 24));
        const hoursUntilDeadline = Math.max(1, daysUntilDeadline * 24);

        let predictedPriority = priority || "Medium";

        try {
            const mlResponse = await axios.post("http://127.0.0.1:5000/predict", {
                category: category || "General",
                urgency: priority || "Medium",
                deadline_hours: hoursUntilDeadline
            });
            predictedPriority = mlResponse.data.priority || "Medium";
            console.log("✅ ML Recalculated Priority:", predictedPriority);
        } catch (mlErr) {
            console.warn("⚠️ ML Server not reachable, using existing priority");
        }

        // Update with coordinates
        db.query(
            `UPDATE tasks 
             SET title=?, category=?, remarks=?, origin=?, location=?, deadline=?, priority=?, complete=?, latitude=?, longitude=?
             WHERE task_id=? AND user_id=?`,
            [
                title,
                category,
                remarks,
                origin,
                locations || "",
                deadline,
                predictedPriority,
                complete || 0,
                originCoords ? originCoords.lat : null,
                originCoords ? originCoords.lon : null,
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