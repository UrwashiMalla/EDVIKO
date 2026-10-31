import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { aiApi } from "../services/api";
import { useToast } from "../context/useToast";
import MarkdownRenderer from "./MarkdownRenderer";
import "./ImportantNotes.css";

function ImportantNotes({ onBack, language = "English", onLanguageChange, text = "", documentId = null, initialNotes = "", initialQuickNotes = "" }) {
  const { showToast } = useToast();
  const [notesType, setNotesType] = useState("important"); // "important" or "quick"
  const [notes, setNotes] = useState(initialNotes || "");
  const [quickNotes, setQuickNotes] = useState(initialQuickNotes || "");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState("");

  const generateNotes = useCallback(async (type = notesType, force = true) => {
    if (!text && !documentId) {
      setError("Please provide study material first.");
      showToast("Please provide study material first.", "warning");
      return;
    }

    setLoading(true);
    setLoadingMessage(force ? `Regenerating ${type === "quick" ? "quick revision" : "important"} notes...` : `Preparing notes in ${language}...`);
    setError("");

    try {
      if (type === "quick") {
        const data = await aiApi.getQuickNotes({
          documentId,
          text,
          language,
          forceRegenerate: force,
        });
        if (!data.success) throw new Error(data.message || "Failed to generate quick notes.");
        setQuickNotes(data.quickNotes);
        showToast(force ? "✓ Quick notes regenerated successfully" : `✓ Quick notes ready in ${language}`, "success");
      } else {
        const data = await aiApi.getImportantNotes({
          documentId,
          text,
          language,
          forceRegenerate: force,
        });
        if (!data.success) throw new Error(data.message || "Failed to generate important notes.");
        setNotes(data.notes);
        showToast(force ? "✓ Important notes regenerated successfully" : `✓ Important notes ready in ${language}`, "success");
      }
    } catch (err) {
      console.error("Notes Error:", err);
      const errMsg = err.message || "Unable to generate notes. Please check backend connection.";
      setError(errMsg);
      showToast(errMsg, "error");
    } finally {
      setLoading(false);
    }
  }, [documentId, language, notesType, text, showToast]);

  useEffect(() => {
    let ignore = false;
    if (documentId) {
      setLoading(true);
      setLoadingMessage(`Preparing ${notesType === "quick" ? "quick notes" : "study notes"} in ${language}...`);
      setError("");
      // Clear notes to prevent stale language text from lingering
      if (notesType === "quick") setQuickNotes("");
      else setNotes("");

      const fetchPromise =
        notesType === "quick"
          ? aiApi.getQuickNotes({ documentId, text, language, forceRegenerate: false })
          : aiApi.getImportantNotes({ documentId, text, language, forceRegenerate: false });

      fetchPromise
        .then((data) => {
          if (!ignore && data.success) {
            if (notesType === "quick" && data.quickNotes) {
              setQuickNotes(data.quickNotes);
              showToast(`✓ Quick notes loaded in ${language}`, "success");
            } else if (notesType === "important" && data.notes) {
              setNotes(data.notes);
              showToast(`✓ Important notes loaded in ${language}`, "success");
            }
          }
        })
        .catch((err) => {
          if (!ignore) {
            console.warn("Failed to load notes:", err.message);
            setError(err.message || "Failed to load notes.");
            showToast(err.message || "Failed to load notes.", "error");
          }
        })
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    }
    return () => {
      ignore = true;
    };
  }, [documentId, language, notesType, text, showToast]);

  const handleLanguageSelect = (newLang) => {
    if (newLang === language) return;
    showToast(`Switching language to ${newLang}...`, "info", 2000);
    if (onLanguageChange) {
      onLanguageChange(newLang);
    }
  };

  const currentContent = notesType === "quick" ? quickNotes : notes;

  return (
    <div className="notes-page">
      {/* Header */}
      <div className="notes-header">
        <button className="notes-back-btn" onClick={onBack} disabled={loading}>
          ← Back
        </button>

        <div className="notes-header-title">
          <span className="notes-header-icon">📚</span>
          <div>
            <h1>Study Notes</h1>
            <p>High-yield revision points powered by Groq AI</p>
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
        className="notes-hero"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="notes-hero-icon">📖</div>
        <div>
          <h2>Study smarter with structured notes</h2>
          <p>
            EDVIKO extracts essential definitions, formulas, and concepts tailored for exams.
          </p>
        </div>
      </motion.div>

      {/* Type Toggle Tabs */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
        <button
          onClick={() => {
            if (loading) return;
            setNotesType("important");
            if (!notes && documentId) generateNotes("important", false);
          }}
          disabled={loading}
          style={{
            padding: "10px 20px",
            borderRadius: "12px",
            border: "none",
            background: notesType === "important" ? "#7c3aed" : "#ede9fe",
            color: notesType === "important" ? "#fff" : "#5b21b6",
            fontWeight: "600",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
          }}
        >
          📌 Important Concepts
        </button>

        <button
          onClick={() => {
            if (loading) return;
            setNotesType("quick");
            if (!quickNotes && documentId) generateNotes("quick", false);
          }}
          disabled={loading}
          style={{
            padding: "10px 20px",
            borderRadius: "12px",
            border: "none",
            background: notesType === "quick" ? "#7c3aed" : "#ede9fe",
            color: notesType === "quick" ? "#fff" : "#5b21b6",
            fontWeight: "600",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
          }}
        >
          ⚡ Quick Revision Bullets
        </button>
      </div>

      {/* Action Card */}
      <motion.div
        className="notes-action-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div>
          <h3>{currentContent ? "Regenerate Notes" : "Generate AI Notes"}</h3>
          <p>
            Mode: <strong>{notesType === "quick" ? "Quick Revision" : "Comprehensive Important Notes"}</strong> • Language: <strong>{language}</strong>
          </p>
        </div>

        <button
          className="generate-notes-btn"
          onClick={() => generateNotes(notesType, true)}
          disabled={loading}
          style={{ opacity: loading ? 0.75 : 1, cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading ? "⏳ Processing..." : currentContent ? "🔄 Regenerate Notes" : "✨ Generate Notes"}
        </button>
      </motion.div>

      {/* Loading Skeleton */}
      {loading && (
        <motion.div
          className="lerniq-skeleton-card"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ margin: "24px 0" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <span style={{ fontSize: "24px", animation: "spin 2s linear infinite" }}>📚</span>
            <div>
              <strong style={{ fontSize: "16px", color: "#6b21a8" }}>{loadingMessage || "Generating Notes..."}</strong>
              <div style={{ fontSize: "13px", color: "#6b7280" }}>Synthesizing high-yield exam takeaways in {language} with Groq AI</div>
            </div>
          </div>
          <div className="lerniq-skeleton lerniq-skeleton-line" style={{ width: "90%" }} />
          <div className="lerniq-skeleton lerniq-skeleton-line" style={{ width: "95%" }} />
          <div className="lerniq-skeleton lerniq-skeleton-line" style={{ width: "75%" }} />
          <div className="lerniq-skeleton lerniq-skeleton-line" style={{ width: "85%", marginTop: "16px" }} />
          <div className="lerniq-skeleton lerniq-skeleton-line" style={{ width: "70%" }} />
        </motion.div>
      )}

      {/* Error */}
      {error && !loading && (
        <motion.div
          className="notes-error"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          ⚠️ {error}
        </motion.div>
      )}

      {/* Notes Content */}
      {!loading && currentContent && (
        <motion.div
          className="notes-content-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="notes-content-header">
            <div>
              <span className="notes-small-label">
                {notesType === "quick" ? "QUICK REVISION" : "IMPORTANT CONCEPTS"}
              </span>
              <h2>{notesType === "quick" ? "⚡ Quick High-Yield Points" : "📖 Exam-Focused Study Notes"}</h2>
            </div>
            <span className="notes-language-badge">{language}</span>
          </div>

          <div className="notes-body">
            <MarkdownRenderer content={currentContent} />
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default ImportantNotes;