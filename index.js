require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
const helmet = require("helmet");
const pool = require("./utils/database");
const { deleteImageFromCloudinary } = require("./utils/cloudinary");
const { addToUsers } = require("./postgrade/users");
const { updateAvatarUrl } = require("./postgrade/avatar");
const base = require("./postgrade/base");

const app = express();
app.use(cors());
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
app.use(helmet());
app.use(express.json());

app.delete("/delete-image", deleteImageFromCloudinary);
app.post("/users", addToUsers);
app.put("/users/avatar", updateAvatarUrl);
app.post("/user/by-email", base.getUserId);
app.post("/post/createpost", base.createPost);
app.post("/alter-created-at", base.changeType);

require("./websocket/websocket")(wss);

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
