# 06 - Email Queue with Redis Lists

> **Learning goal:** Understand how Redis Lists can hold background
> jobs, how `LPUSH` and `RPOP` work together, and why this tiny demo is
> useful for learning---but is not a complete, reliable production
> queue.

## 1. The idea

An email request does not have to send an email during the original HTTP
request. Instead, the app can put an email _job_ into Redis. A separate
worker can take jobs from the queue and process them.

For this demo, a job is just JSON data:

```json
{
  "to": "student@example.com",
  "subject": "Welcome",
  "body": "Thanks for signing up",
  "createdAt": "2026-10-27T15:00:00.000Z"
}
```

The code below **simulates** sending an email: it removes a job from
Redis and responds with `"Email sent"`. It does not actually connect to
an email provider.

## 2. Diagram: what this code actually does

![Email queue with Redis Lists: LPUSH adds jobs to the left and RPOP
removes the oldest job from the
right.](./src/assets/email-queue-with-redis-lists.png)

The important detail is the exact pair of commands used by the code:

- New jobs are added with `LPUSH` (the **left/head** of the list).
- Jobs are taken with `RPOP` (the **right/tail** of the list).
- This makes the list behave as **FIFO** (First In, First Out): the
  oldest queued job is removed first.

Example, starting with an empty list:

Request Redis operation List, left → right

---

Add job 1 `LPUSH queue:emails job1` `[job1]`
Add job 2 `LPUSH queue:emails job2` `[job2, job1]`
Add job 3 `LPUSH queue:emails job3` `[job3, job2, job1]`
Process one `RPOP queue:emails` → job1 `[job3, job2]`
Process one `RPOP queue:emails` → job2 `[job3]`

So although new jobs are inserted on the left, processing from the right
preserves arrival order.

## 3. Code explained, line by line

### Queue key

```js
const QUEUE_KEY = "queue:emails";
```

This is the Redis key under which the list is stored. `queue:emails` is
a naming convention: `queue` describes the purpose and `emails`
describes the job type. The constant avoids repeating the string and
helps prevent typos.

### `POST /emails` --- enqueue a job

```js
app.post("/emails", async (req, res) => {
  const job = {
    to: req.body.to,
    subject: req.body.subject,
    body: req.body.body || "No content",
    createdAt: new Date().toISOString(),
  };

  await redis.lpush(QUEUE_KEY, JSON.stringify(job));
  res.json({ queued: true, job });
});
```

1.  **`req.body.to`** reads the recipient from the JSON request body.
2.  **`req.body.subject`** reads the email subject.
3.  **`req.body.body || "No content"`** uses the provided body, or
    `"No content"` if the body is missing or otherwise falsy (for
    example, an empty string).
4.  **`createdAt`** records the time the job was created as an ISO
    timestamp.
5.  **`JSON.stringify(job)`** converts the JavaScript object into a
    string, because Redis List entries are strings/bytes---not native
    JavaScript objects.
6.  **`await redis.lpush(QUEUE_KEY, ...)`** inserts the job at the left
    side of the list and waits for Redis to finish the command.
7.  **`res.json({ queued: true, job })`** tells the API caller that the
    job was queued. It does **not** mean an email was delivered.

Example request in Postman:

```http
POST http://localhost:3000/emails
Content-Type: application/json
```

```json
{
  "to": "student@example.com",
  "subject": "Redis learning",
  "body": "Your queue demo is working!"
}
```

Example response:

```json
{
  "queued": true,
  "job": {
    "to": "student@example.com",
    "subject": "Redis learning",
    "body": "Your queue demo is working!",
    "createdAt": "2026-10-27T15:00:00.000Z"
  }
}
```

The timestamp above is illustrative; your app will generate the actual
current time.

### `GET /emails/process-one` --- dequeue and process one job

```js
app.get("/emails/process-one", async (req, res) => {
  const rawJob = await redis.rpop(QUEUE_KEY);

  if (!rawJob) {
    return res.json({ message: "no jobs in the queue" });
  }

  const job = JSON.parse(rawJob);

  // Simulate email sending
  res.json({ message: "Email sent", job });
});
```

1.  **`redis.rpop(QUEUE_KEY)`** removes and returns the rightmost
    (oldest) list item.
2.  **`if (!rawJob)`** handles an empty list. `RPOP` returns `null` when
    there is no item, so the API reports that the queue is empty.
3.  **`JSON.parse(rawJob)`** converts the stored JSON string back into a
    JavaScript object.
4.  **Simulated sending:** this example only returns a response. A real
    worker would call an email provider such as SMTP or a
    transactional-email API.
5.  **Important:** the job is removed _before_ processing finishes. If
    the process crashes after `RPOP` and before the actual send
    succeeds, the job can be lost.

Although this is a `GET` route for learning convenience, a real
processing action should normally be performed by a background worker,
not triggered by a public GET endpoint. GET is intended to be
safe/read-only.

## 4. Redis List commands: left and right

Imagine a list as a row with a **left end** and a **right end**.

---

Command Meaning Typical use

---

`LPUSH key value` Add item(s) to the Add newest jobs to the
**left** left

`RPUSH key value` Add item(s) to the Append items to the
**right** tail

`LPOP key` Remove and return the Pair with `RPUSH` for
**leftmost** item FIFO

`RPOP key` Remove and return the Pair with `LPUSH` for
**rightmost** item FIFO

