class User {
  constructor(email, username, avatar_url, created_at = new Date()) {
    this.email = email;
    this.username = username;
    this.avatar_url = avatar_url;
    this.created_at = created_at;
  }

  async save(pool) {
    const query = `
      INSERT INTO users (email, username, avatar_url, created_at)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const values = [this.email, this.username, this.avatar_url, this.created_at];
    try {
      const res = await pool.query(query, values);
      return res.rows[0];
    } catch (error) {
      throw error;
    }
  }
}

module.exports = User;
