const pool = require("../utils/database");
const WebSocket = require("ws");

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

const getPosts = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        posts.id,
        posts.user_id,
        posts.text,
        posts.likescount,
        posts.created_at,
        users.nickname,
        users.avatar_url,
        users.homepage
      FROM posts
      JOIN users ON posts.user_id = users.id
      ORDER BY posts.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("DB fetch posts error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const createPost = async (req, res, wss) => {
  const { user_id, text } = req.body;
  if (!user_id || !text) {
    return res.status(400).json({ error: "user_id and text are required" });
  }

  try {
    const insertResult = await pool.query(
      `INSERT INTO posts (user_id, text, likescount)
       VALUES ($1, $2, 0)
       RETURNING *`,
      [user_id, text]
    );

    const insertedPost = insertResult.rows[0];
    const userResult = await pool.query(`SELECT nickname, avatar_url, homepage FROM users WHERE id = $1`, [user_id]);
    const user = userResult.rows[0];

    const fullPost = {
      ...insertedPost,
      nickname: user.nickname,
      avatar_url: user.avatar_url,
      homepage: user.homepage || null,
    };
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "new_post", data: fullPost }));
      }
    });
    res.status(201).json(fullPost);
  } catch (error) {
    console.error("DB insert error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

const changeType = async (req, res) => {
  try {
    await pool.query(`
      ALTER TABLE posts
      ALTER COLUMN created_at TYPE TIMESTAMP USING created_at::timestamp,
      ALTER COLUMN created_at SET DEFAULT NOW()
    `);
    res.status(200).json({ message: "Column created_at altered successfully" });
  } catch (error) {
    console.error("Error altering column:", error.message);
    res.status(500).json({ error: "Failed to alter column" });
  }
};

module.exports = {
  getUserId,
  createPost,
  changeType,
  getPosts,
};
