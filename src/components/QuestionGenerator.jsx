import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { aiApi } from "../services/api";
import { useToast } from "../context/useToast";
import "./QuestionGenerator.css";

function QuestionGenerator({ onBack, language = "English", onLanguageChange, text = "", documentId = null, initialQuestions = [] }) {
  const { showToast } = useToast();
  const [questions, setQuestions] = useState(initialQuestions || []);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState("");

  const generateQuestions = useCallback(async (force = true) => {
    if (!text && !documentId) {
      setError("Please provide study material first.");
      showToast("Please provide study material first.", "warning");
      return;
    }

    setLoading(true);
    setLoadingMessage(force ? "Regenerating 10 fresh practice questions with Groq AI..." : `Generating 10 practice questions in ${language}...`);
    setError("");
    // Clear old questions on regenerate so user sees fresh generation immediately
    if (force) setQuestions([]);

    try {
      const data = await aiApi.getQuestions({
        documentId,
        text,
        language,
        forceRegenerate: force,
      });

      if (!data.success) {
        throw new Error(data.message || "Failed to generate questions.");
      }

      setQuestions(data.questions);
      showToast(force ? "✓ 10 new questions regenerated successfully" : `✓ 10 questions ready in ${language}`, "success");
    } catch (err) {
      console.error("Question Generator Error:", err);
      const errMsg = err.message || "Unable to generate questions. Please check connection.";
      setError(errMsg);
      showToast(errMsg, "error");
    } finally {
      setLoading(false);
    }
  }, [documentId, language, text, showToast]);

  useEffect(() => {
    let ignore = false;
    if (documentId) {
      setLoading(true);
      setLoadingMessage(`Preparing 10 practice questions in ${language}...`);
      setError("");
      // Clear questions immediately to eliminate stale language questions
      setQuestions([]);

      aiApi.getQuestions({ documentId, text, language, forceRegenerate: false })
        .then((data) => {
          if (!ignore && data.success && data.questions) {
            setQuestions(data.questions);
            showToast(`✓ 10 Practice questions ready in ${language}`, "success");
          }
        })
        .catch((err) => {
          if (!ignore) {
            console.warn("Failed to load questions:", err.message);
            setError(err.message || "Failed to load questions.");
            showToast(err.message || "Failed to load questions.", "error");
          }
        })
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    }
    return () => {
      ignore = true;
    };
  }, [documentId, text, language, showToast]);

  const handleLanguageSelect = (newLang) => {
    if (newLang === language) return;
    showToast(`Switching language to ${newLang}...`, "info", 2000);
    if (onLanguageChange) {
      onLanguageChange(newLang);
    }
  };

  return (
    <div className="question-page">
      {/* HEADER */}
      <div className="question-header">
        <button className="question-back-btn" onClick={onBack} disabled={loading}>
          ← Back
        </button>

        <div className="question-header-title">
          <span className="question-header-icon">❓</span>
          <div>
            <h1>Practice Questions</h1>
            <p>10 targeted exam questions powered by Groq AI</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <select
            value={language}
            onChange={(e) => handleLanguageSelect(e.target.value)}
            disabled={loading}
            style={{
              padding: "6px 12px",
              borderRadius: "10px",
              border: "1px solid #d8b4fe",
              background: "#fff",
              color: "#6b21a8",
              fontSize: "13px",
              fontWeight: "600",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            <option value="English">🇬🇧 English</option>
            <option value="Hindi">🇮🇳 Hindi</option>
            <option value="Marathi">🇮🇳 Marathi</option>
            <option value="Hinglish">💬 Hinglish</option>
          </select>
        </div>
      </div>

      {/* HERO */}
      <motion.div
        className="question-hero"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="question-hero-icon">❓</div>
        <div>
          <h2>Master concepts with targeted questions</h2>
          <p>
            LERNIQ creates exactly 10 questions progressing from foundational to challenging based strictly on your document.
          </p>
        </div>
      </motion.div>

      {/* ACTION CARD */}
      <motion.div
        className="question-action-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div>
          <h3>{questions?.length > 0 ? "Regenerate Questions" : "Generate 10 Practice Questions"}</h3>
          <p>Language: <strong>{language}</strong> • Exactly 10 questions</p>
        </div>

        <button
          className="generate-question-btn"
          onClick={() => generateQuestions(true)}
          disabled={loading}
          style={{ opacity: loading ? 0.75 : 1, cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? "⏳ Processing..." : questions?.length > 0 ? "🔄 Regenerate Questions" : "❓ Generate 10 Questions"}
        </button>
      </motion.div>

      {/* LOADING SKELETON */}
      {loading && (
        <motion.div
          className="lerniq-skeleton-card"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ margin: "24px 0" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <span style={{ fontSize: "24px", animation: "spin 2s linear infinite" }}>🤖</span>
            <div>
              <strong style={{ fontSize: "16px", color: "#6b21a8" }}>{loadingMessage || "Generating Practice Questions..."}</strong>
              <div style={{ fontSize: "13px", color: "#6b7280" }}>Designing 10 university-level questions in {language} with Groq AI</div>
            </div>
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ marginBottom: "16px", padding: "14px", background: "#faf5ff", borderRadius: "10px" }}>
              <div className="lerniq-skeleton lerniq-skeleton-line" style={{ width: "35%", height: "12px" }} />
              <div className="lerniq-skeleton lerniq-skeleton-line" style={{ width: "90%", height: "14px" }} />
            </div>
          ))}
        </motion.div>
      )}

      {/* ERROR */}
      {error && !loading && (
        <motion.div
          className="question-error"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          ⚠️ {error}
        </motion.div>
      )}

      {/* QUESTIONS LIST */}
      {!loading && questions?.length > 0 && (
        <div className="question-list">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "18px", color: "#4c1d95", fontWeight: "700" }}>
              📝 10 Practice Questions ({language})
            </h3>
            <span style={{ fontSize: "13px", background: "#ede9fe", color: "#6b21a8", padding: "4px 10px", borderRadius: "8px", fontWeight: "600" }}>
              {questions.length} / 10 Complete
            </span>
          </div>

          {questions.map((q, index) => (
            <motion.div
              className="question-card"
              key={index}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
            >
              <div className="question-number">Question {index + 1}</div>
              <p className="question-text">{q.question}</p>

              <div className="question-meta">
                <span className={`difficulty-badge ${q.difficulty?.toLowerCase() || "medium"}`}>
                  {q.difficulty?.toUpperCase() || "MEDIUM"}
                </span>

                <span className="type-badge">
                  {q.type?.toUpperCase() || "CONCEPTUAL"}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

export default QuestionGenerator;
