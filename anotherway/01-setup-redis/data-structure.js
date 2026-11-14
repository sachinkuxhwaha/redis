const redis = require("redis");

const client = redis.createClient({
  host: "localhost",
  port: 6379,
  socket: {
    reconnectStrategy: (retries) => {
      // retries represents the number of reconnection attempts.
      if (retries >= 5) {
        // Stop retrying after 5 attempts.
        return new Error("Max Redis reconnection retries reached");
      }
      // Wait 1 second before the next retry.
      return 1000;
    },
  },
});

client.on("error", (error) =>
  console.log("Redis client error occured!", error),
);

async function redisDataStructure() {
  try {
    await client.connect();
    console.log("Connected to Redis");

    // STRINGS: SET, GET, MSET, MGET

    // SET: Store a single key-value pair.
    await client.set("user:name", "Sachin Kushwaha");

    // GET: Retrieve the value of a key.
    const name = await client.get("user:name");
    // console.log(name);

    // MSET: Store multiple key-value pairs at once.
    await client.mSet([
      "user:email",
      "sachin@gmail.com",
      "user:age",
      "22",
      "user:country",
      "India",
    ]);

    // MGET: Retrieve multiple values using their keys.
    const [email, age, country] = await client.mGet([
      "user:email",
      "user:age",
      "user:country",
    ]);
    console.log("Email:", email, "Age:", age, "Country:", country);

    // LISTS: LPUSH, RPUSH, LRANGE, LPOP, RPOP

    // LPUSH: Add elements to the beginning (left) of a List.
    // Elements are inserted from left to right.
    // Final order: ['note3', 'note2', 'note1']
    await client.lPush("notes", ["note1", "note2", "note3"]);

    // LRANGE: Retrieve elements within a specified index range.
    // 0 = first element, -1 = last element (retrieve all).
    const extractAllNotes = await client.lRange("notes", 0, -1);
    console.log(extractAllNotes);

    // LPOP: Remove and return the first element (left side).
    const firstNote = await client.lPop("notes");
    console.log("Popped note:", firstNote);

    // Retrieve all remaining elements from the List.
    const remainingNotes = await client.lRange("notes", 0, -1);
    console.log("Remaining notes:", remainingNotes);

    // SETS: SADD, SMEMBERS, SISMEMBER, SREM

    // SADD: Add one or more unique members to a Set.
    await client.sAdd("user:nickname", ["john", "peter", "bob"]);

    // SMEMBERS: Retrieve all members of a Set.
    const extractUserNicknames = await client.sMembers("user:nickname");
    console.log("Nicknames:", extractUserNicknames);

    // SISMEMBER: Check whether a member exists in a Set.
    // Returns 1 if present, otherwise 0.
    const isNickname = await client.sIsMember("user:nickname", "john");
    console.log(isNickname);

    // SREM: Remove a member from a Set.
    await client.sRem("user:nickname", "bob");

    // Retrieve all members after deletion.
    const updatedNicknames = await client.sMembers("user:nickname");
    console.log("Updated Nicknames:", updatedNicknames);

    // SORTED SETS: ZADD, ZRANGE, ZRANK, ZREM

    // ZADD: Add members with numeric scores for sorting.
    // Each member has a unique value and an associated score.
    await client.zAdd("cart", [
      {
        score: 100, // Numeric score used for sorting.
        value: "Cart 1", // Unique member stored in the Sorted Set.
      },
      {
        score: 80,
        value: "Cart 2",
      },
      {
        score: 45,
        value: "Cart 3",
      },
    ]);

    // // ZRANGE: Retrieve members in ascending score order.
    const getTopEle = await client.zRange("cart", 0, -1);
    console.log(getTopEle);

    // // ZRANGE WITH SCORES: Retrieve members along with their scores.
    const extractCartWithScore = await client.zRangeWithScores("cart", 0, -1);
    console.log(extractCartWithScore);

    // // ZRANK: Get a member's rank (zero-based indexing).
    // // 0 = first, 1 = second, 2 = third.
    const cartRank = await client.zRank("cart", "Cart 2");
    console.log(cartRank);

    // Hashes - hSet, hGet, hMSet, hMGet, hGetAll, hDel
    await client.hSet("product:101", {
      name: "Wireless Headphones",
      description: "Bluetooth headphones with noise cancellation",
      price: "2499",
      rating: "4.5",
      brand: "Sony",
    });

    // HGET: Retrieve a specific field from the Hash.
    const productRating = await client.hGet("product:101", "rating");
    console.log("Product Rating:", productRating);

    // HGETALL: Retrieve all fields and values from the Hash.
    const productDetails = await client.hGetAll("product:101");
    console.log("Product Details:", productDetails);

    // HDEL: Delete a field from the Hash.
    await client.hDel("product:101", "rating");
    console.log("After Deletion:", await client.hGetAll("product:101"));
  } catch (e) {
    console.log(e);
  } finally {
    if (client.isOpen) {
      await client.quit();
    }
  }
}

redisDataStructure();
