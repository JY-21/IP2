const express = require('express'); //web server
const mysql = require('mysql2'); //connect Node.js to MySQL
const bcrypt = require('bcryptjs'); //hash passowrds
const session = require('express-session'); //manage login sessions
const bodyParser = require('body-parser'); //parse form input

const app = express();

//middleware
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(session({
    secret: 'secret_key', 
    resave: false,
    saveUninitialized: true
}));

//serve static html files (login and sign up)
app.use(express.static(path.join(__dirname)))

//MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'errun_eb'
});

db.connect(err => {
    if(err) throw err;
    console.log('MySQL connected!');
});

//routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


//handle sign up
app.post('/signup', (req, res) => {
    const { first_name, last_name, email, username, password } = req.body;

    //hash password
    const hashedPassword = bcrypt.hashSync(password, 10);

    db.query('INSERT INTO users (first_name, last_name, email, username, password) VALUES (?, ?, ?, ?, ?)', [first_name, last_name, email, username, hashedPassword],
    (err, result) => {
        if(err, result) throw err;
        res.send('User registered! <a href="login_page.html">Login Here</a>');
    });

});

//handle login
app.post('/login', (req, res) => {
    const{ username, password } = req.body;

    db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
        if(err) throw err;

        if(results.length ===0){
            return res.send('User not found!');
        }

        const user = results[0];
        if (bcrypt.compareSync(password, user.password)){
            req.session.user = user;
            res.send('Login successful! <a href = "index.html">Go Home</a>');
        } else {
            res.send('Incorrect password!');
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