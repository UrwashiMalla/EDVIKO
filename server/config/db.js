const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

let memoryServer = null;

const connectDB = async () => {
  const connUri = process.env.MONGODB_URI || "mongodb://localhost:27017/edviko";
  try {
    // Fast check for local or configured MongoDB
    const conn = await mongoose.connect(connUri, { serverSelectionTimeoutMS: 2500 });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.warn(`⚠️  Local/configured MongoDB is not running (${error.message}).`);
    console.log("⚡ Starting automatic persistent fallback MongoDB...");

    try {
      const { MongoMemoryServer } = require("mongodb-memory-server");
      const dbDir = path.join(__dirname, "../data/db");
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Clean stale lock files if left behind by interrupted process
      const lockFiles = ["mongod.lock", "WiredTiger.lock"];
      lockFiles.forEach((f) => {
        const lp = path.join(dbDir, f);
        try {
          if (fs.existsSync(lp)) {
            fs.unlinkSync(lp);
          }
        } catch {}
      });

      memoryServer = await MongoMemoryServer.create({
        instance: {
          dbPath: dbDir,
          storageEngine: "wiredTiger",
          dbName: "edviko",
        },
      });
      const memoryUri = memoryServer.getUri();
      const conn = await mongoose.connect(memoryUri, { dbName: "edviko" });
      console.log(`✅ Persistent Fallback MongoDB Connected at: ${memoryUri} (Database: lerniq)`);
      return conn;
    } catch (memErr) {
      console.warn("⚠️ Persistent DB lock/init issue. Falling back to clean in-memory Mongo:", memErr.message);
      try {
        const { MongoMemoryServer } = require("mongodb-memory-server");
        memoryServer = await MongoMemoryServer.create({
          instance: {
            dbName: "edviko",
          },
        });
        const memoryUri = memoryServer.getUri();
        const conn = await mongoose.connect(memoryUri, { dbName: "edviko" });
        console.log(`✅ Clean In-Memory Fallback MongoDB Connected at: ${memoryUri} (Database: lerniq)`);
        return conn;
      } catch (err2) {
        console.error("❌ Failed to initialize fallback MongoDB:", err2.message);
        process.exit(1);
      }
    }
  }
};

const cleanup = async () => {
  if (memoryServer) {
    try {
      await memoryServer.stop();
    } catch {}
  }
  process.exit(0);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

module.exports = connectDB;
