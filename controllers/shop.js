const fs = require("fs");
const path = require("path");
const stripe = require("stripe")("sk_test_l1o4f7qUKtV1bZyaUwElrI4O");
const axios = require("axios");

const PDFDocument = require("pdfkit");

const Product = require("../models/product");
const Order = require("../models/order");
const User = require("../models/user");

const { Datastore } = require("@google-cloud/datastore");
const order = require("../models/order");
const datastore = new Datastore();

const ITEMS_PER_PAGE = 2;

exports.getProductsPage = (req, res, next) => {
  const page = +req.query.page || 1;
  let totalItems;

  Product.list()
    .then((result) => {
      totalItems = result.entities.length;
      return Product.list({
        offset: (page - 1) * ITEMS_PER_PAGE,
        limit: ITEMS_PER_PAGE,
      });
    })
    .then((result) => {
      const products = result.entities;
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
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getProductDetailsPage = (req, res, next) => {
  const prodId = parseInt(req.params.productId);

  Product.get(prodId)
    .then((entity) => {
      const product = entity.entityData;
      product.id = prodId;
      res.render("shop/product-detail", {
        product: product,
        pageTitle: product.title,
        path: "/products",
      });
    })
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getIndexPage = (req, res, next) => {
  const page = +req.query.page || 1;
  let totalItems;

  Product.list()
    .then((result) => {
      totalItems = result.entities.length;
      return Product.list({
        offset: (page - 1) * ITEMS_PER_PAGE,
        limit: ITEMS_PER_PAGE,
      });
    })
    .then((result) => {
      const products = result.entities;
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
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCartPage = async (req, res, next) => {
  let errorMessage = "";
  // Get products
  const products = [];
  for (const item of req.user.cart.items) {
    let product = {};
    await Product.get(item.productId)
      .then((entity) => {
        const p = entity.entityData;
        p.id = item.productId;
        product = {
          quantity: item.quantity,
          product: { ...p },
        };
        return product;
      })
      .then((product) => {
        products.push(product);
      })
      .catch((err) => {
        console.log(err);
        if (err.code === "ERR_ENTITY_NOT_FOUND") {
          errorMessage =
            "Some items are not anymore available and have been removed from your cart!";
          // Delete items from cart
          const userId = parseInt(req.user[datastore.KEY].id);
          console.log("Deleting product " + item.productId + " from cart");
          User.get(userId)
            .then((user) => {
              user.removeFromCart(item.productId);
            })
            .catch((err) => {
              console.log(err);
            });
        }
      });
  }
  res.render("shop/cart", {
    pageTitle: "Your Cart",
    path: "/cart",
    errorMessage: errorMessage,
    products: products,
  });
};

exports.postCart = (req, res, next) => {
  const prodId = parseInt(req.body.productId);
  const userId = parseInt(req.user[datastore.KEY].id);

  User.get(userId)
    .then(async (user) => {
      await user.addToCart(prodId);
    })
    .then((result) => {
      res.redirect("/cart");
    })
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  const userId = parseInt(req.user[datastore.KEY].id);

  User.get(userId)
    .then(async (user) => {
      await user.removeFromCart(prodId);
    })
    .then((result) => {
      res.redirect("/cart");
    })
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCheckoutPage = (req, res, next) => {
  const userId = parseInt(req.user[datastore.KEY].id);
  let total = 0;
  const products = [];
  User.get(userId)
    .then(async (user) => {
      // Get Products
      for (const item of req.user.cart.items) {
        let product = {};
        await Product.get(item.productId)
          .then((entity) => {
            const p = entity.entityData;
            p.id = item.productId;
            product = {
              quantity: item.quantity,
              product: { ...p },
            };
            return product;
          })
          .then((product) => {
            products.push(product);
          })
          .catch((err) => {
            console.log(err);
          });
      }
      total = 0;
      if (products.length == 0) {
        throw new Error("Shopping Cart is empty!");
      }
      products.forEach((p) => {
        total += p.quantity * p.product.price;
      });
      total = total.toFixed(2);

      return stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        client_reference_id: userId,
        line_items: products.map((p) => {
          return {
            name: p.product.title,
            description: p.product.description,
            amount: Math.round(p.product.price * 100),
            currency: "eur",
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

  const currUser = parseInt(req.user[datastore.KEY].id);

  User.get(currUser)
    .then((user) => {
      const products = user.cart.items;
      if (products.length == 0) {
        throw new Error("Shopping Cart is empty!");
      }

      // Create Order
      const order = new Order({
        products: products,
        userId: currUser,
        processorOrderId: orderId,
        status: "PENDING",
      });

      return order.save();
    })
    .then((result) => {
      console.log("Order Created");
      User.get(currUser).then((user) => {
        return user.clearCart();
      });
    })
    .then(() => {
      res.redirect("/orders");
    })
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getOrdersPage = async (req, res, next) => {
  const currUser = parseInt(req.user[datastore.KEY].id);

  let ordersJSON = []; // Array of order objects to pass to the view
  // Get all orders for current user
  Order.list({ filters: ["userId", currUser] })
    .then(async (result) => {
      const orders = result.entities;
      // For each order get the products details
      for (const order of orders) {
        let orderJSON = {};
        let productsArray = [];
        for (const product of order.products) {
          let productId = parseInt(product.productId);
          let p = {
            quantity: product.quantity,
            product: {},
          };
          p.product = await Product.get(productId);
          productsArray.push(p);
        }
        orderJSON["products"] = productsArray;
        orderJSON["id"] = order.id;
        orderJSON["status"] = order.status;
        ordersJSON.push(orderJSON);
      }
    })
    .then((result) => {
      res.render("shop/orders", {
        pageTitle: "Your Orders",
        path: "/orders",
        orders: ordersJSON,
      });
    })
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getInvoice = async (req, res, next) => {
  const currUser = parseInt(req.user[datastore.KEY].id);
  const orderId = parseInt(req.params.orderId);

  Order.get(orderId)
    .then(async (result) => {
      let order = result.entityData;

      if (order.userId !== currUser) {
        throw new Error("Unauthorized!");
      }

      let productsArray = [];
      for (product of order.products) {
        let p = {
          quantity: product.quantity,
          product: {},
        };
        p.product = await Product.get(product.productId);
        productsArray.push(p);
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

      productsArray.forEach((prod) => {
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
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postStripeWebhook = async (req, res, next) => {
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
    const processorOrderId = session.payment_intent;

    const orderPostData = {
      status: "COMPLETED",
    };
    Order.findOne({ processorOrderId: processorOrderId })
      .then((result) => {
        const order = result.entityData;
        const orderId = parseInt(order[datastore.KEY].id);
        return Order.update(orderId, orderPostData).then((result) => {
          console.log("Webhook: Order Updated");
          res.status(200).json({
            verification_status: "SUCCESS",
          });
        });
      })
      .catch((err) => {
        console.log(err);
        res.status(400).json({
          verification_status: "SUCCESS, BUT ORDER NOT READY",
        });
      });
  } else {
    // Received another webhook we don't care about
    res.status(200).json({
      verification_status: "SUCCESS",
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
          webhook_id: process.env.PP_WEBHOOK_ID,
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
      .then(async (ppres) => {
        if (ppres.verification_status === "SUCCESS") {
          //Handle the PAYMENT.CAPTURE.COMPLETED" event
          const eventBody = JSON.parse(req.body.toString());
          if (eventBody.event_type === "PAYMENT.CAPTURE.COMPLETED") {
            //Get order ID from resource->links->up
            const links = eventBody.resource.links;
            const upLink = links.find((obj) => {
              return obj.rel === "up";
            });
            const processorOrderId = upLink.href.match(/\/orders\/(.*)/)[1];
            const orderPostData = {
              status: "COMPLETED",
            };
            Order.findOne({ processorOrderId: processorOrderId })
              .then((result) => {
                const order = result.entityData;
                const orderId = parseInt(order[datastore.KEY].id);
                return Order.update(orderId, orderPostData).then((result) => {
                  console.log("Webhook: Order Updated");
                  res.status(200).json({
                    verification_status: "SUCCESS",
                  });
                });
              })
              .catch((err) => {
                console.log(err);
                res.status(400).json({
                  verification_status: "SUCCESS, BUT ORDER NOT READY",
                });
              });
          } else {
            // Received another webhook we don't care about
            res.status(200).json({
              verification_status: "SUCCESS",
            });
          }
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
