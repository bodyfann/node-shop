const express = require("express");
const { check, body } = require("express-validator");

const authController = require("../controllers/auth");

const User = require("../models/user");

const router = express.Router();

router.get("/login", authController.getLoginPage);

router.get("/signup", authController.getSignupPage);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Please enter a valid email.").trim(),
    body("password", "Please enter a valid password.")
      .isLength({ min: 5 })
      .isAlphanumeric()
      .trim(),
  ],
  authController.postLogin
);

router.post(
  "/signup",
  [
    check("email")
      .isEmail()
      .withMessage("Please enter a valid email.")
      .custom((value, { req }) => {
        return User.findOne({ email: value })
          .then((userDoc) => {
            if (userDoc) {
              return Promise.reject(
                "Email address already exists, please pick a different one."
              );
            }
          })
          .catch((err) => {
            //console.log(err);
            if (err.code === "ERR_ENTITY_NOT_FOUND") {
              return Promise.resolve;
            }
            return Promise.reject(err);
          });
      }),
    body(
      "password",
      "Please enter a password with only numbers and text and at least 5 characters"
    )
      .isLength({ min: 5 })
      .isAlphanumeric()
      .trim(),
    body("confirmPassword")
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error("Passwords have to match!");
        }
        return true;
      })
      .trim(),
  ],
  authController.postSignup
);

router.post("/logout", authController.postLogout);

router.get("/reset", authController.getResetPage);

router.post("/reset", authController.postReset);

router.get("/reset/:token", authController.getNewPasswordPage);

router.post("/new-password", authController.postNewPassword);

module.exports = router;
