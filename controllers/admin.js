const mongoose = require("mongoose");
const fileHelper = require("../util/file");

const { Storage } = require("@google-cloud/storage");

const { validationResult } = require("express-validator");

const Product = require("../models/product");

// Instantiate a storage client
const storage = new Storage();
const bucket = storage.bucket(process.env.GCLOUD_STORAGE_BUCKET);

exports.getAddProductPage = (req, res, next) => {
  res.render("admin/edit-product", {
    pageTitle: "Add Product",
    path: "admin/add-product",
    editing: false,
    hasError: false,
    errorMessage: null,
    oldInput: {
      title: "",
      price: "",
      description: "",
    },
    validationErrors: [],
  });
};

exports.postAddProduct = (req, res, next) => {
  const title = req.body.title;
  const image = req.file;
  const price = req.body.price;
  const description = req.body.description;

  if (!image) {
    return res.status(422).render("admin/edit-product", {
      path: "admin/add-product",
      pageTitle: "Add Product",
      errorMessage: "Attached file is not an image.",
      editing: false,
      hasError: true,
      product: {
        title: title,
        price: price,
        description: description,
      },
      validationErrors: [],
    });
  }

  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).render("admin/edit-product", {
      path: "admin/add-product",
      pageTitle: "Add Product",
      errorMessage: errors.array()[0].msg,
      editing: false,
      hasError: true,
      product: {
        title: title,
        price: price,
        description: description,
      },
      validationErrors: errors.array(),
    });
  }

  const fileName = new Date().toISOString() + "-" + req.file.originalname;
  const blob = bucket.file(fileName);
  fileHelper.uploadImage(req.file, blob);

  const imageUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;

  const product = new Product({
    title: title,
    price: price,
    description: description,
    imageUrl: imageUrl,
    userId: req.user,
  });

  product
    .save()
    .then((result) => {
      console.log("Product Created");
      res.redirect("/admin/products");
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getEditProductPage = (req, res, next) => {
  const editMode = req.query.edit;
  if (!editMode) {
    return res.redirect("/");
  }
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then((product) => {
      if (!product) {
        return res.redirect("/");
      }
      res.render("admin/edit-product", {
        pageTitle: "Edit Product",
        path: "/admin/edit-product",
        editing: editMode,
        hasError: false,
        errorMessage: null,
        product: product,
        validationErrors: [],
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postEditProduct = (req, res, next) => {
  const prodId = req.body.productId;
  const updatedTitle = req.body.title;
  const updatedPrice = req.body.price;
  const image = req.file;
  const updatedDesc = req.body.description;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(422).render("admin/edit-product", {
      path: "admin/edit-product",
      pageTitle: "Edit Product",
      errorMessage: errors.array()[0].msg,
      editing: true,
      hasError: true,
      product: {
        title: updatedTitle,
        price: updatedPrice,
        description: updatedDesc,
        _id: prodId,
      },
      validationErrors: errors.array(),
    });
  }

  Product.findById(prodId)
    .then((product) => {
      if (product.userId.toString() !== req.user._id.toString()) {
        return res.redirect("/");
      }
      product.title = updatedTitle;
      product.price = updatedPrice;
      product.description = updatedDesc;
      if (image) {
        // Delete older image
        const olderImage = product.imageUrl.match(/appspot.com\/(.*)/)[1];
        fileHelper.deleteImage(storage, bucket.name, olderImage);
        // Upload new image
        const fileName = new Date().toISOString() + "-" + req.file.originalname;
        const blob = bucket.file(fileName);
        fileHelper.uploadImage(req.file, blob);

        const imageUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
        product.imageUrl = imageUrl;
      }
      product.userId = req.user._id;
      return product.save().then((result) => {
        console.log("Product Updated");
        res.redirect("/admin/products");
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getProductsPage = (req, res, next) => {
  Product.find({ userId: req.user._id })
    .then((products) => {
      res.render("admin/products", {
        prods: products,
        pageTitle: "Admin Products",
        path: "/admin/products",
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.deleteProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then((product) => {
      if (!product) {
        return next(new Error("Product not found!"));
      }
      const olderImage = product.imageUrl.match(/appspot.com\/(.*)/)[1];
      console.log(olderImage);
      fileHelper.deleteImage(storage, bucket.name, olderImage);
      return Product.deleteOne({ _id: prodId, userId: req.user._id });
    })
    .then((result) => {
      console.log("Product Destroyed");
      res.status(200).json({
        message: "Success",
      });
    })
    .catch((err) => {
      res.status(500).json({
        message: "Deleting product failed!",
      });
    });
};
