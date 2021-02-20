const express = require("express");
const { body } = require("express-validator");

const adminController = require("../controllers/admin");
const isAuth = require("../middleware/is-auth");

const router = express.Router();

router.get("/add-product", isAuth, adminController.getAddProductPage);

router.get("/products", isAuth, adminController.getProductsPage);

router.post(
  "/add-product",
  [
    body("title", "Please enter a title.").isLength({ min: 3 }).trim(),
    body("price", "Please enter a valid amount.").isFloat().not().isEmpty(),
    body(
      "description",
      "Please enter a description between 5 and 400 characters."
    )
      .isLength({ min: 5, max: 400 })
      .trim(),
  ],
  isAuth,
  adminController.postAddProduct
);

router.get(
  "/edit-product/:productId",
  isAuth,
  adminController.getEditProductPage
);

router.post(
  "/edit-product",
  [
    body("title", "Please enter a title.").isLength({ min: 3 }).trim(),
    body("price", "Please enter a valid amount.").isFloat().not().isEmpty(),
    body(
      "description",
      "Please enter a description between 5 and 400 characters."
    )
      .isLength({ min: 5, max: 400 })
      .trim(),
  ],
  isAuth,
  adminController.postEditProduct
);

router.delete("/product/:productId", isAuth, adminController.deleteProduct);

module.exports = router;
