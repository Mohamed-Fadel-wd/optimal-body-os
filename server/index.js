import "dotenv/config";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { MongoClient } from "mongodb";

const port = Number(process.env.PORT || 8787);
const mongoUri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB || "optimal_body_os";
const passwordHash = process.env.APP_PASSWORD_HASH;
const jwtSecret = process.env.JWT_SECRET;
const allowedKeys = new Set(["recovery", "workouts", "today"]);
const allowedOrigins = (process.env.CORS_ORIGIN || "http://127.0.0.1:4173,http://localhost:4173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!mongoUri || !passwordHash || !jwtSecret || jwtSecret.length < 32) {
  console.error("MONGODB_URI, APP_PASSWORD_HASH, and a JWT_SECRET of at least 32 characters are required.");
  process.exit(1);
}

const client = new MongoClient(mongoUri);
await client.connect();

const state = client.db(databaseName).collection("app_state");
const recoveryHistory = client.db(databaseName).collection("recovery_history");
const workouts = client.db(databaseName).collection("workouts");
await state.updateMany(
  { ownerId: { $exists: false }, _id: { $in: [...allowedKeys] } },
  [{ $set: { ownerId: "mohamed", key: "$_id" } }]
);
await Promise.all([
  state.createIndex({ ownerId: 1, key: 1 }, { unique: true }),
  recoveryHistory.createIndex({ ownerId: 1, date: -1 }, { unique: true }),
  workouts.createIndex({ ownerId: 1, workoutId: 1 }, { unique: true }),
  workouts.createIndex({ ownerId: 1, completedAt: -1 })
]);
const app = express();

app.disable("x-powered-by");
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS"));
  }
}));
app.use(express.json({ limit: "1mb" }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again later." }
});

app.post("/api/auth/login", loginLimiter, async (request, response, next) => {
  try {
    const password = typeof request.body.password === "string" ? request.body.password : "";
    if (!password || !(await bcrypt.compare(password, passwordHash))) {
      return response.status(401).json({ error: "Invalid password" });
    }
    const token = jwt.sign({ sub: "mohamed", name: "Mohamed Fadel" }, jwtSecret, {
      expiresIn: "12h",
      issuer: "optimal-body-os"
    });
    return response.json({ token, user: { name: "Mohamed Fadel" } });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/health", async (_request, response, next) => {
  try {
    await client.db(databaseName).command({ ping: 1 });
    response.json({ status: "ok", database: databaseName });
  } catch (error) {
    next(error);
  }
});

function requireAuth(request, response, next) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return response.status(401).json({ error: "Authentication required" });
  try {
    request.user = jwt.verify(token, jwtSecret, { issuer: "optimal-body-os" });
    return next();
  } catch {
    return response.status(401).json({ error: "Session expired" });
  }
}

app.use("/api/state", requireAuth);

app.get("/api/state/:key", async (request, response, next) => {
  try {
    if (!allowedKeys.has(request.params.key)) {
      return response.status(404).json({ error: "Unknown state key" });
    }

    const document = await state.findOne({ ownerId: request.user.sub, key: request.params.key });
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
      { ownerId: request.user.sub, key: request.params.key },
      { $set: { value: request.body.value, updatedAt }, $setOnInsert: { createdAt: updatedAt } },
      { upsert: true }
    );

    if (request.params.key === "recovery") {
      const date = updatedAt.toISOString().slice(0, 10);
      await recoveryHistory.updateOne(
        { ownerId: request.user.sub, date },
        { $set: { values: request.body.value, updatedAt }, $setOnInsert: { createdAt: updatedAt } },
        { upsert: true }
      );
    }

    if (request.params.key === "workouts" && Array.isArray(request.body.value)) {
      const operations = request.body.value.map((workout) => ({
        updateOne: {
          filter: { ownerId: request.user.sub, workoutId: workout.id },
          update: {
            $set: {
              ...workout,
              ownerId: request.user.sub,
              workoutId: workout.id,
              updatedAt
            },
            $setOnInsert: {
              createdAt: updatedAt,
              completedAt: workout.completedAt ? new Date(workout.completedAt) : updatedAt
            }
          },
          upsert: true
        }
      }));
      if (operations.length) await workouts.bulkWrite(operations);
    }
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
