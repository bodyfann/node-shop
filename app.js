const path = require("path");

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
//const MongoDBStore = require("connect-mongodb-session")(session);

const { Datastore } = require("@google-cloud/datastore");
const { DatastoreStore } = require("@google-cloud/connect-datastore");

const csrf = require("csurf");
const flash = require("connect-flash");
const Multer = require("multer");

const errorController = require("./controllers/error");
const shopController = require("./controllers/shop");
const User = require("./models/user");

const MONGODB_URI = process.env.MONGO_DB_URI;

const app = express();
// const store = MongoDBStore({
//   uri: MONGODB_URI,
//   collection: "sessions",
// });

const csrfProtection = csrf();

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg"
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

const multer = Multer({
  storage: Multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // no larger than 5mb, you can change as needed.
  },
  fileFilter: fileFilter,
});

app.set("view engine", "ejs"); //ejs templates
app.set("views", "views"); //folders where templates are defined

const adminRoutes = require("./routes/admin");
const shopRoutes = require("./routes/shop");
const authRoutes = require("./routes/auth");

app.use(express.urlencoded({ extended: false }));
app.use(multer.single("image"));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: "my secret",
    resave: false,
    saveUninitialized: false,
    //store: store,
    store: new DatastoreStore({
      kind: "express-sessions",
      expirationMs: 0,
      dataset: new Datastore({
        projectId: process.env.GCLOUD_PROJECT,
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      }),
    }),
  })
);

app.use(flash());

/* =================== */
//Declaring webhook routes here instead of shop.js routes to avoid csrfProtection

app.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  shopController.postStripeWebhook
);

app.post(
  "/webhooks/paypal",
  express.raw({ type: "application/json" }),
  shopController.postPaypalWebhook
);

/* =================== */

app.use(csrfProtection);

app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isLoggedIn;
  res.locals.csrfToken = req.csrfToken();
  next();
});

app.use((req, res, next) => {
  if (!req.session.user) {
    return next();
  }
  User.findById(req.session.user._id)
    .then((user) => {
      if (!user) {
        return next();
      }
      req.user = user;
      next();
    })
    .catch((err) => {
      next(new Error(err));
    });
});

app.use("/admin", adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);

app.get("/500", errorController.get500Page);

app.use(errorController.get404Page);

app.use((error, req, res, next) => {
  // Leaving this here in case we want to show some useful 500 errors to the user
  // if (req.flash) {
  //   req.flash("error", error.message);
  // }
  console.log(error.message);
  res.redirect("/500");
});

mongoose.set("useNewUrlParser", true);
mongoose.set("useUnifiedTopology", true);
mongoose.set("useFindAndModify", false);
mongoose
  .connect(MONGODB_URI)
  .then((result) => {
    app.listen(8080);
  })
  .catch((err) => {
    console.log(err);
  });
