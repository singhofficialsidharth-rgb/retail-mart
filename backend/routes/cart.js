const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

// GET cart
router.get("/", auth, async (req, res) => {
  try {
    const user = req.user;

    // safety init
    if (!user.cart) user.cart = [];

    res.json(user.cart);
  } catch (err) {
    console.error("Cart GET error:", err.message);
    res.status(500).json({ message: "Failed to fetch cart" });
  }
});

// ADD to cart
router.post("/add", auth, async (req, res) => {
  try {
    const { productId, name, price, img, quantity = 1 } = req.body;

    const user = req.user;

    if (!user.cart) user.cart = [];

    const existing = user.cart.find(
      p => p.productId === productId
    );

    if (existing) {
      existing.quantity += quantity;
    } else {
      user.cart.push({ productId, name, price, img, quantity });
    }

    await user.save();

    res.json(user.cart);
  } catch (err) {
    console.error("Cart ADD error:", err.message);
    res.status(500).json({ message: "Failed to add to cart" });
  }
});

// UPDATE quantity in cart
router.put("/update/:id", auth, async (req, res) => {
  try {
    const { quantity } = req.body;
    const productId = req.params.id;

    const user = req.user;

    if (!user.cart) user.cart = [];

    const item = user.cart.find(
      p => p.productId === productId
    );

    if (!item) {
      return res.status(404).json({ message: "Item not in cart" });
    }

    item.quantity = quantity;

    await user.save();

    res.json(user.cart);
  } catch (err) {
    console.error("Cart UPDATE error:", err.message);
    res.status(500).json({ message: "Failed to update cart" });
  }
});

// REMOVE from cart
router.delete("/:id", auth, async (req, res) => {
  try {
    const user = req.user;

    if (!user.cart) user.cart = [];

    user.cart = user.cart.filter(
      p => p.productId !== req.params.id
    );

    await user.save();

    res.json(user.cart);
  } catch (err) {
    console.error("Cart DELETE error:", err.message);
    res.status(500).json({ message: "Failed to remove from cart" });
  }
});

// CLEAR cart
router.delete("/", auth, async (req, res) => {
  try {
    const user = req.user;

    user.cart = [];

    await user.save();

    res.json(user.cart);
  } catch (err) {
    console.error("Cart CLEAR error:", err.message);
    res.status(500).json({ message: "Failed to clear cart" });
  }
});

module.exports = router;
