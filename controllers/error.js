exports.get404Page = (req, res, next) => {
  res.status(404).render("404", {
    pageTitle: "Page Not Found!!!",
    path: "/404",
    isAuthenticated: req.session.isLoggedIn,
  });
};

exports.get500Page = (req, res, next) => {
  let message = req.flash("error");
  if (message.length > 0) {
    message = message[0];
  } else {
    message = null;
  }
  res.status(500).render("500", {
    pageTitle: "Internal Error!!!",
    path: "/500",
    isAuthenticated: req.session.isLoggedIn,
    errorMessage: message,
  });
};
