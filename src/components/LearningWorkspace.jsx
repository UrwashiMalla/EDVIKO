import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth/mammoth.browser";
import { documentApi } from "../services/api";

import "./LearningWorkspace.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

function LearningWorkspace({ onBack, onStartLearning }) {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("upload");
  const [language, setLanguage] = useState("English");

  const [selectedFile, setSelectedFile] = useState(null);
  const [extractedText, setExtractedText] = useState("");

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // =============================
  // PDF TEXT EXTRACTION
  // =============================
  const extractPdfText = async (file) => {
    const arrayBuffer = await file.arrayBuffer();

    const pdf = await pdfjsLib
      .getDocument({
        data: arrayBuffer,
      })
      .promise;

    let completeText = "";

    for (
      let pageNumber = 1;
      pageNumber <= pdf.numPages;
      pageNumber++
    ) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => item.str)
        .join(" ");

      completeText += `\n\n--- Page ${pageNumber} ---\n\n`;
      completeText += pageText;
    }

    return completeText.trim();
  };

  // =============================
  // DOCX TEXT EXTRACTION
  // =============================
  const extractDocxText = async (file) => {
    const arrayBuffer = await file.arrayBuffer();

    const result = await mammoth.extractRawText({
      arrayBuffer,
    });

    return result.value.trim();
  };

  // =============================
  // FILE SELECTION
  // =============================
  const handleFileChange = async (event) => {
    const file = event.target.files[0];

    if (!file) {
      return;
    }

    setSelectedFile(file);
    setExtractedText("");
    setErrorMessage("");
    setIsProcessing(true);

    try {
      let text = "";
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith(".pdf")) {
        text = await extractPdfText(file);
      } else if (fileName.endsWith(".docx")) {
        text = await extractDocxText(file);
      } else {
        throw new Error(
          "Currently PDF and DOCX files are supported for text extraction."
        );
      }

      if (!text || text.trim().length === 0) {
        throw new Error(
          "Text could not be extracted from this PDF. The document may be empty or scanned without selectable text."
        );
      }

      setExtractedText(text);
    } catch (error) {
      console.error("Document extraction error:", error);
      setErrorMessage(
        error.message ||
          "Something went wrong while reading the document."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // =============================
  // PASTE TEXT
  // =============================
  const handlePasteText = (event) => {
    setExtractedText(event.target.value);
    setSelectedFile(null);
    setErrorMessage("");
  };

  // =============================
  // START AI LEARNING & PERSIST
  // =============================
  const handleStartLearning = async () => {
    if (!extractedText.trim()) {
      alert("Please upload a document or paste some study content first.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage("");

    try {
      const docTitle = selectedFile
        ? selectedFile.name.replace(/\.[^/.]+$/, "")
        : extractedText.trim().slice(0, 40) + "...";

      const res = await documentApi.create({
        title: docTitle,
        originalFileName: selectedFile ? selectedFile.name : "pasted-content.txt",
        fileType: selectedFile
          ? selectedFile.name.endsWith(".docx")
            ? "docx"
            : "pdf"
          : "text",
        fileSize: selectedFile ? selectedFile.size : extractedText.length,
        extractedText: extractedText,
      });

      if (onStartLearning) {
        onStartLearning({
          text: extractedText,
          language: language,
          documentId: res.document?.id,
        });
      }

      navigate(`/student/documents/${res.document.id}?lang=${encodeURIComponent(language)}`);
    } catch (err) {
      setErrorMessage(err.message || "Failed to save study material to database.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate("/student/dashboard");
    }
  };

  // =============================
  // STATISTICS
  // =============================
  const wordCount = extractedText.trim()
    ? extractedText.trim().split(/\s+/).length
    : 0;

  const characterCount = extractedText.length;

  return (
    <div className="learning-workspace">
      {/* =========================
          HEADER
      ========================== */}
      <motion.header
        className="workspace-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="workspace-logo" onClick={() => navigate("/student/dashboard")} style={{ cursor: "pointer" }}>
          🎓 <strong>LERNIQ</strong>
        </div>

        <button className="workspace-back" onClick={handleBack}>
          ← Back to Dashboard
        </button>
      </motion.header>

      {/* =========================
          MAIN
      ========================== */}
      <main className="workspace-container">
        {/* HEADING */}
        <motion.div
          className="workspace-heading"
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="workspace-badge">
            ✨ AI LEARNING WORKSPACE
          </span>

          <h1>
            Turn Your Content
            <br />
            <span>Into Smart Learning 🚀</span>
          </h1>

          <p>
            Upload your study material or paste your content.
            LERNIQ will extract, save, and personalize it with Groq AI.
          </p>
        </motion.div>

        {/* =========================
            WORKSPACE CARD
        ========================== */}
        <motion.section
          className="workspace-card"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          {/* TABS */}
          <div className="workspace-tabs">
            <button
              className={activeTab === "upload" ? "active" : ""}
              onClick={() => setActiveTab("upload")}
            >
              📄 Upload Document
            </button>

            <button
              className={activeTab === "paste" ? "active" : ""}
              onClick={() => setActiveTab("paste")}
            >
              ✍️ Paste Text
            </button>
          </div>

          {/* =========================
              UPLOAD TAB
          ========================== */}
          {activeTab === "upload" && (
            <motion.div
              className="upload-area"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <div className="upload-icon">☁️</div>

              <h2>Upload your study material</h2>
              <p>PDF or DOCX files are supported</p>

              <label className="upload-button">
                Choose File
                <input
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleFileChange}
                  hidden
                />
              </label>

              {/* SELECTED FILE */}
              {selectedFile && (
                <motion.div
                  className="selected-file"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  📎 <strong>{selectedFile.name}</strong>
                </motion.div>
              )}

              {/* PROCESSING */}
              {isProcessing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    marginTop: "15px",
                    fontWeight: "600",
                    color: "#7c3aed",
                  }}
                >
                  ⏳ Reading & processing your document...
                </motion.div>
              )}

              {/* ERROR */}
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    marginTop: "15px",
                    padding: "12px 16px",
                    borderRadius: "12px",
                    background: "#fff1f2",
                    color: "#be123c",
                    fontSize: "14px",
                  }}
                >
                  ⚠️ {errorMessage}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* =========================
              PASTE TAB
          ========================== */}
          {activeTab === "paste" && (
            <motion.div
              className="paste-area"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <h2>Paste your study content</h2>

              <textarea
                placeholder="Paste your notes, chapter, article or study material here..."
                value={extractedText}
                onChange={handlePasteText}
              />

              <div className="text-count">
                {characterCount} characters • {wordCount} words
              </div>
            </motion.div>
          )}

          {/* =========================
              EXTRACTED TEXT PREVIEW
          ========================== */}
          {extractedText && (
            <motion.div
              className="extracted-preview"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="preview-header">
                <div>
                  <span className="preview-badge">✅ CONTENT READY</span>
                  <h3>Extracted Study Content</h3>
                </div>

                <div className="preview-stats">
                  <span>📝 {wordCount} words</span>
                  <span>🔤 {characterCount} characters</span>
                </div>
              </div>

              <div className="preview-text">{extractedText}</div>
            </motion.div>
          )}

          {/* =========================
              CONTROLS
          ========================== */}
          <div className="workspace-controls">
            <div className="language-control">
              <label>🌐 Learning Language</label>

              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="English">🇬🇧 English</option>
                <option value="Hindi">🇮🇳 Hindi</option>
                <option value="Marathi">🇮🇳 Marathi</option>
                <option value="Hinglish">💬 Hinglish</option>
              </select>
            </div>

            <motion.button
              className="process-button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleStartLearning}
              disabled={isProcessing}
            >
              <span>{isProcessing ? "Saving & Processing..." : "✨ Start AI Learning"}</span>
              <span>→</span>
            </motion.button>
          </div>
        </motion.section>

        {/* =========================
            FEATURE CARDS
        ========================== */}
        <div className="workspace-features">
          <motion.div className="workspace-feature-card" whileHover={{ y: -6 }}>
            <div className="feature-icon">📝</div>
            <h3>Smart Summary</h3>
            <p>Convert long study material into simple notes.</p>
          </motion.div>

          <motion.div className="workspace-feature-card" whileHover={{ y: -6 }}>
            <div className="feature-icon">❓</div>
            <h3>10 Practice Questions</h3>
            <p>Generate important exam questions directly from your content.</p>
          </motion.div>

          <motion.div className="workspace-feature-card" whileHover={{ y: -6 }}>
            <div className="feature-icon">🧠</div>
            <h3>10 MCQ Quiz</h3>
            <p>Practice knowledge with instant answers and explanations.</p>
          </motion.div>

          <motion.div className="workspace-feature-card" whileHover={{ y: -6 }}>
            <div className="feature-icon">💬</div>
            <h3>AI Tutor</h3>
            <p>Ask questions and understand topics with multi-turn chat.</p>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

export default LearningWorkspace;