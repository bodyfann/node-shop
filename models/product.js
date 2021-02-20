const { instances } = require("gstore-node");

//Retrieve the gstore instance
const gstore = instances.get("node-shop");
const { Schema } = gstore;

const productSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  price: {
    type: Schema.Types.Double,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  imageUrl: {
    type: String,
    required: true,
  },
  userId: {
    type: String,
    required: true,
  },
  // To be changed after we create User
  // userId: {
  //   type: Schema.Types.Key,
  //   ref: "User",
  //   required: true,
  // },
});

module.exports = gstore.model("Product", productSchema);
