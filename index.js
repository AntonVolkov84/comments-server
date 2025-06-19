require("dotenv").config();
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const helmet = require("helmet");

const app = express();
app.use(helmet()); // базовые заголовки безопасности
app.use(express.json());

// Простой API endpoint для проверки
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// HTTP сервер для WebSocket
const server = http.createServer(app);

// WebSocket сервер
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("New WebSocket connection");

  ws.on("message", (message) => {
    console.log("Received:", message);

    // Пример рассылки всем клиентам
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(`Echo: ${message}`);
      }
    });
  });

  ws.on("close", () => {
    console.log("WebSocket disconnected");
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
