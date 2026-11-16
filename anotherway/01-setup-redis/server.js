const redis = require("redis");

const client = redis.createClient({
  host: "localhost",
  port: 6379,
  socket: {
    reconnectStrategy: (retries) => {
      // Maximum 5 reconnection attempts.
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

async function testRedisConnection() {
  try {
    await client.connect();
    console.log("Connected to Redis");

    // SET: Store a key-value pair.
    await client.set("name", "sachin");

    // GET: Retrieve the value.
    const extractValue = await client.get("name");
    console.log("Extracted value:", extractValue);

    // DEL: Delete a key.
    const deleteCount = await client.del("name");
    console.log("Deleted count:", deleteCount);

    // GET: Check the deleted key.
    const extractUpdatedValue = await client.get("name");
    console.log("updaetd value:", extractUpdatedValue);

    // Store a numeric value.
    await client.set("count", "100");

    // INCR: Increment the value by 1.
    const incremnentCount = await client.incr("count");
    console.log(incremnentCount);

    // DECR: Decrement the value by 1.
    const decrementCount = await client.decr("count");
    console.log(decrementCount);
  } catch (e) {
    console.error(e);
    // Set the process exit status to 1 to indicate failure.
    // Node.js can still execute pending cleanup operations.
    process.exitCode = 1;
  } finally {
    if (client.isOpen) {
      await client.quit();
    }
  }
}

testRedisConnection();
