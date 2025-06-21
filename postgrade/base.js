const pool = require("../utils/database");

const getUserId = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const result = await pool.query("SELECT id FROM users WHERE email = $1", [email]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("DB error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
const createPost = async (req, res) => {
  const { user_id, text } = req.body;

  if (!user_id || !text) {
    return res.status(400).json({ error: "user_id and text are required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO posts (user_id, text, created_at, likescount)
       VALUES ($1, $2, NOW(), 0)
       RETURNING *`,
      [user_id, text]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("DB insert error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  getUserId,
  createPost,
};
