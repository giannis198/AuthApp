//jshint esversion:6


require('dotenv').config()
var findOrCreate = require('mongoose-findorcreate')
var GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session')
const passport = require('passport')
const passportLocalMongoose = require('passport-local-mongoose')
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose")




/////////////////////////////// Encryptions //////////////////////////////////////////

// var encrypt = require('mongoose-encryption');

/////////////////////////////// Encryptions //////////////////////////////////////////
const app = express();

app.set('view engine', 'ejs');

app.use(express.static("public"))

app.use(bodyParser.urlencoded({extended: true}));

app.use(session({
  secret: 'Our little secret.',
  resave: false,
  saveUninitialized: false
}))

app.use(passport.initialize())
app.use(passport.session())



mongoose.connect('mongodb://127.0.0.1:27017/userDB');


const postSchema = new mongoose.Schema ({
    secret: String
})


const userSchema = new mongoose.Schema ({
    email: String,
    password: String,
    googleId : String,
    post: [postSchema]
})


userSchema.plugin(passportLocalMongoose)
postSchema.plugin(passportLocalMongoose)
userSchema.plugin(findOrCreate)

const Post = new mongoose.model("Post", postSchema)

const User = new mongoose.model("User", userSchema)



// CHANGE: USE "createStrategy" INSTEAD OF "authenticate"
passport.use(User.createStrategy());

passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      cb(null, { id: user.id, username: user.username, name: user.name });
    });
  });
  
  passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, user);
    });
  });
///////////////////// Google Authentication /////////////////////////////////
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

//////////////////////// Facebook Authentication ////////////////////////////////////

// passport.use(new FacebookStrategy({
//     clientID: FACEBOOK_APP_ID,
//     clientSecret: FACEBOOK_APP_SECRET,
//     callbackURL: "http://localhost:3000/auth/facebook/callback"
//   },
//   function(accessToken, refreshToken, profile, cb) {
//     User.findOrCreate({ facebookId: profile.id }, function (err, user) {
//       return cb(err, user);
//     });
//   }
// ));


app.get('/', function (req, res) {
    res.render('home')
  })

app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })
  );

  app.get("/auth/google/secrets", 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect secrets.
    res.redirect('/secrets');
  });


// app.get('/auth/facebook',
//   passport.authenticate('facebook'));

// app.get('/auth/facebook/secrets',
//   passport.authenticate('facebook', { failureRedirect: '/login' }),
//   function(req, res) {
//     // Successful authentication, redirect home.
//     res.redirect('/secrets');
//   });



app.route("/submit")
    .get(function (req, res) {
        if (req.isAuthenticated()) {
            res.render('submit')
        } else {
            res.redirect('/login')
        }
        
    })

    .post(async function (req,res) {
        
        const newPost = new Post({
            secret: req.body.secret
        })
       
        newPost.save()
        const userId = req.user.id
        await User.findByIdAndUpdate(userId, {$push: {post : newPost}})
        res.redirect('/secrets')
        console.log("Changes Saved Successfully!")
        
    })

///////////////////////// Login Route /////////////////////////////////////////////////////////
app.route('/login')
    .get(function (req, res) {
        res.render('login')
    })

    
    .post(async function (req, res) {

        const user = new User({
        username : req.body.username,
        password : req.body.password
        })

        req.login(user, function (err) {
        if (err) {
            console.log(err);
        } else {
            passport.authenticate("local")(req,res,function() {
            res.redirect("/secrets")
            
            })
        }  
        })
    })
    

app.get('/logout', function(req, res, next) {
    req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
    });
    });


app.get('/secrets',async function (req, res) {

const foundUsers= await User.find({"post.secret" : {$ne : null}})
foundUsers.forEach(function(user) {
    console.log(user.post.secret);
    
})
  
  if (foundUsers) {
    res.render("secrets",{usersWithSecrets : foundUsers})
  } else {

  }
})


//////////////////////// Register Route ////////////////////////////////////////////////////////
app.route('/register')
  .get(function (req, res) {
    res.render('register')
  })

  .post(function (req, res) {
    User.register({username: req.body.username, active: false}, req.body.password, function(err, user) {
      if (err) { 
        console.log(err)
        res.redirect('/register')
       } else {
        passport.authenticate('local') (req, res, function(){
          res.redirect('/secrets')
          })
        }})
      })


    





/////////////////////////////// Listen //////////////////////////////////////////////////////////////
app.listen(3000,function() {
    console.log("Server Started at localhost:3000");
  })