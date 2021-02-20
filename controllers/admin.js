const mongoose = require("mongoose");
const fileHelper = require("../util/file");

const { Storage } = require("@google-cloud/storage");

const { validationResult } = require("express-validator");

const { Datastore } = require("@google-cloud/datastore");
const datastore = new Datastore();
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
    price: parseFloat(price),
    description: description,
    imageUrl: imageUrl,
    userId: req.user[datastore.KEY].id.toString(),
  });

  product
    .save()
    .then((result) => {
      console.log("Product Created");
      res.redirect("/admin/products");
    })
    .catch((err) => {
      console.log(err);
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
  const prodId = parseInt(req.params.productId);

  Product.get(prodId)
    .then((entity) => {
      const product = entity.entityData;
      if (!product) {
        return res.redirect("/");
      }
      product.id = prodId;
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
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postEditProduct = (req, res, next) => {
  const prodId = parseInt(req.body.productId);
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
        id: prodId,
      },
      validationErrors: errors.array(),
    });
  }

  let productPostData = {};
  Product.get(prodId)
    .then((entity) => {
      const product = entity.entityData;
      const currUser = req.user[datastore.KEY].id.toString();
      if (product.userId.toString() !== currUser) {
        return res.redirect("/");
      }
      productPostData.id = prodId;
      productPostData.title = updatedTitle;
      productPostData.price = parseFloat(updatedPrice);
      productPostData.description = updatedDesc;
      productPostData.userId = currUser;
      if (image) {
        // Delete older image
        const olderImage = product.imageUrl.match(/appspot.com\/(.*)/)[1];
        fileHelper.deleteImage(storage, bucket.name, olderImage);
        // Upload new image
        const fileName = new Date().toISOString() + "-" + req.file.originalname;
        const blob = bucket.file(fileName);
        fileHelper.uploadImage(req.file, blob);

        const imageUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
        productPostData.imageUrl = imageUrl;
      }

      return Product.update(prodId, productPostData).then((result) => {
        console.log("Product Updated");
        res.redirect("/admin/products");
      });
    })
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getProductsPage = (req, res, next) => {
  Product.list()
    .then((result) => {
      const products = result.entities;
      res.render("admin/products", {
        prods: products,
        pageTitle: "Admin Products",
        path: "/admin/products",
      });
    })
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.deleteProduct = (req, res, next) => {
  const prodId = parseInt(req.params.productId);

  Product.get(prodId)
    .then((entity) => {
      const product = entity.entityData;
      if (!product) {
        return next(new Error("Product not found!"));
      }
      const olderImage = product.imageUrl.match(/appspot.com\/(.*)/)[1];
      fileHelper.deleteImage(storage, bucket.name, olderImage);
      return Product.delete(prodId);
    })
    .then((result) => {
      console.log("Product Deleted");
      res.status(200).json({
        message: "Success",
      });
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({
        message: "Deleting product failed!",
      });
    });
};
