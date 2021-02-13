const express = require("express");

const shopController = require("../controllers/shop");
const isAuth = require("../middleware/is-auth");

const router = express.Router();

router.get("/", shopController.getIndexPage);

router.get("/products", shopController.getProductsPage);

router.get("/products/:productId", shopController.getProductDetailsPage);

router.get("/cart", isAuth, shopController.getCartPage);

router.post("/cart", isAuth, shopController.postCart);

router.post("/cart-delete-item", isAuth, shopController.postCartDeleteProduct);

router.all(
  "/checkout/success/:method",
  isAuth,
  express.raw({ type: "application/json" }),
  shopController.checkoutSuccess
);

router.get("/checkout/cancel", isAuth, shopController.postCheckoutPage);

router.post("/checkout", isAuth, shopController.postCheckoutPage);

router.get("/orders", isAuth, shopController.getOrdersPage);

router.get("/orders/:orderId", isAuth, shopController.getInvoice);

module.exports = router;
