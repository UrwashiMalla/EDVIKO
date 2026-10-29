const mongoose = require("mongoose");

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
    console.log("⚡ Starting automatic fallback in-memory MongoDB...");

    try {
      const { MongoMemoryServer } = require("mongodb-memory-server");
      memoryServer = await MongoMemoryServer.create({
        instance: {
          dbName: "lerniq",
        },
      });
      const memoryUri = memoryServer.getUri();
      const conn = await mongoose.connect(memoryUri);
      console.log(`✅ Fallback In-Memory MongoDB Connected at: ${memoryUri}`);
      return conn;
    } catch (memErr) {
      console.error("❌ Failed to initialize fallback in-memory MongoDB:", memErr.message);
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
