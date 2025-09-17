const express = require('express'); //web server
const mysql = require('mysql2'); //connect Node.js to MySQL
const bcrypt = require('bcryptjs'); //hash passowrds
const session = require('express-session'); //manage login sessions
const bodyParser = require('body-parser'); //parse form input
const path = require("path");

const app = express();
const PORT = 3000;

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

//MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'erruns_db'
});

db.connect(err => {
    if(err) throw err;
    console.log('MySQL connected!');
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
  const { username, password } = req.body;

  db.query("SELECT * FROM users WHERE username = ?", [username], (err, results) => {
    if (err) throw err;

    if (results.length === 0) {
      return res.send("User not found!");
    }

    const user = results[0];
    if (bcrypt.compareSync(password, user.password)) {
      req.session.user = user;
      res.redirect("/home"); // redirect to homepage
    } else {
      res.send("Incorrect password!");
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
    SELECT task_id AS id, title, location, duration, date, priority, complete
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

//add task
app.post('/add-task', (req, res)=>{
  if(!req.session.user) return res.status(401).send("Unauthorized");
  const { title, origin, duration, date, priority } = req.body;
  let locations = req.body["taskLocations[]"];

  //if user adds multiple, req.body.locations[] comes as array
  if(Array.isArray(locations)){
    locations = locations.join(", ");
  }

  db.query(
    "INSERT INTO tasks (user_id, title, origin, location, duration, date, priority, complete) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", 
  [req.session.user.user_id, title, origin, locations || "", duration, date, priority, comeplete || 0],
    (err, result) => {
      if(err) throw err;
      res.redirect("/home");
    }
  );
});


//edit task
app.put('/tasks/:id', (req, res) => {
    const { title, location, duration, date, priority, complete } = req.body;
    db.query(
        "UPDATE tasks SET title=?, location=?, duration=?, date=?, priority=?, complete=? WHERE task_id=? AND user_id=?",
        [title, location, duration, date, priority, complete || 0, req.params.id, req.session.user.id],
        (err) => {
            if (err) throw err;
            res.send({ success: true });
        }
    );
});

//delete task
app.delete('/tasks/:id', (req, res) => {
    db.query(
        "DELETE FROM tasks WHERE task_id=? AND user_id=?",
        [req.params.id, req.session.user.id],
        (err) => {
            if (err) throw err;
            res.send({ success: true });
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