const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  email: {
    type: String,
    unique: true
  },
  password: String,
  wishlist: [
    {
      productId: String,
      name: String,
      price: Number,
      img: String
    }
  ],
  cart: [
    {
      productId: String,
      name: String,
      price: Number,
      img: String,
      quantity: Number
    }
  ]
});

module.exports = mongoose.model("User", userSchema);

wishlist: [
  {
    productId: String,
    name: String,
    price: Number,
    img: String
  }
]
