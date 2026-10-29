import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { aiApi } from "../services/api";
import { useToast } from "../context/useToast";
import { isNonStudyQuery, getAcademicRefusalMessage } from "../utils/academicGuardrail";
import "./AITutor.css";

/**
 * Detects if a user message is a language-switch command
 * (e.g., "hindi", "hindi?", "in hindi", "hindi mein", "हिंदी में", "marathi?", "मराठीत", "hinglish?", "english?").
 */
const detectLanguageSwitch = (text) => {
  if (!text || typeof text !== "string") return null;
  const raw = text.trim();
  const cleaned = raw.toLowerCase().replace(/[?!.,;:]+$/, "").trim();

  // Academic / content queries should NOT be treated as switch commands
  const words = cleaned.split(/\s+/);
  if (words.length > 7) return null;

  if (/\b(history|origin|evolution|grammar|alphabet|script|author|literature|poet|founder|words count|percentage|population|state|country)\b/i.test(cleaned)) {
    return null;
  }
  if (/^(what|why|how|when|who|where|which|kya|kyu|kaise|kon|konta|kiti)\b/i.test(cleaned) && /\b(is|are|was|were|ahe|hote|hota|hai|tha|the)\b/i.test(cleaned)) {
    return null;
  }

  // Devanagari script direct matches
  if (/^(हिंदी|हिन्दी)(\s*(में|मे))?$/i.test(raw.trim().replace(/[?!.,;:]+$/, ""))) return "Hindi";
  if (/^(मराठी|मराठीत)(\s*(मध्ये|त))?$/i.test(raw.trim().replace(/[?!.,;:]+$/, ""))) return "Marathi";
  if (/^(इंग्रजी|इंग्लिश)(\s*(मध्ये|त))?$/i.test(raw.trim().replace(/[?!.,;:]+$/, ""))) return "English";

  const targets = [
    { lang: "Hinglish", regex: /\bhinglish\b/i },
    { lang: "Hindi", regex: /\bhindi\b/i },
    { lang: "Marathi", regex: /\bmarathi\b/i },
    { lang: "English", regex: /\benglish\b/i },
  ];

  for (const { lang, regex } of targets) {
    if (regex.test(cleaned)) {
      if (new RegExp(`^(in\\s+|to\\s+|into\\s+)?${lang.toLowerCase()}(\\s*(mein|me|bhasha|language|please))?$`, "i").test(cleaned)) {
        return lang;
      }
      if (/\b(switch|change|talk|speak|reply|respond|use|set|start|bol|bolo|sang|sanga)\b/i.test(cleaned)) {
        return lang;
      }
      if (words.length <= 4 && !/\b(explain|what|summary|notes|quiz|material|pdf|document)\b/i.test(cleaned)) {
        return lang;
      }
    }
  }

  return null;
};

