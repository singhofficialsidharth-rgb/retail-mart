const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");

// GET wishlist
router.get("/", auth, async (req, res) => {
  try {
    const user = req.user;

    // safety init
    if (!user.wishlist) user.wishlist = [];

    res.json(user.wishlist);
  } catch (err) {
    console.error("Wishlist GET error:", err.message);
    res.status(500).json({ message: "Failed to fetch wishlist" });
  }
});

// ADD to wishlist
router.post("/add", auth, async (req, res) => {
  try {
    console.log("Wishlist ADD request body:", req.body);
    const { productId, name, price, img } = req.body;

    const user = req.user;
    console.log("User wishlist before:", user.wishlist);

    if (!user.wishlist) user.wishlist = [];

    const exists = user.wishlist.find(
      p => p.productId === productId
    );
    console.log("Exists check:", exists);

    if (exists) {
      return res.status(400).json({ message: "Already in wishlist" });
    }

    user.wishlist.push({ productId, name, price, img });
    console.log("User wishlist after push:", user.wishlist);
    await user.save();
    console.log("User saved successfully");

    res.json(user.wishlist);
  } catch (err) {
    console.error("Wishlist ADD error:", err.message);
    res.status(500).json({ message: "Failed to add to wishlist" });
  }
});

// REMOVE from wishlist
router.delete("/:id", auth, async (req, res) => {
  try {
    const user = req.user;

    if (!user.wishlist) user.wishlist = [];

    user.wishlist = user.wishlist.filter(
      p => p.productId !== req.params.id
    );

    await user.save();

    res.json(user.wishlist);
  } catch (err) {
    console.error("Wishlist DELETE error:", err.message);
    res.status(500).json({ message: "Failed to remove from wishlist" });
  }
});

module.exports = router;
