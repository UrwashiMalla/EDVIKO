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

router.post("/", requireRole("student"), createDocument);
router.get("/", requireRole("student"), getMyDocuments);
router.get("/:id", getDocumentById); // accessible to student owner or assigned teacher
router.delete("/:id", requireRole("student"), deleteDocument);

module.exports = router;
