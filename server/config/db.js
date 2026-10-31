const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

let memoryServer = null;

const connectDB = async () => {
  const connUri = process.env.MONGODB_URI || "mongodb://localhost:27017/lerniq";
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

      memoryServer = await MongoMemoryServer.create({
        instance: {
          dbPath: dbDir,
          storageEngine: "wiredTiger",
          dbName: "lerniq",
        },
      });
      const memoryUri = memoryServer.getUri();
      const conn = await mongoose.connect(memoryUri, { dbName: "lerniq" });
      console.log(`✅ Persistent Fallback MongoDB Connected at: ${memoryUri} (Database: lerniq)`);
      return conn;
    } catch (memErr) {
      console.error("❌ Failed to initialize persistent fallback MongoDB:", memErr.message);
      process.exit(1);
    }
  }
};

process.on("SIGINT", async () => {
  if (memoryServer) {
    await memoryServer.stop();
  }
  process.exit(0);
});

module.exports = connectDB;
