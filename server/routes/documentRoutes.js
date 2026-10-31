const express = require("express");
const router = express.Router();
const {
  createDocument,
  getMyDocuments,
  getDocumentById,
  deleteDocument,
} = require("../controllers/documentController");
const { authenticate, requireRole } = require("../middleware/authMiddleware");

router.use(authenticate);

// Both students and teachers can upload study documents and access course materials
router.post("/", createDocument);
router.get("/", getMyDocuments);
router.get("/:id", getDocumentById); // accessible to student owner or assigned teacher
router.delete("/:id", deleteDocument);

module.exports = router;
