require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
const helmet = require("helmet");
const { deleteImageFromCloudinary } = require("./utils/cloudinary");

const app = express();
app.use(cors());
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
app.use(helmet());
app.use(express.json());

app.delete("/delete-image", deleteImageFromCloudinary);

require("./websocket/websocket")(wss);

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
