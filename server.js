const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const session = require('express-session');
const app = express();
const port = 3000;
const saltRounds = 10;

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session setup
app.use(session({
  secret: 'your_secret_key', // Replace with a real secret key
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS
}));

// MongoDB setup
const mongoURL = 'mongodb+srv://Group10DB:WeAreGroupTen10@group10cluster.df8uelv.mongodb.net/'; // Replace with your MongoDB connection string
const client = new MongoClient(mongoURL);

let dbClient;

// Connect to MongoDB
async function connectToMongoDB() {
  try {
    await client.connect();
    dbClient = client.db('MoviesRating');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  }
}

connectToMongoDB();

app.get('/signup', (req, res) => {
  res.render('signup');
});

app.get('/', (req, res) => {
  // Check if the user is logged in
  if (req.session.user) {
    res.render('homepage', { user: req.session.user });
  } else {
    res.redirect('/login');
  }
});
app.get('/login', (req, res) => {
  res.render('login');
});

app.get('/create', (req, res) => {
  res.render('create');
});

app.get('/searchResults', (req, res) => {
  res.render('searchResults');
});

app.get('/review', (req, res) => {
  res.render('review');
});

app.post('/submitReview', async (req, res) => {
  const { movieName, userName, reviewScore, reviewText } = req.body;

  try {
      await client.connect();
      const db = client.db('MoviesRating');
      const reviewsCollection = db.collection('reviews');

      // Assuming you have a 'reviews' collection in your MongoDB
      const newReview = {
          movieName,
          userName,
          reviewScore,
          reviewText,
          // You can add additional fields as needed
      };

      await reviewsCollection.insertOne(newReview);

      // Fetch all reviews from the database
      const allReviews = await reviewsCollection.find({}).toArray();

 res.render('review', { reviews: allReviews });

  } catch (error) {
      console.error('Error during review submission:', error);
      res.send('An error occurred during review submission.');
  } finally {
     // await client.close();
  }
});




app.get('/settings', (req, res) => {
  if (req.session.user) {
    res.render('settings', { user: req.session.user });
  } else {
    res.redirect('/login');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
      res.send('An error occurred.');
    } else {
      res.redirect('/login');
    }
  });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    await client.connect();
    const db = client.db('MoviesRating');
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ username });
    if (user && await bcrypt.compare(password, user.password)) {
      // Store additional user details in the session
      req.session.user = {
        username: user.username,
        email: user.email,
        firstName: user.firstname, // Assuming the field is 'firstname' in your MongoDB
        lastName: user.surname     // Assuming the field is 'surname' in your MongoDB
      };
      res.redirect('/');
    } else {
      res.send('Invalid username or password.');
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.send('An error occurred.');
  } finally {
    //await client.close();
  }
});

app.get('/allreviews', async (req, res) => {
  const pageSize = 10;
  const page = req.query.page ? parseInt(req.query.page) : 0;

  try {
      const reviewsCollection = dbClient.collection('reviews');
      const reviews = await reviewsCollection.find({})
                                             .skip(page * pageSize)
                                             .limit(pageSize)
                                             .toArray();
      res.render('allreviews', { reviews: reviews, currentPage: page });
  } catch (error) {
      console.error('Error fetching reviews:', error);
      res.send('Error occurred while fetching reviews.');
  }
});

app.get('/search', (req, res) => {
  res.render('search');
});

app.get('/homepage', (req, res) => {
  res.render('homepage');
});


app.get('/', (req, res) => 
{
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});



app.post('/searchMovies', async (req, res) => {
  const { searchQuery } = req.body;
  const baseURL = 'https://image.tmdb.org/t/p/w500'; // Adjust the base URL if needed

  try {
    await client.connect();
    const db = client.db('MoviesRating');
    const moviesCollection = db.collection('movies');

    const regex = new RegExp(searchQuery, 'i');
    const matchingMovies = await moviesCollection.find({ title: regex }).toArray();

    // Append the base URL to the poster_path for each movie
    const moviesWithImages = matchingMovies.map(movie => ({
      ...movie,
      fullImagePath: baseURL + movie.poster_path
    }));

    // Render the searchResults template with the movies
    res.render('searchResults', { movies: moviesWithImages });
  } catch (error) {
    console.error('Error during movie search:', error);
    res.send('An error occurred during movie search.');
  } finally {
    // It's usually not needed to close the connection after each request
  }
});


