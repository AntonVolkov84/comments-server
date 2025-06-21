const pool = require("../utils/database");
const WebSocket = require("ws");

const likePost = async (req, res, wss) => {
  const { postId, userId } = req.body;
  if (!postId || !userId) {
    return res.status(400).json({ error: "postId is required" });
  }
  try {
    const likeCheck = await pool.query("SELECT 1 FROM post_likes WHERE user_id = $1 AND post_id = $2", [
      userId,
      postId,
    ]);
    if (likeCheck.rows.length > 0) {
      return res.status(400).json({ error: "User has already liked this post" });
    }
    await pool.query("INSERT INTO post_likes (user_id, post_id) VALUES ($1, $2)", [userId, postId]);
    await pool.query("UPDATE posts SET likescount = likescount + 1 WHERE id = $1", [postId]);
    const result = await pool.query(
      `
      SELECT 
        posts.id,
        posts.user_id,
        posts.text,
        posts.likescount,
        posts.created_at,
        users.username,
        users.avatar_url,
        users.homepage,
        users.email
      FROM posts
      JOIN users ON posts.user_id = users.id
      WHERE posts.id = $1
    `,
      [postId]
    );
    const updatedPost = result.rows[0];
    if (!updatedPost) {
      return res.status(404).json({ error: "Post not found" });
    }
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: "like_updated",
            data: updatedPost,
          })
        );
      }
    });
    res.status(200).json(updatedPost);
  } catch (error) {
    console.error("likePost error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

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
        users.username,
        users.avatar_url,
        users.homepage,
        users.email
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
    const userResult = await pool.query(`SELECT username, avatar_url, email, homepage FROM users WHERE id = $1`, [
      user_id,
    ]);
    const user = userResult.rows[0];

    const fullPost = {
      ...insertedPost,
      username: user.username,
      avatar_url: user.avatar_url,
      homepage: user.homepage || null,
      email: user.email,
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
      ALTER TABLE post_likes
        DROP CONSTRAINT IF EXISTS post_likes_pkey;

      ALTER TABLE post_likes
        ADD PRIMARY KEY (user_id, post_id);

      ALTER TABLE post_likes
        ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id),
        ADD CONSTRAINT fk_post FOREIGN KEY (post_id) REFERENCES posts(id);
    `);
    res.status(200).json({ message: "post_likes keys altered successfully" });
  } catch (error) {
    console.error("Error altering post_likes keys:", error.message);
    res.status(500).json({ error: "Failed to alter post_likes keys" });
  }
};

module.exports = {
  getUserId,
  createPost,
  changeType,
  getPosts,
  likePost,
};
