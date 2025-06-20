const pool = require("../utils/database");
exports.updateAvatarUrl = async (req, res) => {
  const { email, avatar_url } = req.body;
  console.log("avatar", req.body);
  if (!email || !avatar_url) {
    return res.status(400).json({ error: "Email and avatar_url are required" });
  }

  try {
    const result = await pool.query("UPDATE users SET avatar_url = $1 WHERE email = $2 RETURNING *;", [
      avatar_url,
      email,
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ message: "Avatar updated", user: result.rows[0] });
  } catch (error) {
    console.error("Error updating avatar_url:", error.message);
    res.status(500).json({ error: "Internal server error", error });
  }
};
