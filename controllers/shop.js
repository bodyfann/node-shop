const fs = require("fs");
const path = require("path");
const stripe = require("stripe")("sk_test_l1o4f7qUKtV1bZyaUwElrI4O");
const axios = require("axios");

const PDFDocument = require("pdfkit");

const Product = require("../models/product");
const Order = require("../models/order");

const ITEMS_PER_PAGE = 2;

exports.getProductsPage = (req, res, next) => {
  const page = +req.query.page || 1;
  let totalItems;

  Product.find()
    .countDocuments()
    .then((numProducts) => {
      totalItems = numProducts;
      return Product.find()
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);
    })
    .then((products) => {
      res.render("shop/product-list", {
        prods: products,
        pageTitle: "Products",
        path: "/products",
        currentPage: page,
        hasNextPage: ITEMS_PER_PAGE * page < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE),
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getProductDetailsPage = (req, res, next) => {
  const prodId = req.params.productId;

  Product.findById(prodId)
    .then((product) => {
      res.render("shop/product-detail", {
        product: product,
        pageTitle: product.title,
        path: "/products",
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getIndexPage = (req, res, next) => {
  const page = +req.query.page || 1;
  let totalItems;

  Product.find()
    .countDocuments()
    .then((numProducts) => {
      totalItems = numProducts;
      return Product.find()
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);
    })
    .then((products) => {
      res.render("shop/index", {
        prods: products,
        pageTitle: "Shop",
        path: "/",
        currentPage: page,
        hasNextPage: ITEMS_PER_PAGE * page < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE),
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCartPage = (req, res, next) => {
  req.user
    .populate("cart.items.productId")
    .execPopulate()
    .then((user) => {
      const products = user.cart.items;
      res.render("shop/cart", {
        pageTitle: "Your Cart",
        path: "/cart",
        products: products,
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;

  Product.findById(prodId)
    .then((product) => {
      return req.user.addToCart(product);
    })
    .then((result) => {
      res.redirect("/cart");
    });
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user
    .removeFromCart(prodId)
    .then((result) => {
      res.redirect("/cart");
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCheckoutPage = (req, res, next) => {
  let products;
  let total = 0;
  req.user
    .populate("cart.items.productId")
    .execPopulate()
    .then((user) => {
      products = user.cart.items;
      total = 0;
      if (products.length == 0) {
        throw new Error("Shopping Cart is empty!");
      }
      products.forEach((p) => {
        total += p.quantity * p.productId.price;
      });
      total = total.toFixed(2);
      return stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: products.map((p) => {
          return {
            name: p.productId.title,
            description: p.productId.description,
            amount: Math.round(p.productId.price * 100),
            currency: "usd",
            quantity: p.quantity,
          };
        }),
        success_url:
          req.protocol +
          "://" +
          req.get("host") +
          "/checkout/success/stripe?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: req.protocol + "://" + req.get("host") + "/checkout/cancel",
      });
    })
    .then((session) => {
      res.render("shop/checkout", {
        pageTitle: "Checkout",
        path: "/checkout",
        products: products,
        totalSum: total,
        sessionId: session.id,
        csrf: req.body._csrf,
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.checkoutSuccess = async (req, res, next) => {
  const method = req.params.method;
  let orderId;

  if (method == "stripe") {
    const session = await stripe.checkout.sessions.retrieve(
      req.query.session_id
    );
    //const customer = await stripe.customers.retrieve(session.customer);
    orderId = session.payment_intent;
  }
  if (method == "paypal") {
    const body = JSON.parse(req.body.toString());
    orderId = body.orderID;
  }

  req.user
    .populate("cart.items.productId")
    .execPopulate()
    .then((user) => {
      const products = user.cart.items.map((i) => {
        return { quantity: i.quantity, product: { ...i.productId._doc } };
      });
      if (products.length == 0) {
        throw new Error("Shopping Cart is empty!");
      }

      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user,
        },
        products: products,
        status: "PENDING",
        processorOrderId: orderId,
      });
      return order.save();
    })
    .then((result) => {
      return req.user.clearCart();
    })
    .then(() => {
      res.redirect("/orders");
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getOrdersPage = (req, res, next) => {
  Order.find({ "user.userId": req.user._id })
    .then((orders) => {
      res.render("shop/orders", {
        pageTitle: "Your Orders",
        path: "/orders",
        orders: orders,
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getInvoice = (req, res, next) => {
  const orderId = req.params.orderId;
  Order.findById(orderId)
    .then((order) => {
      if (!order) {
        return next(new Error("No order found!"));
      }
      if (order.user.userId.toString() !== req.user._id.toString()) {
        return next(new Error("Unauthorized!"));
      }
      const invoiceName = "invoice-" + orderId + ".pdf";
      const invoicePath = path.join("data", "invoices", invoiceName);

      const pdfDoc = new PDFDocument();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        'inline; filename="' + invoiceName + '"'
      );
      pdfDoc.pipe(fs.createWriteStream(invoicePath));
      pdfDoc.pipe(res);

      pdfDoc.fontSize(26).text("Invoice", { underline: true });
      pdfDoc.text(" ");
      let totalPrice = 0;
      order.products.forEach((prod) => {
        totalPrice += prod.quantity * prod.product.price;
        pdfDoc
          .fontSize(14)
          .text(
            prod.product.title +
              " - " +
              prod.quantity +
              " x " +
              "$" +
              prod.product.price
          );
      });
      pdfDoc.text("---");
      pdfDoc.fontSize(18).text("Total Price: $" + totalPrice.toFixed(2));
      pdfDoc.end();
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postStripeWebhook = (req, res, next) => {
  const payload = req.body;

  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_EP_SECRET;
  let event;

  try {
    event = stripe.webhooks.constructEvent(payload, sig, endpointSecret);
  } catch (err) {
    console.log(err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the checkout.session.completed event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = session.payment_intent;

    Order.findOne({
      processorOrderId: orderId,
    })
      .then((order) => {
        if (order !== null) {
          order.status = "COMPLETED";
          order.save();

          res.status(200).json({
            verification_status: "SUCCESS",
          });
        } else {
          // Handles race condition where the webhook arrives before the order is created.
          // 404 forces Stripe to send the webhook again.
          // Consider refactoring creating the order from the webhook.
          console.log("Order not found.");
          res.status(404).json({
            verification_status: "SUCCESS, BUT ORDER NOT READY",
          });
        }
      })
      .catch((err) => {
        console.log(err);
      });
  }
};

exports.postPaypalWebhook = (req, res, next) => {
  // Get access token
  (async () => {
    try {
      const {
        data: { access_token },
      } = await axios({
        url: "https://api.sandbox.paypal.com/v1/oauth2/token",
        method: "post",
        headers: {
          Accept: "application/json",
          "Accept-Language": "en_US",
          "content-type": "application/x-www-form-urlencoded",
        },
        auth: {
          username: process.env.PP_CLIENT_ID,
          password: process.env.PP_CLIENT_SECRET,
        },
        params: {
          grant_type: "client_credentials",
        },
      });

      return access_token;
    } catch (err) {
      console.log("Error getting access token from PayPal: " + err);
    }
  })().then((token) => {
    // Validate webhook
    // Thanks to Randy for the suggestion here: https://github.com/paypal/PayPal-node-SDK/issues/294
    (async () => {
      try {
        const webhookObjJSON = {
          auth_algo: req.header("PAYPAL-AUTH-ALGO"),
          cert_url: req.header("PAYPAL-CERT-URL"),
          transmission_id: req.header("PAYPAL-TRANSMISSION-ID"),
          transmission_sig: req.header("PAYPAL-TRANSMISSION-SIG"),
          transmission_time: req.header("PAYPAL-TRANSMISSION-TIME"),
          webhook_id: "89X68905BB630824P",
          //webhook_id: "6W93031242660823D",
          webhook_event: JSON.parse(req.body.toString()),
        };

        const ppres = await axios({
          url:
            "https://api.sandbox.paypal.com/v1/notifications/verify-webhook-signature",
          method: "post",
          headers: {
            Authorization: "Bearer " + token,
            "content-type": "application/json",
          },
          data: webhookObjJSON,
        });
        //console.log(ppres);
        return ppres.data;
      } catch (err) {
        console.log("Error getting access token from PayPal: " + err);
      }
    })()
      .then((ppres) => {
        if (ppres.verification_status === "SUCCESS") {
          //Handle the PAYMENT.CAPTURE.COMPLETED" event
          const eventBody = JSON.parse(req.body.toString());

          if (eventBody.event_type === "PAYMENT.CAPTURE.COMPLETED") {
            //Get order ID from resource->links->up
            const links = eventBody.resource.links;
            const upLink = links.find((obj) => {
              return obj.rel === "up";
            });
            const orderId = upLink.href.match(/\/orders\/(.*)/)[1];

            Order.findOne({
              processorOrderId: orderId,
            })
              .then((order) => {
                if (order !== null) {
                  order.status = "COMPLETED";
                  order.save();
                } else {
                  // Throw error to generate a 500 and have PayPal to retry the webhook later.
                  // This should prevent race conditions where the webhook arrives before the order is created.
                  // Consider refactoring creating the order from the webhook.
                  throw new Error("Order not found");
                }
              })
              .catch((err) => {
                console.log(err);
              });
          }
          console.log("Validation succeeded.");
          res.status(200).json({
            verification_status: "SUCCESS",
          });
        } else {
          console.log("Validation failed.");
          res.status(400).json({
            verification_status: "FAILURE",
          });
        }
      })
      .catch((err) => {
        console.log(err);
        res.status(500).json({
          verification_status: "AN ERROR OCCURRED",
        });
      });
  });
};
