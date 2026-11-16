const redis = require("redis");

const client = redis.createClient({
  host: "localhost",
  port: 6379,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries >= 5) {
        return new Error("Max Redis reconnection retries reached");
      }
      return 1000;
    },
  },
});

client.on("error", (error) =>
  console.log("Redis client error occured!", error),
);

async function pipeliningTransaction() {
  try {
    await client.connect();
    console.log("Connected to Redis");

    // 1. REDIS TRANSACTION

    // MULTI: Create a transaction command queue.
    const transaction = client.multi();

    // Add commands to the transaction queue.
    transaction.set("key-transaction1", "value1");
    transaction.set("key-transaction2", "value2");
    transaction.get("key-transaction1");
    transaction.get("key-transaction2");

    const transactionResult = await transaction.exec();

    console.log("Transaction result:", transactionResult);

    // 2. REDIS PIPELINING

    // Create a pipeline command queue.
    const pipeline = client.multi();

    // Queue multiple Redis commands.
    pipeline.set("key-pipeline1", "value1");
    pipeline.set("key-pipeline2", "value2");
    pipeline.get("key-pipeline1");
    pipeline.get("key-pipeline2");

    const pipelineResult = await pipeline.execAsPipeline();

    console.log("Pipeline result:", pipelineResult);

    // 3. BATCH DATA OPERATIONS

    // Create a pipeline for storing 1000 key-value pairs.
    const batchPipeline = client.multi();

    for (let i = 0; i < 1000; i++) {
      // Generate a unique key and value for each iteration.
      batchPipeline.set(`user:${i}:action`, `Action ${i}`);
    }

    // Execute all 1000 SET commands as a pipeline.
    const batchResult = await batchPipeline.execAsPipeline();

    console.log("Batch operations completed:", batchResult.length);

    // 4. ACCOUNT TRANSFER TRANSACTION

    // Create a transaction for transferring account balances.
    const accountTransaction = client.multi();

    // Deduct 100 from the sender's balance.
    accountTransaction.decrBy("account:1234:balance", 100);
    // Add 100 to the receiver's balance.
    accountTransaction.incrBy("account:0001:balance", 100);

    const finalResult = await accountTransaction.exec();

    console.log("Account transaction result:", finalResult);

    // Performance comparison between without pipelining and with pipelining
    console.log("Performance Test");

    // 1. WITHOUT PIPELINING
    console.time("Without Pipelining");

    for (let i = 0; i < 1000; i++) {
      // Send and wait for each Redis command individually.
      await client.set(`user${i}`, `user_value${i}`);
    }

    console.timeEnd("Without Pipelining");

    // 2. WITH PIPELINING
    console.time("With Pipelining");

    // Create a pipeline to queue multiple commands.
    const bigPipeline = client.multi();

    for (let i = 0; i < 1000; i++) {
      // Queue commands without executing them immediately.
      bigPipeline.set(`user_pipeline_key${i}`, `user_pipeline_value${i}`);
    }

    // Execute all queued commands together.
    await bigPipeline.execAsPipeline();

    console.timeEnd("With Pipelining");
  } catch (error) {
    console.error("Redis error:", error);
    process.exitCode = 1;
  } finally {
    if (client.isOpen) {
      await client.quit();
    }
  }
}

pipeliningTransaction();
