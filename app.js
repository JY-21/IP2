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
      res.redirect("/"); // redirect to homepage
    } else {
      res.send("Incorrect password!");
    }
  });
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