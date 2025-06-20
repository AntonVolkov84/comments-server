module.exports = (wss) => {
  wss.on("connection", (ws) => {
    console.log("New WebSocket connection");

    ws.on("message", (message) => {
      console.log("Received:", message);

      wss.clients.forEach((client) => {
        if (client.readyState === ws.OPEN) {
          client.send(`Echo: ${message}`);
        }
      });
    });

    ws.on("close", () => {
      console.log("WebSocket disconnected");
    });
  });
};
