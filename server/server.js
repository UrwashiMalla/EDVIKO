const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");

const connectDB = require("./config/db");
const seedInitialData = require("./utils/seed");
const errorHandler = require("./middleware/errorHandler");

// Import modular routes
const authRoutes = require("./routes/authRoutes");
const documentRoutes = require("./routes/documentRoutes");
const aiRoutes = require("./routes/aiRoutes");
const quizRoutes = require("./routes/quizRoutes");
const studentRoutes = require("./routes/studentRoutes");
const teacherRoutes = require("./routes/teacherRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// CONNECT DATABASE & SEED
// ==========================================
connectDB().then(() => {
  seedInitialData();
});

// ==========================================
// SECURITY & MIDDLEWARE
// ==========================================
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

const clientUrls = (process.env.CLIENT_URL || "")
  .split(",")
  .map((u) => u.trim())
  .filter(Boolean);

const allowedOrigins = [
  ...clientUrls,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // In production, allow matched origin or permissive for preview environments
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// ==========================================
// HEALTH CHECK
// ==========================================
const healthHandler = (req, res) => {
  res.json({
    success: true,
    platform: "EDVIKO AI Educational Platform",
    status: "online",
    timestamp: new Date().toISOString(),
  });
};
app.get("/", healthHandler);
app.get("/api/health", healthHandler);

// ==========================================
// API ROUTES
// ==========================================
app.use("/api/auth", authRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/notifications", notificationRoutes);

// ==========================================
// ERROR HANDLING
// ==========================================
app.use(errorHandler);

// ==========================================
// START SERVER
// ==========================================
const server = app.listen(PORT, () => {
  console.log(`🚀 EDVIKO production-ready backend listening on port ${PORT}`);
});

module.exports = { app, server };