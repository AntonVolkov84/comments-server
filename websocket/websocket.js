const WebSocket = require("ws");
const postSubscriptions = new Map();

module.exports = (wss) => {
  wss.on("connection", (ws) => {
    console.log("New WebSocket connection");
    ws.subscribedPosts = new Set();
    ws.on("message", (message) => {
      let parsedMessage;
      try {
        parsedMessage = JSON.parse(message);
      } catch (e) {
        console.log("Message is not JSON");
        return;
      }
      if (parsedMessage.type === "subscribe_comments") {
        const postId = parsedMessage.post_id;
        if (!postId) return;
        if (!postSubscriptions.has(postId)) {
          postSubscriptions.set(postId, new Set());
        }
        postSubscriptions.get(postId).add(ws);
        ws.subscribedPosts.add(postId);
        console.log(`Client subscribed to comments for post ${postId}`);
      }
      if (parsedMessage.type === "unsubscribe_comments") {
        const postId = parsedMessage.post_id;
        if (!postId) return;

        if (postSubscriptions.has(postId)) {
          postSubscriptions.get(postId).delete(ws);
          ws.subscribedPosts.delete(postId);
          console.log(`Client unsubscribed from comments for post ${postId}`);
        }
      }
    });
    ws.on("close", () => {
      ws.subscribedPosts.forEach((postId) => {
        if (postSubscriptions.has(postId)) {
          postSubscriptions.get(postId).delete(ws);
          if (postSubscriptions.get(postId).size === 0) {
            postSubscriptions.delete(postId);
          }
        }
      });
      console.log("WebSocket disconnected and subscriptions cleared");
    });
  });
  wss.broadcastNewComment = (comment) => {
    const postId = comment.post_id;
    const clients = postSubscriptions.get(postId);
    if (!clients) return;
    const message = JSON.stringify({
      type: "new_comment",
      data: comment,
    });
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };
};
