# 08 — Build Pub/Sub with Redis

## 1. What is Redis Pub/Sub?

**Pub/Sub (Publish–Subscribe)** is a messaging mechanism in which a publisher sends messages to a channel and all active subscribers listening to that channel receive them.

Notifications are not limited to phone notifications. They can include:

- Email notifications
- WhatsApp messages
- Website notifications
- Real-time alerts
- Live updates

### How it works

```text
             Publisher (api.js)
                    |
                    | PUBLISH
                    v
               Redis Channel
              "notifications"
               /    |    \
              /     |     \
             v      v      v
    Subscriber  Subscriber Subscriber
        1           2          3
```

- **Publisher:** Sends messages.
- **Channel:** The communication topic/name.
- **Subscriber:** Listens to a channel and receives messages.

One publisher can send messages to multiple subscribers.

## 2. Project structure

```text
src/
├── api.js          → Publisher (Express API)
└── subscriber.js   → Subscriber (Listens for messages)
```

## 3. subscriber.js — Receive messages

```js
import Redis from "ioredis";

const subscriber = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

subscriber.subscribe("notifications", (err) => {
  if (err) {
    console.error("Failed to subscribe:", err.message);
    return;
  }

  console.log("Subscribed successfully!");
});

subscriber.on("message", (channel, message) => {
  console.log("Received on", channel, ":", JSON.parse(message));
});
```

### Explanation

1. **Redis connection:** Connects the subscriber to Redis.
2. **`subscribe("notifications")`:** Starts listening to the `notifications` channel.
3. **`message` event:** Executes whenever a message arrives on the subscribed channel.
4. **`channel`:** Name of the channel from which the message arrived.
5. **`message`:** Actual message received.
6. **`JSON.parse(message)`:** Converts the JSON string back into a JavaScript object.

## 4. api.js — Publish messages

```js
import express from "express";
import Redis from "ioredis";

const app = express();
app.use(express.json());

const publisher = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

app.post("/notifications", async (req, res) => {
  const payload = {
    title: req.body.title || "Default Title",
    createdAt: new Date().toISOString(),
  };

  const receivers = await publisher.publish(
    "notifications",
    JSON.stringify(payload),
  );

  res.json({
    message: `Notification sent to ${receivers} subscribers`,
  });
});

app.listen(3000, () => {
  console.log("API server running on http://localhost:3000");
});
```

### Explanation

1. **`req.body.title`** → Gets the notification title from the POST request.
2. **`|| "Default Title"`** → Uses a default title if the provided title is missing or falsy.
3. **`createdAt`** → Stores the notification creation timestamp.
4. **`JSON.stringify(payload)`** → Converts the JavaScript object into a JSON string.
5. **`publisher.publish()`** → Publishes the message to the `notifications` channel.
6. **`receivers`** → Number of subscribers that Redis reports as receiving the published message.
7. **`res.json()`** → Sends the publishing result to the API client.

## 5. Understanding the POST request

Example:

**POST** `http://localhost:3000/notifications`

Request body:

```json
{
  "title": "New order received!"
}
```

Redis publishes:

```json
{
  "title": "New order received!",
  "createdAt": "2026-11-05T12:00:00.000Z"
}
```

Example API response:

```json
{
  "message": "Notification sent to 2 subscribers"
}
```

The number `2` means two active subscribers were listening to that channel when the message was published.

## 6. Important Redis Pub/Sub commands

| Command                   | Purpose                                |
| ------------------------- | -------------------------------------- |
| `PUBLISH channel message` | Sends a message to a channel           |
| `SUBSCRIBE channel`       | Listens to a channel                   |
| `UNSUBSCRIBE channel`     | Stops listening to a channel           |
| `PSUBSCRIBE pattern`      | Listens to channels matching a pattern |

## 7. Important limitations — Don't forget!

Redis Pub/Sub is designed for real-time messaging, not reliable job processing.

| Limitation             | Example                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------- |
| No message storage     | Published messages are not saved for later consumption.                            |
| No offline delivery    | If a subscriber is disconnected, it misses messages published during that time.    |
| No retry mechanism     | If a subscriber fails to process a message, Redis does not automatically retry it. |
| No acknowledgement     | Redis does not wait for subscribers to confirm successful processing.              |
| No message history     | Subscribers cannot retrieve previously published messages.                         |
| No guaranteed delivery | Pub/Sub provides at-most-once delivery.                                            |

**Important:** A message being received does not mean the subscriber successfully completed its business logic.

## 8. Pub/Sub vs BullMQ vs Redis Lists

| Feature                  | Pub/Sub             | BullMQ                   | Redis Lists (basic demo) |
| ------------------------ | ------------------- | ------------------------ | ------------------------ |
| Main purpose             | Real-time messaging | Background jobs          | Basic queue              |
| Stores jobs              | No                  | Yes                      | Yes                      |
| Offline message delivery | No                  | Yes, for retained jobs   | Yes, while items remain  |
| Automatic retries        | No                  | Yes, configurable        | No                       |
| Worker processing        | Subscribers         | Workers                  | Manual                   |
| Best use                 | Live notifications  | Emails, orders, payments | Learning FIFO queues     |

### When should you use Pub/Sub?

Use it when messages need to reach currently connected subscribers immediately.

Example: A user receives a real-time notification when a new order is placed.

Use **BullMQ** when the task must wait in a queue, survive worker downtime, and support retries.

### Remember this:

**Pub/Sub = Broadcast messages to active subscribers in real time.**

**BullMQ = Store and process background jobs reliably.**
