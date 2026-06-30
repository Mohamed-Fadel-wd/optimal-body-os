import "dotenv/config";
import cors from "cors";
import express from "express";
import { MongoClient } from "mongodb";

const port = Number(process.env.PORT || 8787);
const mongoUri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB || "optimal_body_os";
const allowedKeys = new Set(["recovery", "workouts", "today"]);
const allowedOrigins = (process.env.CORS_ORIGIN || "http://127.0.0.1:4173,http://localhost:4173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!mongoUri) {
  console.error("MONGODB_URI is required. Copy .env.example to .env and add your connection string.");
  process.exit(1);
}

const client = new MongoClient(mongoUri);
await client.connect();

const state = client.db(databaseName).collection("app_state");
const app = express();

app.disable("x-powered-by");
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS"));
  }
}));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (_request, response, next) => {
  try {
    await client.db(databaseName).command({ ping: 1 });
    response.json({ status: "ok", database: databaseName });
  } catch (error) {
    next(error);
  }
});

app.get("/api/state/:key", async (request, response, next) => {
  try {
    if (!allowedKeys.has(request.params.key)) {
      return response.status(404).json({ error: "Unknown state key" });
    }

    const document = await state.findOne({ _id: request.params.key });
    if (!document) return response.status(404).json({ error: "State not found" });
    return response.json({ value: document.value, updatedAt: document.updatedAt });
  } catch (error) {
    return next(error);
  }
});

app.put("/api/state/:key", async (request, response, next) => {
  try {
    if (!allowedKeys.has(request.params.key)) {
      return response.status(404).json({ error: "Unknown state key" });
    }
    if (!Object.hasOwn(request.body, "value")) {
      return response.status(400).json({ error: "A value field is required" });
    }

    const updatedAt = new Date();
    await state.updateOne(
      { _id: request.params.key },
      { $set: { value: request.body.value, updatedAt } },
      { upsert: true }
    );
    return response.json({ ok: true, updatedAt });
  } catch (error) {
    return next(error);
  }
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: "Internal server error" });
});

const server = app.listen(port, () => {
  console.log(`Optimal Body OS API listening on http://127.0.0.1:${port}`);
});

async function shutdown() {
  server.close();
  await client.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
