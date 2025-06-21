module.exports = (wss) => {
  wss.on("connection", (ws) => {
    console.log("New WebSocket connection");
    ws.on("message", (message) => {
      console.log("Received:", message);
      let parsedMessage;
      try {
        parsedMessage = JSON.parse(message);
      } catch (e) {
        console.log("Message is not JSON");
        return;
      }
      const broadcastMessage = JSON.stringify({
        type: "new_post",
        data: parsedMessage,
      });
      wss.clients.forEach((client) => {
        if (client.readyState === ws.OPEN) {
          client.send(broadcastMessage);
        }
      });
    });
    ws.on("close", () => {
      console.log("WebSocket disconnected");
    });
  });
};
