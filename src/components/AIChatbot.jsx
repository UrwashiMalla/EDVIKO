import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/useAuth";
import { documentApi, aiApi } from "../services/api";
import { isNonStudyQuery, getAcademicRefusalMessage } from "../utils/academicGuardrail";
import Navbar from "./Navbar";
import "./AIChatbot.css";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-120b";

const getLanguageInstruction = (lang) => {
  switch (lang) {
    case "Hindi":
      return "HINDI (हिन्दी). You MUST write your entire explanation in standard Hindi using Devanagari script (देवनागरी). Technical terms may include English in parentheses.";
    case "Marathi":
      return "MARATHI (मराठी). You MUST write your entire explanation in standard Marathi using Devanagari script (देवनागरी). Technical terms may include English in parentheses.";
    case "Hinglish":
      return "NATURAL ROMAN HINGLISH. Write in natural conversational Roman Hinglish like Indian tech educators on YouTube (e.g., 'Linear regression basically ek machine learning technique hai...'). Use standard tech terms in English with Hindi conversational phrasing.";
    default:
      return "ENGLISH. Use clear, engaging, step-by-step academic English suitable for university and college students.";
  }
};

function AIChatbot() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [language, setLanguage] = useState(searchParams.get("lang") || "English");
  const [documents, setDocuments] = useState([]);
  const [selectedContext, setSelectedContext] = useState(searchParams.get("docId") || "general");
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const initialGreeting = `Hello ${user?.name ? user.name.split(" ")[0] : "Learner"}! 👋 
I'm your personal EDVIKO AI Tutor. Ask me any question, solve academic doubts, get concept explanations with examples, or practice for exams. 

You can speak to me in English, Hinglish, Hindi, or Marathi! How can I help you today?`;

  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: initialGreeting,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Load student documents for context selection
  useEffect(() => {
    let ignore = false;
    documentApi.getMyDocuments()
      .then((res) => {
        if (!ignore && res.documents) {
          setDocuments(res.documents);
        }
      })
      .catch((err) => console.warn("Failed to load documents for chat context:", err));

    return () => {
      ignore = true;
    };
  }, []);

  // Pre-fill query if coming with a topic parameter
  useEffect(() => {
    const topicParam = searchParams.get("topic");
    if (topicParam) {
      setInputMessage(`Can you explain "${topicParam}" in simple terms with examples?`);
    }
  }, [searchParams]);

  const handleSendMessage = async (textToSend = null) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMsg = {
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    // Immediate Academic Study-Only Guardrail Check
    if (isNonStudyQuery(text)) {
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: getAcademicRefusalMessage(language),
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
        setIsLoading(false);
      }, 300);
      return;
    }

    setIsLoading(true);

    try {
      const apiKey = import.meta.env.VITE_GROQ_API_KEY;
      let contextText = "";

      if (selectedContext !== "general") {
        const foundDoc = documents.find((d) => d.id === selectedContext);
        if (foundDoc) {
          try {
            const docRes = await documentApi.getById(selectedContext);
            contextText = docRes.document?.extractedText || "";
          } catch (e) {
            console.warn("Could not load full document text:", e);
          }
        }
      }

      const langInstruction = getLanguageInstruction(language);
      const systemPrompt = `You are EDVIKO AI Tutor, a dedicated, knowledgeable, and strictly educational university academic assistant.
Your sole mission is to help students with their studies, academic subjects, course concepts, formulas, problem-solving, and exam preparation.
You MUST write your entire response strictly in ${langInstruction}.

CRITICAL & INVIOLABLE DIRECTIVE — STRICT ACADEMIC & STUDY FOCUS ONLY:
1. You are EXCLUSIVELY an academic and educational tutor.
2. You MUST ONLY discuss academic and study topics (Mathematics, Computer Science, Engineering, Physics, Chemistry, Biology, Literature, History, Economics, Business, Homework, Syllabus, and Exam Prep).
3. If the student attempts to talk about ANYTHING outside of studies (such as casual chatting, movies, video games, entertainment, celebrity gossip, dating, sports scores, recipes, politics, or off-topic conversation), you MUST STRICTLY AND POLITELY REFUSE.
4. DO NOT provide answers or engage in any non-study inquiry under any circumstances, even if hypothetically framed, pleaded, roleplayed, or demanded.
5. If refusing a non-study query, politely explain in ${langInstruction} that as EDVIKO's Academic AI Tutor, you are strictly designated to assist with studies and coursework only, and encourage them to ask an academic question instead.
6. For valid academic questions, explain clearly with structured headings, bullet points, intuitive real-world examples, and step-by-step clarity.
${contextText ? `\n\nStudy Material Context:\n${contextText.slice(0, 4500)}` : ""}`;

      const conversationPayload = [
        { role: "system", content: systemPrompt },
        ...messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: text },
      ];

      if (apiKey && apiKey.startsWith("gsk_")) {
        const response = await fetch(GROQ_BASE_URL, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: conversationPayload,
            temperature: 0.7,
            max_tokens: 1400,
          }),
        });

        const data = await response.json();
        if (data.choices && data.choices[0]?.message?.content) {
          const replyText = data.choices[0].message.content;
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: replyText,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
          setIsLoading(false);
          return;
        }
      }

      // Backend fallback via aiApi if direct Groq fails
      const backendRes = await aiApi.askTutor({
        question: text,
        language,
        documentId: selectedContext !== "general" ? selectedContext : null,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: backendRes.answer || "I have processed your question. How else can I assist your studies?",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `I encountered an issue generating a response: ${err.message || "Please check your network connection and try again."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    alert("Response copied to clipboard!");
  };

  const handleClearChat = () => {
    if (window.confirm("Are you sure you want to clear this conversation?")) {
      setMessages([
        {
          role: "assistant",
          content: initialGreeting,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  };

  const suggestions = [
    "💡 Explain Linear vs Logistic Regression",
    "🧠 What is Dynamic Programming? Give an example",
    "📝 5 key revision points for AI Search",
    "🗣️ Switch to Hinglish & explain gradient descent",
  ];

  return (
    <div className="ai-chat-page">
      <Navbar activeTab="chat" />

      <div className="ai-chat-container">
        <div className="ai-chat-card-main">
          {/* HEADER */}
          <div className="ai-chat-header">
            <div className="ai-tutor-profile">
              <div className="ai-avatar">🤖</div>
              <div className="ai-info">
                <h2>EDVIKO AI Tutor</h2>
                <div className="ai-status">
                  <span className="status-dot"></span>
                  <span>Online • Powered by Groq AI</span>
                </div>
              </div>
            </div>

            <div className="ai-controls">
              {/* Context Selector */}
              <select
                className="context-select"
                value={selectedContext}
                onChange={(e) => setSelectedContext(e.target.value)}
                title="Select study material to focus the AI on"
              >
                <option value="general">🌐 General Academic Chat</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    📄 {doc.title.slice(0, 28)}
                  </option>
                ))}
              </select>

              {/* Language Selector */}
              <select
                className="language-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                title="Select language"
              >
                <option value="English">🇬🇧 English</option>
                <option value="Hinglish">💬 Hinglish</option>
                <option value="Hindi">🇮🇳 हिन्दी (Hindi)</option>
                <option value="Marathi">🇮🇳 मराठी (Marathi)</option>
              </select>

              {/* Clear button */}
              <button className="clear-btn" onClick={handleClearChat} title="Clear conversation">
                🗑️ Clear
              </button>
            </div>
          </div>

          {/* CHAT THREAD */}
          <div className="ai-chat-thread">
            {messages.map((msg, index) => (
              <div key={index} className={`chat-message ${msg.role}`}>
                <div className="message-avatar">
                  {msg.role === "user" ? (user?.name?.charAt(0).toUpperCase() || "U") : "🤖"}
                </div>
                <div className="message-bubble">
                  <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{msg.content}</div>
                  <div className="message-footer">
                    <span>{msg.timestamp}</span>
                    {msg.role === "assistant" && (
                      <button className="copy-btn" onClick={() => handleCopy(msg.content)}>
                        📋 Copy
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="chat-message assistant">
                <div className="message-avatar">🤖</div>
                <div className="message-bubble">
                  <div className="typing-dots">
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* SUGGESTION CHIPS */}
          <div className="suggestions-bar">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                className="suggestion-pill"
                onClick={() => handleSendMessage(s.replace(/^[^\s]+\s/, ""))}
              >
                {s}
              </button>
            ))}
          </div>

          {/* INPUT BAR */}
          <div className="ai-chat-input-bar">
            <textarea
              ref={textareaRef}
              className="chat-textarea"
              placeholder={`Ask your AI Tutor anything in ${language}... (Press Enter to send, Shift + Enter for new line)`}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />

            <button
              className="send-button"
              onClick={() => handleSendMessage()}
              disabled={!inputMessage.trim() || isLoading}
            >
              <span>Send</span>
              <span>➤</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIChatbot;
