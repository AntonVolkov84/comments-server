class User {
  constructor(email, username, avatar_url = null, homepage = null, created_at = new Date()) {
    this.email = email;
    this.username = username;
    this.avatar_url = avatar_url;
    this.created_at = created_at;
    this.homepage = homepage;
  }

  async save(pool) {
    const query = `
      INSERT INTO users (email, username, avatar_url, homepage, created_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const values = [this.email, this.username, this.avatar_url, this.homepage, this.created_at];
    try {
      const res = await pool.query(query, values);
      return res.rows[0];
    } catch (error) {
      throw error;
    }
  }
}

module.exports = User;
