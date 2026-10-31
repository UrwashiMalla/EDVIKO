import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { aiApi } from "../services/api";
import { useToast } from "../context/useToast";
import MarkdownRenderer from "./MarkdownRenderer";
import "./SmartSummary.css";

function SmartSummary({ onBack, language = "English", onLanguageChange, text = "", documentId = null, initialSummary = "" }) {
  const { showToast } = useToast();
  const [summary, setSummary] = useState(initialSummary || "");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState("");

  // Auto-fetch summary when documentId or language changes
  useEffect(() => {
    let ignore = false;
    if (documentId) {
      setLoading(true);
      setLoadingMessage(`Preparing smart summary in ${language}...`);
      setError("");
      // Clear old text immediately so stale language content doesn't linger
      setSummary("");

      aiApi.getSummary({ documentId, text, language, forceRegenerate: false })
        .then((data) => {
          if (!ignore && data.success && data.summary) {
            setSummary(data.summary);
            showToast(`✓ Summary ready in ${language}`, "success");
          }
        })
        .catch((err) => {
          if (!ignore) {
            console.warn("Failed to load summary:", err.message);
            setError(err.message || "Failed to load summary.");
            showToast(err.message || "Unable to load summary.", "error");
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

  const generateSummary = useCallback(async (force = true) => {
    if (!text && !documentId) {
      setError("Please provide study material first.");
      showToast("Please provide study material first.", "warning");
      return;
    }

    setLoading(true);
    setLoadingMessage(force ? "Regenerating fresh summary with Groq AI..." : `Generating summary in ${language}...`);
    setError("");

    try {
      const data = await aiApi.getSummary({
        documentId,
        text,
        language,
        forceRegenerate: force,
      });

      if (!data.success) {
        throw new Error(data.message || "Summary generation failed.");
      }

      setSummary(data.summary);
      showToast(force ? "✓ Summary regenerated successfully" : `✓ Summary generated in ${language}`, "success");
    } catch (err) {
      console.error("Summary Error:", err);
      const errMsg = err.message || "Unable to generate summary. Please check connection.";
      setError(errMsg);
      showToast(errMsg, "error");
    } finally {
      setLoading(false);
    }
  }, [documentId, text, language, showToast]);

  const handleLanguageSelect = (newLang) => {
    if (newLang === language) return;
    showToast(`Switching language to ${newLang}...`, "info", 2000);
    if (onLanguageChange) {
      onLanguageChange(newLang);
    }
  };

  return (
    <div className="summary-page">
      {/* Header */}
      <div className="summary-header">
        <button className="summary-back-btn" onClick={onBack} disabled={loading}>
          ← Back
        </button>

        <div className="summary-header-title">
          <span className="summary-header-icon">📝</span>
          <div>
            <h1>Smart Summary</h1>
            <p>AI-powered concise summary powered by Groq AI</p>
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

      {/* Hero */}
      <motion.div
        className="summary-hero"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="summary-hero-icon">✨</div>
        <div>
          <h2>Understand faster with AI</h2>
          <p>
            EDVIKO extracts the most important core ideas and structures them for quick comprehension.
          </p>
        </div>
      </motion.div>

      {/* Generate / Regenerate Button Card */}
      <motion.div
        className="summary-action-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div>
          <h3>{summary ? "Regenerate Summary" : "Generate AI Summary"}</h3>
          <p>
            Language: <strong>{language}</strong> {documentId ? "• Linked to saved document" : ""}
          </p>
        </div>

        <button
          className="generate-summary-btn"
          onClick={() => generateSummary(true)}
          disabled={loading}
          style={{ opacity: loading ? 0.75 : 1, cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? "⏳ Processing..." : summary ? "🔄 Regenerate Summary" : "✨ Generate Summary"}
        </button>
      </motion.div>

      {/* Active Loading Card / Skeleton */}
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
              <strong style={{ fontSize: "16px", color: "#6b21a8" }}>{loadingMessage || "Analyzing Content..."}</strong>
              <div style={{ fontSize: "13px", color: "#6b7280" }}>Generating structured insights in {language} with Groq AI</div>
            </div>
          </div>
          <div className="lerniq-skeleton lerniq-skeleton-line" style={{ width: "85%" }} />
          <div className="lerniq-skeleton lerniq-skeleton-line" style={{ width: "95%" }} />
          <div className="lerniq-skeleton lerniq-skeleton-line" style={{ width: "70%" }} />
          <div className="lerniq-skeleton lerniq-skeleton-line" style={{ width: "90%", marginTop: "16px" }} />
          <div className="lerniq-skeleton lerniq-skeleton-line" style={{ width: "80%" }} />
        </motion.div>
      )}

      {/* Error */}
      {error && !loading && (
        <motion.div
          className="summary-error"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          ⚠️ {error}
        </motion.div>
      )}

      {/* AI Summary Content Card */}
      {!loading && summary && (
        <motion.div
          className="summary-content-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="summary-content-header">
            <div>
              <span className="summary-small-label">GROQ AI GENERATED</span>
              <h2>📚 Your Smart Summary</h2>
            </div>
            <span className="summary-language-badge">{language}</span>
          </div>

          <div className="summary-text">
            <MarkdownRenderer content={summary} />
          </div>
        </motion.div>
      )}

      {/* Study Material Preview */}
      {text && (
        <motion.div
          className="summary-source-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="summary-source-header">
            <div>
              <span className="summary-small-label">SOURCE MATERIAL</span>
              <h3>📄 Reference Study Text</h3>
            </div>
            <span className="summary-word-count">
              {text.trim().split(/\s+/).filter(Boolean).length} words
            </span>
          </div>

          <div className="summary-source-text">
            {text.substring(0, 1000)}
            {text.length > 1000 && "..."}
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default SmartSummary;