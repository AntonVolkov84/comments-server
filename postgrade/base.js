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
const getUser = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("DB error:", error);
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
const getAllUsers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, email, username, avatar_url, created_at, homepage
      FROM users
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("DB fetch users error:", error);
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
const createComment = async (req, res, wss) => {
  const { text, post_id, author_id, photo_uri, file_uri } = req.body;

  if (!text || !post_id || !author_id) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO comments (text, post_id, author_id, created_at, file_uri, photo_uri)
       VALUES ($1, $2, $3, NOW(), $4, $5)
       RETURNING *`,
      [text, post_id, author_id, file_uri || null, photo_uri || null]
    );
    await pool.query(`UPDATE posts SET created_at = NOW() WHERE id = $1`, [post_id]);
    const newComment = result.rows[0];
    const userResult = await pool.query(`SELECT username, avatar_url, homepage, email FROM users WHERE id = $1`, [
      author_id,
    ]);
    const user = userResult.rows[0];
    const enrichedComment = {
      ...newComment,
      username: user.username,
      avatar_url: user.avatar_url,
      homepage: user.homepage,
      email: user.email,
    };
    wss.broadcastNewComment(enrichedComment);
    res.status(201).json(newComment);
  } catch (error) {
    console.error("Ошибка создания комментария:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
const getCommentsByPostId = async (req, res) => {
  const { post_id } = req.body;

  if (!post_id) {
    return res.status(400).json({ error: "post_id is required" });
  }
  try {
    const result = await pool.query(
      `SELECT comments.*, users.username, users.avatar_url, users.email, users.homepage
       FROM comments
       JOIN users ON comments.author_id = users.id
       WHERE post_id = $1
       ORDER BY created_at DESC`,
      [post_id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Ошибка получения комментариев:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
const getAllLinkedLikes = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        user_id,
        post_id
      FROM post_likes
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("DB fetch post_likes error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
const getAllComments = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        post_id,
        author_id,
        text,
        created_at,
        file_uri,
        photo_uri
      FROM comments
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("DB fetch comments error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
const changeType = async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        post_id INTEGER NOT NULL,
        author_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE comments
        DROP CONSTRAINT IF EXISTS fk_comment_post,
        DROP CONSTRAINT IF EXISTS fk_comment_author;

      ALTER TABLE comments
        ADD CONSTRAINT fk_comment_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        ADD CONSTRAINT fk_comment_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE;
    `);

    res.status(200).json({ message: "comments table created/updated successfully" });
  } catch (error) {
    console.error("Error creating comments table:", error.message);
    res.status(500).json({ error: "Failed to create comments table" });
  }
};

module.exports = {
  getUserId,
  createPost,
  changeType,
  getPosts,
  likePost,
  getUser,
  createComment,
  getCommentsByPostId,
  getAllUsers,
  getAllLinkedLikes,
  getAllComments,
};
