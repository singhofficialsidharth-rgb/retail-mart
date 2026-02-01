const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

// middleware
app.use(cors());
app.use(express.json());

// test route
app.get("/", (req, res) => {
  res.send("Server running...");
});

// connect DB
const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/retail-shop";
mongoose.connect(mongoUri)
.then(() => console.log("MongoDB connected"))
.catch(err => console.log(err));

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const authRoutes = require("./routes/auth");

app.use("/api/auth", authRoutes);
app.use("/api/wishlist", require("./routes/wishlist"));
app.use("/api/cart", require("./routes/cart"));