function AITutor({ onBack, language = "English", onLanguageChange, text = "", documentId = null }) {
  const { showToast } = useToast();
  const [activeLanguage, setActiveLanguage] = useState(language || "English");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Sync activeLanguage if prop language changes externally
  useEffect(() => {
    if (language && language !== activeLanguage) {
      setActiveLanguage(language);
    }
  }, [language]);

  // Auto-scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Load conversation history on mount
  useEffect(() => {
    let ignore = false;
    const fetchHistory = async () => {
      if (!documentId) return;
      try {
        const res = await aiApi.getTutorHistory(documentId, activeLanguage);
        if (!ignore && res.messages && res.messages.length > 0) {
          // Never overwrite if user has already begun chatting
          setMessages((prev) => (prev.length === 0 ? res.messages : prev));
        }
      } catch (err) {
        if (!ignore) {
          console.warn("Failed to load chat history:", err.message);
        }
      }
    };
    fetchHistory();
    return () => {
      ignore = true;
    };
  }, [documentId]);

  const askTutor = async (customQuestion = null) => {
    const qText = customQuestion || question || textareaRef.current?.value || "";
    if (!qText.trim() || loading) return;

    if (!text && !documentId) {
      setError("Please provide study material first.");
      showToast("Please provide study material first.", "warning");
      return;
    }

    const userQuestion = qText.trim();
    setQuestion("");
    if (textareaRef.current) textareaRef.current.value = "";
    setError("");

    // 1. Language-Switch Intent Detection BEFORE Document QA
    const switchedLang = detectLanguageSwitch(userQuestion);
    if (switchedLang) {
      const switchFeedback = `Language switched to ${switchedLang}.`;
      setActiveLanguage(switchedLang);
      if (onLanguageChange) {
        onLanguageChange(switchedLang);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "user",
          content: userQuestion,
        },
        {
          role: "assistant",
          content: switchFeedback,
          language: switchedLang,
        },
      ]);

      showToast(switchFeedback, "info", 2000);

      // Persist switch turn to backend asynchronously
      if (documentId) {
        aiApi.askTutor({
          documentId,
          text,
          question: userQuestion,
          language: switchedLang,
        }).catch((err) => {
          console.warn("Language switch sync:", err.message);
        });
      }

      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      return;
    }

    // 2. Regular Query with Document Grounding
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: userQuestion,
      },
    ]);

    // Academic Study-Only Guardrail Check
    if (isNonStudyQuery(userQuestion)) {
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: getAcademicRefusalMessage(activeLanguage),
            language: activeLanguage,
          },
        ]);
        setLoading(false);
      }, 250);
      return;
    }

    setLoading(true);

    try {
      const data = await aiApi.askTutor({
        documentId,
        text,
        question: userQuestion,
        language: activeLanguage,
      });

      if (!data.success) {
        throw new Error(data.message || "Failed to get AI Tutor response.");
      }

      if (data.isLanguageSwitch && data.language) {
        setActiveLanguage(data.language);
        if (onLanguageChange) {
          onLanguageChange(data.language);
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          language: data.language || activeLanguage,
        },
      ]);
    } catch (err) {
      console.error("AI Tutor Error:", err);
      const errMsg = err.message || "Unable to get AI Tutor response. Please check connection.";
      setError(errMsg);
      showToast(errMsg, "error");
    } finally {
      setLoading(false);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      askTutor();
    }
  };

  const clearChat = async () => {
    if (documentId) {
      try {
        await aiApi.clearTutorHistory(documentId, activeLanguage);
        showToast("✓ Chat history cleared", "info");
      } catch (err) {
        console.warn("Failed to clear chat on backend:", err.message);
      }
    }
    setMessages([]);
    setError("");
  };

  const handleLanguageSelect = (newLang) => {
    if (newLang === activeLanguage) return;
    setActiveLanguage(newLang);
    showToast(`Language switched to ${newLang}.`, "info", 2000);
    if (onLanguageChange) {
      onLanguageChange(newLang);
    }
  };

  return (
    <div className="ai-tutor-page">
      {/* HEADER */}
      <div className="ai-tutor-header">
        <button className="ai-tutor-back-btn" onClick={onBack} disabled={loading}>
          ← Back
        </button>

        <div className="ai-tutor-title">
          <span className="ai-tutor-title-icon">💬</span>
          <div>
            <h1>EDVIKO AI Tutor ({activeLanguage})</h1>
            <p>Interactive study tutor constrained strictly to your document</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <select
            value={activeLanguage}
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
            }}
          >
            <option value="English">🇬🇧 English</option>
            <option value="Hindi">🇮🇳 Hindi</option>
            <option value="Marathi">🇮🇳 Marathi</option>
            <option value="Hinglish">💬 Hinglish</option>
          </select>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="ai-tutor-container">
        {/* WELCOME SCREEN */}
        {messages.length === 0 && (
          <motion.div
            className="ai-tutor-welcome"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="ai-tutor-welcome-icon">🤖</div>
            <h2>Hi! I'm your EDVIKO AI Tutor</h2>
            <p>
              Ask me anything about your uploaded study material. I explain concepts simply and accurately based strictly on your document.
            </p>

            <div className="ai-tutor-suggestions">
              <button
                onClick={() => askTutor("Explain this topic in simple words.")}
                disabled={loading}
              >
                💡 Explain this topic
              </button>

              <button
                onClick={() => askTutor("What are the most important points?")}
                disabled={loading}
              >
                📌 Important points
              </button>

              <button
                onClick={() => askTutor("Give me a practical example of this topic.")}
                disabled={loading}
              >
                📚 Give an example
              </button>
            </div>
          </motion.div>
        )}

        {/* CHAT MESSAGES */}
        {messages.length > 0 && (
          <div className="ai-tutor-chat">
            {messages.map((message, index) => (
              <motion.div
                key={index}
                className={`ai-tutor-message ${
                  message.role === "user"
                    ? "user-message"
                    : "assistant-message"
                }`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className="message-avatar">
                  {message.role === "user" ? "👨‍🎓" : "🤖"}
                </div>

                <div className="message-content">
                  <span className="message-name">
                    {message.role === "user" ? "You" : `EDVIKO AI Tutor (${message.language || activeLanguage})`}
                  </span>
                  <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                    {message.content}
                  </p>
                </div>
              </motion.div>
            ))}

            {loading && (
              <motion.div
                className="ai-tutor-message assistant-message"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="message-avatar">🤖</div>
                <div className="message-content">
                  <span className="message-name">EDVIKO AI Tutor ({activeLanguage})</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                    <span style={{ fontSize: "14px", color: "#6b21a8", fontWeight: "500" }}>
                      Analyzing document & thinking...
                    </span>
                    <span style={{ animation: "pulse 1.5s infinite" }}>💭</span>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div className="ai-tutor-error">
            ⚠️ {error}
          </div>
        )}

        {/* INPUT */}
        <div className="ai-tutor-input-area">
          <textarea
            ref={textareaRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              activeLanguage === "Hinglish"
                ? "Study material ke baare me kuch bhi poochhein... (Enter to send, Shift+Enter for newline)"
                : activeLanguage === "Hindi"
                ? "अध्ययन सामग्री के बारे में कोई भी प्रश्न पूछें... (Enter to send)"
                : activeLanguage === "Marathi"
                ? "अभ्यास साहित्याबद्दल काहीही विचारा... (Enter to send)"
                : "Ask your question about the study material... (Enter to send, Shift+Enter for newline)"
            }
            rows="2"
            disabled={loading}
          />

          <button
            className="ai-tutor-send-btn"
            onClick={() => askTutor()}
            disabled={loading}
            style={{ opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "..." : "➤"}
          </button>
        </div>

        {/* BOTTOM ACTIONS */}
        {messages.length > 0 && (
          <div className="ai-tutor-bottom">
            <span>🤖 Answers are strictly constrained to your uploaded study material</span>
            <button onClick={clearChat} disabled={loading}>🗑️ Clear Chat</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AITutor;