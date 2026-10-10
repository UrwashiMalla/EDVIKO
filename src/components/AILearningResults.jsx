import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { documentApi } from "../services/api";

import SmartSummary from "./SmartSummary";
import ImportantNotes from "./ImportantNotes";
import QuestionGenerator from "./QuestionGenerator";
import SmartMCQQuiz from "./SmartMCQQuiz";
import AITutor from "./AITutor";

import "./AILearningResults.css";

function AILearningResults({ documentId: propDocId, language: propLanguage, text: propText }) {
  const { id: paramDocId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const activeDocId = paramDocId || propDocId;
  const initialLanguage = searchParams.get("lang") || propLanguage || "English";

  const [language, setLanguage] = useState(initialLanguage);
  const [tool, setTool] = useState("hub"); // "hub", "summary", "notes", "questions", "quiz", "tutor"
  const [docData, setDocData] = useState(null);
  const [loading, setLoading] = useState(Boolean(activeDocId));
  const [error, setError] = useState("");

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    setSearchParams({ lang: newLang });
  };

  useEffect(() => {
    const fetchDoc = async () => {
      if (!activeDocId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await documentApi.getById(activeDocId, language);
        if (res.document) {
          setDocData(res);
        }
      } catch (err) {
        console.error("Failed to fetch document:", err);
        setError(err.message || "Failed to load document.");
      } finally {
        setLoading(false);
      }
    };

    fetchDoc();
  }, [activeDocId, language]);

  const studyText = docData?.document?.extractedText || propText || "";
  const docTitle = docData?.document?.title || "Study Material";

  const tools = [
    {
      icon: "📝",
      title: "Smart Summary",
      description: "Understand your document with a short and clear AI-generated executive summary.",
      button: "Open Summary",
      type: "summary",
    },
    {
      icon: "📚",
      title: "Important Notes",
      description: "Extract important concepts, definitions, formulas, and revision points from your material.",
      button: "View Notes",
      type: "notes",
    },
    {
      icon: "❓",
      title: "Question Generator",
      description: "Generate exactly 10 practice questions based strictly on your study material.",
      button: "View Questions",
      type: "questions",
    },
    {
      icon: "🧠",
      title: "Smart MCQ Quiz",
      description: "Practice your understanding with 10 multiple-choice questions, instant score, and explanations.",
      button: "Start Quiz",
      type: "quiz",
    },
    {
      icon: "💬",
      title: "AI Tutor",
      description: "Ask questions about your uploaded document and get multi-turn conversational explanations.",
      button: "Chat with Tutor",
      type: "tutor",
    },
  ];

  if (loading && !docData) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#faf9ff" }}>
        <div style={{ fontSize: "18px", fontWeight: "600", color: "#7c3aed" }}>
          ⏳ Loading your study material...
        </div>
      </div>
    );
  }

  // Subviews for individual AI tools
  if (tool === "summary") {
    return (
      <SmartSummary
        key={`summary-${language}`}
        documentId={activeDocId}
        text={studyText}
        language={language}
        onLanguageChange={handleLanguageChange}
        initialSummary={docData?.language === language ? docData?.aiResult?.summary : ""}
        onBack={() => setTool("hub")}
      />
    );
  }

  if (tool === "notes") {
    return (
      <ImportantNotes
        key={`notes-${language}`}
        documentId={activeDocId}
        text={studyText}
        language={language}
        onLanguageChange={handleLanguageChange}
        initialNotes={docData?.language === language ? docData?.aiResult?.importantNotes : ""}
        initialQuickNotes={docData?.language === language ? docData?.aiResult?.quickNotes : ""}
        onBack={() => setTool("hub")}
      />
    );
  }

  if (tool === "questions") {
    return (
      <QuestionGenerator
        key={`questions-${language}`}
        documentId={activeDocId}
        text={studyText}
        language={language}
        onLanguageChange={handleLanguageChange}
        initialQuestions={docData?.language === language ? docData?.aiResult?.questions : []}
        onBack={() => setTool("hub")}
      />
    );
  }

  if (tool === "quiz") {
    return (
      <SmartMCQQuiz
        key={`quiz-${language}`}
        documentId={activeDocId}
        text={studyText}
        language={language}
        onLanguageChange={handleLanguageChange}
        initialQuiz={docData?.language === language ? docData?.quiz : null}
        onBack={() => setTool("hub")}
      />
    );
  }

  if (tool === "tutor") {
    return (
      <AITutor
        key={`tutor-${activeDocId}`}
        documentId={activeDocId}
        text={studyText}
        language={language}
        onLanguageChange={handleLanguageChange}
        onBack={() => setTool("hub")}
      />
    );
  }

  // Hub View
  return (
    <div className="ai-results-page">
      {/* HEADER */}
      <div className="ai-results-header">
        <button
          className="ai-back-btn"
          onClick={() => navigate("/student/documents")}
        >
          ← My Documents
        </button>

        <div className="ai-results-title">
          <span className="ai-results-icon">✨</span>
          <div>
            <h1>{docTitle}</h1>
            <p>AI Learning Toolkit Powered by Groq AI</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <select
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value);
              setSearchParams({ lang: e.target.value });
            }}
            style={{
              padding: "6px 12px",
              borderRadius: "10px",
              border: "1px solid #d8b4fe",
              background: "#fff",
              color: "#6b21a8",
              fontSize: "13px",
              fontWeight: "600",
            }}
          >
            <option value="English">🇬🇧 English</option>
            <option value="Hindi">🇮🇳 Hindi</option>
            <option value="Marathi">🇮🇳 Marathi</option>
            <option value="Hinglish">💬 Hinglish</option>
          </select>
        </div>
      </div>

      {error && (
        <div style={{ margin: "20px auto", maxWidth: "1200px", padding: "14px 20px", background: "#fef2f2", color: "#b91c1c", borderRadius: "12px" }}>
          ⚠️ {error}
        </div>
      )}

      {/* HERO SECTION */}
      <motion.div
        className="ai-results-hero"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="ai-hero-icon">🤖</div>
        <div>
          <h2>Your AI study companion is ready</h2>
          <p>
            Choose any tool below to generate summaries, review structured notes, test your memory with MCQs, or chat with your AI Tutor.
          </p>
          {docData?.document?.wordCount && (
            <div style={{ marginTop: "8px", fontSize: "13px", color: "#6b7280" }}>
              Document statistics: <strong>{docData.document.wordCount} words</strong> • Uploaded {new Date(docData.document.uploadDate).toLocaleDateString()}
            </div>
          )}
        </div>
      </motion.div>

      {/* AI TOOLS GRID */}
      <div className="ai-tools-grid">
        {tools.map((toolItem, index) => (
          <motion.div
            className="ai-tool-card"
            key={toolItem.title}
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
            onClick={() => setTool(toolItem.type)}
            style={{ cursor: "pointer" }}
          >
            <div className="ai-tool-icon">{toolItem.icon}</div>
            <h3>{toolItem.title}</h3>
            <p>{toolItem.description}</p>
            <button className="ai-tool-btn">
              {toolItem.button} <span>→</span>
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default AILearningResults;