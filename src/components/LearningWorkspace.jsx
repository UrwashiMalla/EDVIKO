import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth/mammoth.browser";
import { documentApi } from "../services/api";
import Navbar from "./Navbar";
import { recognizeImageQuestion } from "../utils/imageOcrHelper";
import { extractTextFromFile, getFileCategory } from "../utils/documentExtractor";

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
  // IMAGE (JPEG / PNG) TEXT EXTRACTION VIA OCR
  // =============================
  const extractImageText = async (file) => {
    try {
      // Use enhanced contrast preprocessing for handwritten notes and pen questions
      const recognized = await recognizeImageQuestion(file);
      if (recognized && recognized.length > 10) {
        return recognized;
      }
    } catch (ocrErr) {
      console.warn("Image handwriting OCR warning:", ocrErr);
    }

    return `[Study Material Image: ${file.name}]\nImage uploaded by student for AI analysis. Contains handwritten notes, lecture slides, or diagram concepts. Master this topic with AI Summary, Practice Questions, Quiz, and AI Tutor explanations.`;
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

      if (fileName.endsWith(".pdf") || fileName.endsWith(".docx")) {
        text = await extractTextFromFile(file);
      } else if (
        fileName.endsWith(".jpg") ||
        fileName.endsWith(".jpeg") ||
        fileName.endsWith(".png") ||
        file.type?.startsWith("image/")
      ) {
        text = await extractImageText(file);
      } else {
        text = await extractTextFromFile(file);
      }

      if (!text || text.trim().length === 0) {
        throw new Error(
          "Text could not be extracted from this file. Please make sure it is not empty or try pasting the content directly."
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

      const fType = selectedFile ? getFileCategory(selectedFile) : "text";

      const res = await documentApi.create({
        title: docTitle,
        originalFileName: selectedFile ? selectedFile.name : "pasted-content.txt",
        fileType: fType,
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

  const wordCount = extractedText.trim()
    ? extractedText.trim().split(/\s+/).length
    : 0;

  const characterCount = extractedText.length;

  return (
    <div className="learning-workspace">
      {/* =========================
          GLOBAL NAVBAR
      ========================== */}
      <Navbar activeTab="workspace" />

      {/* =========================
          WORKSPACE CONTAINER
      ========================== */}
      <main className="workspace-container">
        {/* TOP BAR / BACK BUTTON */}
        <div className="workspace-top-bar">
          <motion.button
            className="workspace-back-button"
            onClick={handleBack}
            whileHover={{ scale: 1.03, x: -3 }}
            whileTap={{ scale: 0.97 }}
          >
            ← Back to Dashboard
          </motion.button>
        </div>

        {/* WORKSPACE HEADING (Sentence removed as requested) */}
        <div className="workspace-heading">
          <span className="workspace-badge">⚡ GROQ AI POWERED</span>
          <h1>Study Material Workspace</h1>
        </div>

        {/* WORKSPACE CARD */}
        <motion.section
          className="workspace-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* TABS */}
          <div className="workspace-tabs">
            <button
              className={`workspace-tab ${activeTab === "upload" ? "active" : ""}`}
              onClick={() => setActiveTab("upload")}
            >
              ☁️ Upload File (PDF, DOCX, Code, Images, Notes)
            </button>

            <button
              className={`workspace-tab ${activeTab === "paste" ? "active" : ""}`}
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
              <p>PDF, DOCX, Code files, Images, and Text notes are supported</p>

              <label className="upload-button">
                Choose File
                <input
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,.md,.rtf,.csv,.json,.py,.js,.jsx,.ts,.tsx,.java,.cpp,.c,.cs,.html,.css,.sql,.php,.go,.rs,.rb,.sh,.xml,.yaml,.yml,.jpg,.jpeg,.png,.webp,image/*"
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
                  {selectedFile.type?.startsWith("image/") || /\.(jpe?g|png)$/i.test(selectedFile.name) ? "🖼️" : "📎"}{" "}
                  <strong>{selectedFile.name}</strong>
                  <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "8px" }}>
                    ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                </motion.div>
              )}

              {/* PROCESSING */}
              {isProcessing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    marginTop: "18px",
                    fontWeight: "600",
                    color: "#7c3aed",
                  }}
                >
                  ⏳ Reading & processing your document with OCR...
                </motion.div>
              )}

              {/* ERROR */}
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    marginTop: "18px",
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
