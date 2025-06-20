const pool = require("../utils/database");
const User = require("../models/userModel");
exports.addToUsers = async (req, res) => {
  const { email, username, avatar_url } = req.body;

  if (!email || !username) {
    return res.status(400).json({ error: "Required fields missing" });
  }

  try {
    const user = new User(email, username, avatar_url);
    const savedUser = await user.save(pool);
    res.status(201).json(savedUser);
  } catch (error) {
    console.error("Error saving user:", error.message);
    if (error.code === "23505") {
      res.status(409).json({ error: "User with this email already exists" });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
};