---

Two common FIFO combinations:

- **`LPUSH` + `RPOP`**: add on the left, process from the right.
- **`RPUSH` + `LPOP`**: add on the right, process from the left.

Both preserve FIFO order when used consistently.

Other combinations such as `LPUSH` + `LPOP` or `RPUSH` + `RPOP` process
newest-first (LIFO/stack-like behavior), rather than FIFO.

## 5. Why learn this? Why use Redis for a queue?

Redis Lists make a useful **small queue building block**:

- **Fast operations:** pushing and popping at list ends are efficient.
- **Decouple requests from work:** the API can queue a job quickly
  rather than doing slow work inline.
- **Simple data structure:** easy to understand and inspect.
- **Shared queue:** multiple app instances can access the same Redis
  list.

Example: when a user signs up, the API can save the user and enqueue a
welcome-email job. The request can return without waiting for an email
provider to finish.

But Redis itself is not automatically a complete job-processing system.
The plain `LPUSH`/`RPOP` pattern shown here is intentionally minimal and
lacks important reliability and worker-management features.

## 6. Drawbacks of this exact pattern

---

Issue What can go wrong Example

---

**Job loss** `RPOP` deletes the job Worker pops an email,
before processing crashes, and the email
succeeds. is never sent.

**No automatic retry** Failed jobs are not Email provider times
requeued or retried. out; the job has
already disappeared.

**No acknowledgement / There is no record that A worker hangs after
in-progress state** a worker owns a job and popping a job; other
may need to finish it. workers cannot see it.

**No built-in delayed The code has no Retry a failing
retries or backoff** schedule for retrying provider immediately
transient errors. and repeatedly, or
never retry at all.

**No failure/dead-letter Permanently failing Invalid recipient keeps
queue** jobs are not separated failing with no useful
for investigation. failure history.

**Duplicate delivery risk If you re-add a job Provider accepted the
in a naive retry design** after an uncertain email, but the worker
send, it may be sent crashed before
twice. recording success.

**No job status/history** The list alone does not You cannot easily show
track queued, running, a reliable delivery
succeeded, or failed history in an admin
jobs. panel.

**Limited This simple list does A password-reset email
scheduling/priorities** not implement scheduled should not wait behind
jobs or priority thousands of bulk
policy. emails.

**No worker concurrency The example has no Many workers overload
controls** worker pool, rate the email provider or
limits, or provider hit its API limits.
throttling.

**No observability** There are no metrics, A queue builds up but
structured logs, nobody notices.
alerting, or queue-age  
 checks.

**Potential malformed `JSON.parse` can throw One malformed item can
data / poison job** if a stored item is crash a simplistic
corrupt. worker unless errors
are handled.

**Security and validation The route accepts Someone queues huge
missing** unvalidated fields and numbers of emails or
may be publicly supplies invalid
callable. addresses.

---

### The key lesson

**Do not conclude that Redis should never be used as a queue.** Redis is
widely used for queueing, caching, coordination, and more. The lesson is
that a plain Redis List with `LPUSH` and `RPOP` is not enough for
reliable production job processing by itself.

## 7. Safer approaches

- **For learning or a tiny, disposable demo:** the current pattern is
  fine.
- **For a more reliable Redis-based queue in Node.js:** consider
  **BullMQ**, which is built on Redis and provides worker management,
  retries, backoff, job states, delayed jobs, and other queue
  features. You still need to configure it correctly and make job
  handlers safe to retry.
- **For a plain Redis List:** investigate reliable queue patterns such
  as `LMOVE`/`BLMOVE` to move a job into a processing list, plus
  recovery logic for stuck jobs. This is more work and still requires
  careful handling of acknowledgements, retries, duplicate effects,
  and monitoring.
- **For critical email delivery:** use a durable queue/job system,
  monitor failures, and design for idempotency. Even robust queues
  cannot guarantee exactly-once delivery to an external email provider
  in every failure scenario.

A useful mental model:

> **Redis List = data structure. Queue reliability = data structure +
> worker logic + retries + recovery + monitoring.**

## 8. Small production-readiness checklist

Before using a queue for real emails, make sure you have:

- [ ] Input validation and authentication/rate limiting on job
      creation.
- [ ] A real email provider integration.
- [ ] Failure handling and retry policy with backoff.
- [ ] A way to recover jobs when workers crash.
- [ ] A policy for permanent failures / dead-letter jobs.
- [ ] Idempotent processing where possible, to reduce duplicate side
      effects.
- [ ] Job status, logs, queue-depth/age metrics, and alerts.
- [ ] Graceful worker shutdown and Redis connection/error handling.
- [ ] Appropriate Redis persistence/availability settings for your
      durability needs.
- [ ] Tests for empty queues, provider errors, worker crashes, and
      duplicate attempts.

## 9. Quick recap

- `QUEUE_KEY` names the Redis list.
- `LPUSH` adds each JSON-stringified job to the left.
- `RPOP` removes the oldest job from the right.
- `JSON.stringify` serializes an object; `JSON.parse` restores it.
- `queued: true` means accepted into Redis---not successfully
  delivered.
- This demo is good for learning FIFO queues, but it can lose jobs and
  has no retry/recovery features.
- For production-grade Node.js queues backed by Redis, evaluate
  **BullMQ** rather than building all queue reliability from scratch.
