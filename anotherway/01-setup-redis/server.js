const redis = require("redis");

const client = redis.createClient({
  host: "localhost",
  port: 6379,
});

client.on("error", (error) =>
  console.log("Redis client error occured!", error),
);

async function testRedisConnection() {
  try {
    await client.connect();
    console.log("Connected to Redis");

    await client.set("name", "sachin");

    const extractValue = await client.get("name");

    console.log("Extracted value:", extractValue);

    const deleteCount = await client.del("name");
    console.log("Deleted count:", deleteCount);

    const extractUpdatedValue = await client.get("name");
    console.log("updaetd value:", extractUpdatedValue);

    await client.set("count", "100");

    const incremnentCount = await client.incr("count");
    console.log(incremnentCount);

    const decrementCount = await client.decr("count");
    console.log(decrementCount);
  } catch (error) {
    console.log(error);
  } finally {
    await client.quit();
  }
}

testRedisConnection();