app.post('/signup', async (req, res) => {
  const { username, password, firstname, surname, email } = req.body;

  try {
    await client.connect();
    const db = client.db('MoviesRating');
    const usersCollection = db.collection('users');

    const existingUser = await usersCollection.findOne({ username });
    const existingEmail = await usersCollection.findOne({ email });

    if (existingUser || existingEmail) {
      res.send('Username or email already exists.');
    } else {
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      const newUser = { username, password: hashedPassword, firstname, surname, email };
      await usersCollection.insertOne(newUser);

      // Send HTML response with a button to go to the login page
      res.send(`
        <!DOCTYPE html>
        <html>

        <head>
            <title>Sign Up Successful</title>
        </head>
        <body>
            <h1 style="color:black;font-family: Arial, Helvetica, sans-serif;">Sign-up successful!</h1>
            <p style="color:black;font-family: Arial, Helvetica, sans-serif;">You can now log in.</p>
            <form action="/login">
                <button type="submit">Go to Login</button>
            </form>
        </body>
        </html>
      `);
    }
  } catch (error) {
    console.error('Error during sign up:', error);
    res.send('An error occurred.');
  } finally {
    // Consider closing the client connection if it's no longer needed
    // await client.close();
  }
});

app.post('/updateUser', async (req, res) => {
  const { firstName, lastName, email } = req.body;

  try {
      await client.connect();
      const db = client.db('MoviesRating');
      const usersCollection = db.collection('users');

      await usersCollection.updateOne(
          { username: req.session.user.username },
          { $set: { firstname: firstName, surname: lastName, email: email } }
      );

      // Update session data to reflect changes
      req.session.user.firstName = firstName;
      req.session.user.lastName = lastName;
      req.session.user.email = email;

      res.redirect('/settings');
  } catch (error) {
      console.error('Error during user update:', error);
      res.send('An error occurred during the update.');
  }
});


app.post('/deleteAccount', async (req, res) => {
  const { confirmPassword } = req.body;
  const username = req.session.user.username;

  try {
      await client.connect();
      const db = client.db('MoviesRating');
      const usersCollection = db.collection('users');

      const user = await usersCollection.findOne({ username });
      if (!user) {
          res.send('User not found.');
          return;
      }

      const match = await bcrypt.compare(confirmPassword, user.password);
      if (!match) {
          res.send('Password is incorrect.');
          return;
      }

      // Delete user account
      await usersCollection.deleteOne({ username: username });

      // Destroy user session and redirect to login or home page
      req.session.destroy(() => {
          res.redirect('/login');
      });
  } catch (error) {
      console.error('Error during account deletion:', error);
      res.send('An error occurred during account deletion.');
  } finally {
      await client.close();
  }
});


app.post('/updatePassword', async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const username = req.session.user.username;

  try {
      await client.connect();
      const db = client.db('MoviesRating');
      const usersCollection = db.collection('users');

      const user = await usersCollection.findOne({ username });
      if (!user) {
          res.send('User not found.');
          return;
      }

      // Verify old password
      const match = await bcrypt.compare(oldPassword, user.password);
      if (!match) {
          res.send('Old password is incorrect.');
          return;
      }

      // Hash new password and update
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
      await usersCollection.updateOne(
          { username: username },
          { $set: { password: hashedPassword } }
      );

      res.send('Password updated successfully.');
  } catch (error) {
      console.error('Error during password update:', error);
      res.send('An error occurred during the password update.');
  } finally {
      await client.close();
  }
});


app.use(express.static('public'));
app.post('/updateEmail', async (req, res) => {
  // Your code to update email
});
app.post('/updatePassword', async (req, res) => {
  // Your code to update password
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);

});