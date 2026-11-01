import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth/mammoth.browser";
import { useAuth } from "../context/useAuth";
import { documentApi, aiApi } from "../services/api";
import { isNonStudyQuery, getAcademicRefusalMessage } from "../utils/academicGuardrail";
import { recognizeImageQuestion } from "../utils/imageOcrHelper";
import { extractTextFromFile, getFileCategory } from "../utils/documentExtractor";
import Navbar from "./Navbar";
import MarkdownRenderer from "./MarkdownRenderer";
import "./AIChatbot.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

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
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [imageOcrStatus, setImageOcrStatus] = useState("");
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docUploadStatus, setDocUploadStatus] = useState("");
  const [copiedIndex, setCopiedIndex] = useState(null);
  const fileInputRef = useRef(null);
  const docFileInputRef = useRef(null);

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

  
  // Image Upload & Handwritten Question Recognition
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsAnalyzingImage(true);
    setImageOcrStatus(`Reading handwritten notes from "${file.name}"...`);

    try {
      const extracted = await recognizeImageQuestion(file);

      const promptText = extracted && extracted.length > 5
        ? `[Uploaded handwritten question from notebook - Photo: ${file.name}]
Handwritten Question Extracted:
"${extracted}"

Please interpret and solve this handwritten question step-by-step with detailed explanation.`
        : `[Uploaded study image/diagram: ${file.name}]
I have uploaded an image of my handwritten notes/problem. Could you explain the key concepts and solve this problem?`;

      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";

      // Automatically send as query
      handleSendMessage(promptText);
    } catch (err) {
      console.warn("Handwriting image analysis failed:", err);
      handleSendMessage(`[Uploaded image: ${file.name}]
Could you help me understand this problem?`);
    } finally {
      setIsAnalyzingImage(false);
      setImageOcrStatus("");
    }
  };

  // Handle direct PDF/Doc/Code/Image upload in chat
  const handleDocUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingDoc(true);
    setDocUploadStatus(`Reading and extracting "${file.name}"...`);

    try {
      const fileCategory = getFileCategory(file);
      const extracted = await extractTextFromFile(file, (status) => {
        setDocUploadStatus(status);
      });

      setDocUploadStatus(`Saving "${file.name}" to study documents...`);

      const saveRes = await documentApi.create({
        title: file.name.replace(/\.[^/.]+$/, ""),
        originalFileName: file.name,
        fileType: fileCategory,
        fileSize: file.size,
        extractedText: extracted,
      });

      const newDocId = saveRes.document?.id || saveRes.document?._id;
      const newDocObj = {
        id: newDocId,
        title: file.name,
        originalFileName: file.name,
        extractedText: extracted,
      };

      setDocuments((prev) => [newDocObj, ...prev.filter((d) => d.id !== newDocId)]);
      setSelectedContext(newDocId);

      // Tailored confirmation message based on file category
      let uploadConfirmMsg = "";
      if (fileCategory === "code") {
        uploadConfirmMsg = `💻 **"${file.name}"** successfully upload ho gayi hai! 🚀\n\nAb bata bhai, is code ke baare mein kya janna hai? Tu pooch sakta hai:\n• **"is code ka logic samjha"**\n• **"bugs ya errors check kar"**\n• **"time aur space complexity bata"**\n• **"optimize kaise karein?"** 😄`;
      } else if (fileCategory === "image") {
        uploadConfirmMsg = `🖼️ **"${file.name}"** successfully upload aur OCR process ho gayi hai! 🔍\n\nAb bata bhai, is image / diagram mein se kya seekhna hai? Tu pooch sakta hai:\n• **"image me kya likha hai samjha"**\n• **"is question ko step-by-step solve karo"** 😄`;
      } else {
        uploadConfirmMsg = `📄 **"${file.name}"** successfully upload aur process ho gayi hai! 🎉\n\nAb bata bhai, kya sunna ya padhna hai? Tu pooch sakta hai:\n• **"bhai pdf suna"** (main poori file ka overview aur concepts samjha doonga)\n• **"is document ke important exam questions bata"**\n• Ya koi bhi specific topic pooch le! 😄`;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: uploadConfirmMsg,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch (err) {
      console.error("Document upload failed:", err);
      alert(`Document upload error: ${err.message || "Failed to process document"}`);
    } finally {
      setIsUploadingDoc(false);
      setDocUploadStatus("");
      if (docFileInputRef.current) docFileInputRef.current.value = "";
    }
  };

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

      // Check if user's question is asking to narrate/explain/summarize/debug a PDF, doc, code, or image
      const isDocOrStudyQuery = /\b(pdf|document|doc|docx|file|notes|code|coding|program|script|image|photo|diagram|kitab|suna|sunao|samjha|kya hai|explain|overview|summary|batao|bata|bug|bugs|error|logic)\b/i.test(text);

      let currentContextId = selectedContext;
      let currentDocuments = documents;

      // If document list is empty, refresh from backend (handles teacher uploads and recent student uploads)
      if (currentDocuments.length === 0) {
        try {
          const freshDocs = await documentApi.getMyDocuments();
          if (freshDocs.documents && freshDocs.documents.length > 0) {
            currentDocuments = freshDocs.documents;
            setDocuments(freshDocs.documents);
          }
        } catch (err) {
          console.warn("Could not fetch fresh documents:", err);
        }
      }

      // If context is general but user asks about PDF / notes OR documents exist, auto-select latest document!
      if (currentContextId === "general" && currentDocuments.length > 0) {
        const latestDoc = currentDocuments[0];
        currentContextId = latestDoc.id || latestDoc._id;
        setSelectedContext(currentContextId);
      }

      // Fetch extractedText for currentContextId
      if (currentContextId !== "general") {
        const foundDoc = currentDocuments.find((d) => d.id === currentContextId || d._id === currentContextId);
        if (foundDoc && foundDoc.extractedText) {
          contextText = foundDoc.extractedText;
        } else {
          try {
            const docRes = await documentApi.getById(currentContextId);
            contextText = docRes.document?.extractedText || "";
          } catch (e) {
            console.warn("Could not load full document text:", e);
          }
        }
      }

      // If user explicitly asks about their file/pdf/notes/code, but no document is found anywhere
      if (isDocOrStudyQuery && (!contextText || !contextText.trim()) && currentDocuments.length === 0) {
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: `Arre bhai! 😄 Lagta hai abhi tune koi PDF, Code file, Image, ya study notes upload nahi kiye hain.

Niche chat bar mein 📁 **Upload Doc / Code / Image** button par click karke apni file (PDF, DOCX, Code, Image ya Text) upload kar de, ya fir **Workspace** me upload kar le. 

Upload hote hi bolna *"bhai file samjha"* ya *"bhai pdf suna"* — main poora content, code logic, aur important concepts detail me samjha doonga! 🚀`,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
          setIsLoading(false);
        }, 400);
        return;
      }

      const langInstruction = getLanguageInstruction(language);
      const systemPrompt = `You are EDVIKO AI Tutor — a warm, intelligent, friendly, and patient academic assistant.

1. CORE IDENTITY:
- Supportive, knowledgeable tutor for students in academics, programming, math, physics, computer science, and exam prep.
- Communicate naturally like an intelligent human mentor, never like a cold robotic bot.

2. CONVERSATIONAL INTELLIGENCE & MULTI-TURN MEMORY:
- Understand complete context; remember earlier messages in the active conversation (e.g. "Types bata" -> types of ongoing subject, "Example bhi de" -> examples of those types).
- Use simple language before introducing technical terms.
- Use structured headings, bullet points, code blocks, and comparison tables.
- Never repeat generic greetings in every response.

3. FRIENDLY PERSONALITY:
- Warm, approachable, slightly humorous, supportive.
- Natural phrasing: "Haan bhai, samajhte hain.", "Chalo, step by step karte hain.", "Good question!", "Ek simple example se samajhte hain.", "Koi tension nahi, dobara explain karta hoon."
- Use emojis naturally (1-2 per turn max). Never arrogant or formal.
- Never pretend to be human or claim biological experiences or real-world emotions.

4. OFF-TOPIC CONVERSATIONS & BOUNDARIES:
- Never rudely reject small social interactions.
- If asked for shayari: share a lovely, encouraging shayari, then say: "Ab bata bhai, thodi shayari ho gayi. ❤️ Chalo, ab padhai par wapas aate hain. Aaj kya seekhna hai?"
- If asked for a joke: share a short, clean, funny student/teacher joke, then say: "Chalo bhai, ab padhai karte hain!"
- If student repeatedly asks for romance, gossip, or procrastination:
  • "Bhai, girlfriend kaise banate hain?" -> "Haha bhai! 😄 Ye topic thoda mere syllabus ke bahar hai. Main EDVIKO AI Tutor hoon, toh relationship advice mein zyada nahi jaa sakta. Chalo, ab batao, aaj kis subject ki class lagani hai?"
  • "Bas baatein karte hain, padhai nahi karni" -> "Arey bhai! 😂 Samajh raha hoon, kabhi-kabhi break bhi zaroori hota hai. Lekin mera main kaam teri padhai mein help karna hai. Chalo, ek chhota sa topic complete karte hain, phir break lena!"
- If student returns to studies after off-topic banter, transition smoothly back into teaching mode.

5. ACADEMIC ANSWER QUALITY:
- Academic flow: Direct answer -> Simple explanation -> Practical example -> Technical details/formulas -> Important exam points -> Brief follow-up check.
- Programming questions: Explain logic -> Clean working code -> Explain key sections -> Mention common errors/pitfalls.
- Exam preparation (e.g. "10-mark answer"): Provide structured university-style answer with definitions, diagrams, advantages, disadvantages, and applications.
- Accuracy: Never fabricate facts or citations. Correct false premises respectfully ("Achha ek chhota sa correction hai yahan...").
- Language: You MUST write your entire response strictly in ${langInstruction}.

6. PDF, CODE FILES, IMAGES & STUDY MATERIAL QUERIES ("bhai pdf suna", "code samjha", "file me kya hai", "meri pdf samjha", etc.):
- Whenever the student asks to "suna", explain, summarize, debug, or describe their uploaded PDF/document/code/image/notes (e.g. "bhai pdf suna", "code samjha de", "pdf me kya hai?", "meri file samjha de", "tell me about my file", "is code ka logic bata", "bugs dhoondho"):
  • Treat the provided [Uploaded Study Material Context] as their uploaded file/document/code.
  • If it is a code file (Python, C++, Java, JS, HTML, SQL, etc.):
    - Clearly explain what the code does, its architecture, and algorithmic logic step-by-step.
    - Highlight inputs, outputs, functions, and key libraries used.
    - Check for edge cases, potential bugs, time/space complexity (Big-O), and suggest improvements.
  • If it is a PDF / Document / Notes / Image:
    - Start with a warm, natural tutor opening: "Haan bhai! Tere uploaded study material mein ye main topics aur concepts hain: 😄" (or matching language).
    - Deliver a structured breakdown:
      1. 📌 Overview & Main Topic: What this document/file is about.
      2. 🔑 Core Concepts & Key Points: Clear, step-by-step breakdown of the main ideas.
      3. ⚡ Formulas, Definitions & Key Terms / Key Code Constructs.
      4. 🎯 Exam / Viva / Interview Highlights.
      5. Conclude with a helpful check: "Bata isme se kaunsa topic ya section detail me samjhau? 😄"
  • NEVER claim you cannot read or don't have access to the file when study material context is provided.
${contextText ? `\n\n[Uploaded Study Material Context]:\n${contextText.slice(0, 12000)}` : ""}`;

      const conversationPayload = [
        { role: "system", content: systemPrompt },
        ...messages.slice(-14).map((m) => ({ role: m.role, content: m.content })),
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
            max_tokens: 1600,
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
        documentId: currentContextId !== "general" ? currentContextId : null,
        history: messages.slice(-14).map((m) => ({ role: m.role, content: m.content })),
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

  const handleCopy = (text, index) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
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
    "📄 Bhai PDF suna",
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
                  {msg.role === "assistant" ? (
                    <MarkdownRenderer content={msg.content} />
                  ) : (
                    <div className="user-message-text">{msg.content}</div>
                  )}
                  <div className="message-footer">
                    <span>{msg.timestamp}</span>
                    {msg.role === "assistant" && (
                      <button
                        type="button"
                        className="copy-btn"
                        onClick={() => handleCopy(msg.content, index)}
                        title="Copy answer"
                      >
                        {copiedIndex === index ? "✓ Copied!" : "📋 Copy"}
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

          {/* Status banner when uploading / extracting PDF or DOCX */}
          {isUploadingDoc && (
            <div
              style={{
                background: "#ecfdf5",
                color: "#047857",
                padding: "8px 16px",
                fontSize: "12px",
                fontWeight: "700",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                borderTop: "1px solid #a7f3d0",
              }}
            >
              <span className="spinner-text">📄</span>
              <span>{docUploadStatus || "Reading and extracting document..."}</span>
            </div>
          )}

          {/* Status banner when analyzing handwritten image */}
          {isAnalyzingImage && (
            <div
              style={{
                background: "#ede9fe",
                color: "#6d28d9",
                padding: "8px 16px",
                fontSize: "12px",
                fontWeight: "700",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                borderTop: "1px solid #ddd6fe",
              }}
            >
              <span className="spinner-text">🔍</span>
              <span>{imageOcrStatus || "Analyzing pen handwriting in image..."}</span>
            </div>
          )}

          {/* INPUT BAR */}
          <div className="ai-chat-input-bar">
            {/* Upload PDF, Document, Code, or Image Button */}
            <label
              className={`chat-upload-btn pdf-upload-btn ${isUploadingDoc || isLoading ? "disabled" : ""}`}
              title="Upload PDF, DOCX, Code files (.py, .js, .cpp, .java, etc.), Images, or Text notes"
            >
              <span>📁</span>
              <span className="hide-on-mobile">{isUploadingDoc ? "Extracting..." : "Upload File / Code / Doc"}</span>
              <input
                ref={docFileInputRef}
                type="file"
                accept=".pdf,.docx,.doc,.txt,.md,.rtf,.csv,.json,.py,.js,.jsx,.ts,.tsx,.java,.cpp,.c,.cs,.html,.css,.sql,.php,.go,.rs,.rb,.sh,.xml,.yaml,.yml,.jpg,.jpeg,.png,.webp,image/*"
                onChange={handleDocUpload}
                disabled={isUploadingDoc || isLoading}
                style={{ display: "none" }}
              />
            </label>

            {/* Upload Handwritten Question Button */}
            <label
              className={`chat-upload-btn ${isAnalyzingImage || isLoading ? "disabled" : ""}`}
              title="Upload photo of handwritten notes or question written by pen"
            >
              <span>📷</span>
              <span className="hide-on-mobile">{isAnalyzingImage ? "Analyzing..." : "Upload Photo / Handwritten"}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={isAnalyzingImage || isLoading}
                style={{ display: "none" }}
              />
            </label>

            <textarea
              ref={textareaRef}
              className="chat-textarea"
              placeholder={`Ask your AI Tutor anything in ${language} or upload handwritten image... (Enter to send)`}
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
