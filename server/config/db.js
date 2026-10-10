const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const connUri = process.env.MONGODB_URI || "mongodb://localhost:27017/lerniq";
    const conn = await mongoose.connect(connUri);
    console.log(`MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error("MongoDB Connection Error:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
