const redis = require("redis");

const client = redis.createClient({
  host: "localhost",
  port: 6379,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries >= 5) {
        return new Error("Max Redis reconnection retries reached");
      }
      // Retry after 1 second.
      return 1000;
    },
  },
});

client.on("error", (error) =>
  console.log("Redis client error occured!", error),
);

async function redisPubSub() {
  // Create a separate client for subscribing.
  // It uses the same connection configuration but opens a new connection.
  const subscriber = client.duplicate();

  try {
    // Connect both Redis clients.
    await client.connect();
    await subscriber.connect();

    console.log("Publisher and Subscriber connected!");

    // SUBSCRIBE: Listen for messages on a specific channel.
    // The callback receives the published message and channel name.
    await subscriber.subscribe("notifications", (message, channel) => {
      console.log(`Received message from ${channel}: ${message}`);
    });

    console.log("Subscribed to notifications channel!");

    // PUBLISH: Send messages to all subscribers of this channel.
    await client.publish("notifications", "Welcome to Redis Pub/Sub!");
    await client.publish("notifications", "Your order has been confirmed!");

    // Allow time for published messages to be received.
    // This delay is only for this demonstration.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // UNSUBSCRIBE: Stop listening to the specified channel.
    await subscriber.unsubscribe("notifications");

    console.log("Unsubscribed from notifications channel!");
  } catch (error) {
    console.log("Redis Pub/Sub error:", error);
    process.exitCode = 1;
  } finally {
    if (subscriber.isOpen) {
      await subscriber.quit();
    }
    if (client.isOpen) {
      await client.quit();
    }
  }
}

redisPubSub();
