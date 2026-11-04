# 07 — BullMQ Queue Infrastructure

## 1. What is BullMQ?

**BullMQ** is a Node.js library that uses Redis to manage background jobs and queues.

Instead of manually managing Redis Lists using `LPUSH`, `RPOP`, etc., BullMQ handles queue management, job processing, retries, and job states.

### How does the queue mechanism work?

There are three main components:

1. **Producer:** Creates and sends jobs to the queue. Example: Express API.
2. **Queue:** Stores job information in Redis until a worker processes it.
3. **Consumer (Worker):** Picks up jobs and executes the actual business logic.

**Example:** A producer sends 4 email jobs, but only 3 workers are available. The remaining job waits in the queue until a worker becomes free.

Multiple producers, queues, and workers can exist.

> Redis stores the job information; the worker executes the actual business logic.

## 2. Project structure

```text
src/
├── api.js       → Producer (Express API)
├── queue.js     → Queue configuration
└── worker.js    → Consumer (Business logic)
```

## 3. queue.js — Create the queue

```js
import { Queue } from "bullmq";

const connection = {
  host: "localhost",
  port: 6379,
};

const emailQueue = new Queue("emails", { connection });

export { emailQueue, connection };
```

- `Queue` creates a BullMQ queue.
- `"emails"` is the queue name.
- `connection` tells BullMQ where Redis is running.
- Export the queue so the producer can add jobs.
- Export the connection so workers can connect to the same Redis instance.

You can create multiple queues, such as `emails`, `orders`, and `payments`.

## 4. worker.js — Process jobs

```js
import { Worker } from "bullmq";
import { connection } from "./queue.js";

const emailWorker = new Worker(
  "emails",
  async (job) => {
    console.log("Processing:", job.id, job.name, job.data);

    await new Promise((resolve) => setTimeout(resolve, 1500));

    console.log("Email job completed!", job.id);
  },
  { connection },
);

emailWorker.on("completed", (job) => {
  console.log("Job completed!", job.id, job.name, job.data);
});

emailWorker.on("failed", (job, err) => {
  console.log("Job failed!", job?.id, err.message);
});
```

### Three important things in a Worker

1. **Queue name:** `"emails"` — which queue to listen to.
2. **Processor function:** `async (job) => {}` — actual business logic.
3. **Connection:** `{ connection }` — Redis connection.

### Understanding the job object

BullMQ provides three commonly used properties:

- `job.id` → Unique job ID.
- `job.name` → Job/task name.
- `job.data` → Information passed by the producer.

### Worker events

- `completed` → Fires when a job is successfully processed.
- `failed` → Fires when a job fails.

These events help us monitor job processing.

## 5. api.js — Producer (POST request)

```js
import express from "express";
import { emailQueue } from "./queue.js";

const app = express();
app.use(express.json());

app.post("/welcome-email", async (req, res) => {
  const job = await emailQueue.add(
    "send-welcome-email",
    {
      to: req.body.to,
      name: req.body.name || "Learner",
    },
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1000,
      },
    },
  );

  res.json({
    message: "Welcome email job added to the queue!",
    jobId: job.id,
  });
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
```

### The MOST IMPORTANT part: `emailQueue.add()`

```js
emailQueue.add(
  "send-welcome-email",
  {
    to: req.body.to,
    name: req.body.name || "Learner",
  },
  {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
  },
);
```

Remember these **THREE things** in every `Queue.add()` call:

| Part                       | Meaning                     | Example                         |
| -------------------------- | --------------------------- | ------------------------------- |
| 1. Job name                | What task should run?       | `"send-welcome-email"`          |
| 2. Job data                | What information is needed? | `{ to, name }`                  |
| 3. Configuration / options | How should the job behave?  | `{ attempts: 3, backoff: ... }` |

**1. Job name**

```js
"send-welcome-email";
```

Identifies the task that the worker needs to perform.

**2. Job data**

```js
{
  to: req.body.to,
  name: req.body.name || "Learner"
}
```

Contains the information required by the worker.

- `req.body.to` → Recipient's email from the POST request.
- `req.body.name` → Recipient's name.
- `|| "Learner"` → Uses `"Learner"` if the name is missing or falsy.

**3. Job options / configuration**

```js
{
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 1000
  }
}
```

- `attempts: 3` → Maximum of 3 processing attempts in total (initial attempt + retries).
- `type: "exponential"` → Retry delay increases exponentially.
- `delay: 1000` → Initial retry delay is 1 second.

In this example, the retry delays are approximately 1 second and 2 seconds before the second and third attempts.

### What happens when the POST request arrives?

1. Client sends recipient details to `/welcome-email`.
2. Express reads the details using `req.body`.
3. `emailQueue.add()` creates a job with its name, data, and options.
4. BullMQ stores the job in Redis.
5. A worker listening to `"emails"` picks up the job when available.
6. The worker executes its business logic.
7. The worker emits a `completed` or `failed` event.

**Important:** `await` is necessary because `emailQueue.add()` returns a Promise. We wait for the job to be added before using `job.id` in the response.

## 6. Why BullMQ instead of manually using Redis Lists?

| Plain Redis List                        | BullMQ                        |
| --------------------------------------- | ----------------------------- |
| Manual job handling                     | Managed job processing        |
| No automatic retry in our basic example | Configurable retries          |
| Manual failure handling                 | Job failure states and events |
| Manual recovery logic                   | Built-in queue management     |
| No built-in delayed jobs in our example | Delayed jobs supported        |
| Manual worker implementation            | Worker abstraction provided   |

BullMQ also supports concurrency, priorities, rate limiting, repeatable jobs, and more.

### Remember this:

**Producer creates → Queue stores → Worker processes → Events report the result.**

BullMQ is a higher-level queue system built on Redis, making background job processing easier and more reliable than implementing everything manually.
