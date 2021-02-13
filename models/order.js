const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const orderSchema = new Schema({
  products: [
    {
      product: { type: Object, required: true },
      quantity: { type: Number, required: true },
    },
  ],
  user: {
    email: { type: String, required: true },

    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
  },
  status: { type: String, required: true },
  processorOrderId: { type: String, required: false },
  transactionId: { type: String, required: false },
  refundId: { type: String, required: false },
});

module.exports = mongoose.model("Order", orderSchema);
