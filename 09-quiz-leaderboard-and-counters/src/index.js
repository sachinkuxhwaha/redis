import express from "express";
import Redis from "ioredis";

const app = express();

app.use(express.json());

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// Redis Sorted Set key for our quiz leaderboard
const LEADERBOARD_KEY = "leaderboard:game123";

// 1. POST - Increment post view count
app.post("/post/:id/view", async (req, res) => {
  try {
    const postId = req.params.id;

    // Create a unique Redis key for this post
    const key = `post:${postId}:views`;

    const views = await redis.incr(key);

    res.json({
      message: "Post view counted",
      postId,
      views,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. POST - Add points to a user's score
app.post("/leaderboard/score", async (req, res) => {
  try {
    const { userId, points } = req.body;

    // Validate input
    if (
      typeof userId !== "string" ||
      !userId.trim() ||
      !Number.isSafeInteger(points) ||
      points <= 0
    ) {
      return res.status(400).json({
        error: "Provide a valid userId and positive integer points",
      });
    }

    // Add points to user's existing score
    const score = await redis.zincrby(LEADERBOARD_KEY, points, userId.trim());

    res.json({
      message: "Score updated successfully",
      userId: userId.trim(),
      score: Number(score),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. GET - Fetch top 10 leaderboard players
app.get("/leaderboard", async (req, res) => {
  try {
    // Get top 10 players with their scores
    const result = await redis.zrevrange(LEADERBOARD_KEY, 0, 9, "WITHSCORES");

    // Redis returns a flat array: [userId, score, userId, score...]
    const leaderboard = [];

    for (let i = 0; i < result.length; i += 2) {
      leaderboard.push({
        rank: i / 2 + 1,
        userId: result[i],
        score: Number(result[i + 1]),
      });
    }

    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. GET - Get a particular user's rank
app.get("/leaderboard/:userId/rank", async (req, res) => {
  try {
    const userId = req.params.userId;

    // Get user's rank (0-based, highest score first)
    const rank = await redis.zrevrank(LEADERBOARD_KEY, userId);

    if (rank === null) {
      return res.status(404).json({
        message: "User not found in leaderboard",
      });
    }

    res.json({
      userId,
      rank: rank + 1, // Convert 0-based rank to 1-based rank
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log("Leaderboard API running on http://localhost:3000");
});
