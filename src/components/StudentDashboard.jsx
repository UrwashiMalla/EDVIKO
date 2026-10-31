import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { studentApi } from "../services/api";
import {
  getTeacherBroadcasts,
  getDirectMessages,
  sendDirectMessage,
  getInstitutionName,
  getStudentPopups,
  dismissStudentPopup,
  onLerniqSync,
} from "../services/frontendStorage";
import Navbar from "./Navbar";
import studentImage from "../assets/student/student.png";
import "./StudentDashboard.css";

function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Frontend messaging state
  const [showAnnouncementsModal, setShowAnnouncementsModal] = useState(false);
  const [showMessageTeacherModal, setShowMessageTeacherModal] = useState(false);
  const [broadcasts, setBroadcasts] = useState([]);
  const [directMessages, setDirectMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [toastNotice, setToastNotice] = useState("");
  const [activePopup, setActivePopup] = useState(null);
  const messagesEndRef = useRef(null);

  const studentKey = user?.id || user?._id || user?.email || "default_student";

  const loadAllMessages = async () => {
    // 1. Local fallback
    setBroadcasts(getTeacherBroadcasts());
    setDirectMessages(getDirectMessages(studentKey));

    // 2. Fetch remote broadcasts and messages from MongoDB
    try {
      const [bRes, dmRes] = await Promise.all([
        studentApi.getBroadcasts().catch(() => ({ broadcasts: [] })),
        studentApi.getDirectMessages().catch(() => ({ messages: [] })),
      ]);

      if (bRes && bRes.broadcasts && bRes.broadcasts.length > 0) {
        const formattedBroadcasts = bRes.broadcasts.map((b) => ({
          id: b._id,
          title: b.title,
          content: b.text,
          priority: b.priority,
          tag: b.tag,
          teacherName: b.senderName,
          date: new Date(b.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
        }));
        setBroadcasts(formattedBroadcasts);
      }

      if (dmRes && dmRes.messages && dmRes.messages.length > 0) {
        const formattedDMs = dmRes.messages.map((m) => ({
          id: m._id,
          studentId: studentKey,
          studentName: user?.name || "Student",
          senderRole: m.senderRole,
          senderName: m.senderName,
          text: m.text,
          timestamp: new Date(m.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
        }));
        setDirectMessages(formattedDMs);
      }
    } catch (err) {
      console.warn("Could not sync remote messages:", err.message);
    }
  };

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await studentApi.getDashboard();
        setDashboardData(res);
      } catch (err) {
        console.warn("Failed to load dashboard statistics:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
    loadAllMessages();

    const initialPopups = getStudentPopups(studentKey, user?.email);
    if (initialPopups.length > 0) {
      setActivePopup(initialPopups[0]);
    }

    const unsubscribe = onLerniqSync((detail) => {
      if (
        detail.type === "BROADCAST_CREATED" ||
        detail.type === "NOTE_UPLOADED" ||
        detail.type === "LECTURE_UPLOADED" ||
        detail.type === "QUIZ_UPLOADED" ||
        detail.type === "NEW_STUDENT_POPUP" ||
        detail.type === "DIRECT_MESSAGE"
      ) {
        const updated = getStudentPopups(studentKey, user?.email);
        if (updated.length > 0) {
          setActivePopup(updated[0]);
        }
        loadAllMessages();
      }
    });
    return unsubscribe;
  }, [studentKey, user?.email]);

  useEffect(() => {
    if (showMessageTeacherModal) {
      loadAllMessages();
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [showMessageTeacherModal, studentKey]);

  const handleDismissPopup = (popupId) => {
    dismissStudentPopup(popupId);
    const remaining = getStudentPopups(studentKey, user?.email).filter((p) => p.id !== popupId);
    setActivePopup(remaining.length > 0 ? remaining[0] : null);
  };

  const handleSendDirectMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim()) return;

    const text = messageInput.trim();

    // 1. Send via backend API to store in MongoDB
    try {
      await studentApi.sendDirectMessage({ text });
    } catch (err) {
      console.warn("Backend student DM error:", err.message);
    }

    // 2. Also save to frontend storage and dispatch event
    const updated = sendDirectMessage(studentKey, {
      senderRole: "student",
      senderName: user?.name || "Student",
      text,
      studentName: user?.name || "Student",
      studentEmail: user?.email,
    });

    setDirectMessages(updated);
    setMessageInput("");
    setToastNotice("Direct message sent to teacher!");
    setTimeout(() => setToastNotice(""), 3000);
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 80);
  };

  // 3D mouse movement
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateY = useSpring(useTransform(mouseX, [-400, 400], [-8, 8]), {
    stiffness: 120,
    damping: 18,
  });

  const rotateX = useSpring(useTransform(mouseY, [-300, 300], [7, -7]), {
    stiffness: 120,
    damping: 18,
  });

  const handleMouseMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    mouseX.set(event.clientX - (rect.left + rect.width / 2));
    mouseY.set(event.clientY - (rect.top + rect.height / 2));
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const stats = dashboardData?.stats || {
    totalDocuments: 0,
    totalQuizzesAttempted: 0,
    averageScore: 0,
    totalQuestionsCompleted: 0,
  };

  const recentDocuments = dashboardData?.recentDocuments || [];
  const recentQuizResults = dashboardData?.recentQuizResults || [];
  const teacherInfo = dashboardData?.profile?.teacherId;

  return (
    <div className="student-dashboard">
      {/* ================= NAVBAR ================= */}
      <Navbar activeTab="dashboard" />

      {/* ================= HERO ================= */}
      <section
        className="dashboard-hero"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <motion.div
          className="hero-circle circle-one"
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="hero-circle circle-two"
          animate={{ x: [0, 20, 0], y: [0, -10, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="hero-circle circle-three" />

        {/* LEFT CONTENT */}
        <motion.div
          className="hero-content"
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
        >
          <motion.div
            className="ai-badge"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            ✨ POWERED BY GROQ AI
          </motion.div>

          <h1>
            Welcome Back,
            <br />
            <span>{user?.name ? user.name.split(" ")[0] : "Learner"}!</span> 👋
          </h1>

          <p className="hero-description">
            Transform textbook chapters and lecture notes into smart summaries, practice questions, and interactive quizzes.
          </p>

          {/* QUICK ACTION BUTTONS */}
          <motion.div style={{ marginTop: "24px", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            <motion.button
              onClick={() => navigate("/student/quizzes")}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: "13px 20px",
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#fff",
                border: "none",
                borderRadius: "14px",
                fontWeight: "700",
                fontSize: "14px",
                cursor: "pointer",
                boxShadow: "0 10px 25px -5px rgba(16, 185, 129, 0.4)",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>🎯 Take Class Quizzes</span>
              <span>→</span>
            </motion.button>

            <motion.button
              onClick={() => navigate("/student/workspace")}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: "13px 22px",
                background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                color: "#fff",
                border: "none",
                borderRadius: "14px",
                fontWeight: "600",
                fontSize: "14px",
                cursor: "pointer",
                boxShadow: "0 10px 25px -5px rgba(124, 58, 237, 0.4)",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>📄 Upload Study Material</span>
              <span>→</span>
            </motion.button>

            <motion.button
              onClick={() => setShowAnnouncementsModal(true)}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: "13px 18px",
                background: "#f5f3ff",
                color: "#6d28d9",
                border: "1.5px solid #ddd6fe",
                borderRadius: "14px",
                fontWeight: "700",
                fontSize: "14px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 12px rgba(109, 40, 217, 0.08)",
              }}
            >
              <span>📢 Teacher Announcements</span>
              <span style={{ background: "#7c3aed", color: "#fff", fontSize: "11px", padding: "2px 8px", borderRadius: "10px" }}>
                {broadcasts.length}
              </span>
            </motion.button>

            <motion.button
              onClick={() => setShowMessageTeacherModal(true)}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: "13px 18px",
                background: "#ffffff",
                color: "#1e293b",
                border: "1.5px solid #e2e8f0",
                borderRadius: "14px",
                fontWeight: "700",
                fontSize: "14px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.04)",
              }}
            >
              <span>💬 Message Teacher Personally</span>
              <span style={{ fontSize: "11px", color: "#059669", background: "#ecfdf5", padding: "2px 6px", borderRadius: "6px", fontWeight: "700" }}>🔒 1-on-1</span>
            </motion.button>
          </motion.div>

          {teacherInfo && (
            <div style={{ marginTop: "20px", fontSize: "14px", color: "#6b7280" }}>
              Assigned Faculty: <strong style={{ color: "#4c1d95" }}>{teacherInfo.name}</strong> ({teacherInfo.email})
            </div>
          )}
        </motion.div>

        {/* ================= 3D STUDENT ================= */}
        <div className="hero-student">
          <motion.div
            className="student-glow"
            animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />

          <motion.div
            className="student-3d-wrapper"
            style={{ rotateX, rotateY }}
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <img
              src={studentImage}
              alt="Student learning with EDVIKO"
              className="dashboard-student-image"
            />
          </motion.div>

          <motion.div
            className="better-students-note"
            animate={{ y: [0, -7, 0], rotate: [-5, -3, -5] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <span>
              Better
              <br />
              Students
              <br />
              Brighter
              <br />
              Futures
            </span>
            <div className="note-underline">╱╲</div>
          </motion.div>
        </div>

        {/* ================= AI CHATBOT CARD ================= */}
        <motion.div
          className="hero-quote ai-chat-card"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <div className="quote-badge">AI CHATBOT 💜</div>
          <div style={{ fontSize: "28px", marginTop: "4px", marginBottom: "8px" }}>🤖</div>
          <h3 style={{ margin: "0 0 8px 0", fontSize: "19px", fontWeight: "800", color: "#1e1b4b", lineHeight: 1.25 }}>
            Interactive AI Study Chat
          </h3>
          <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#64748b", lineHeight: 1.45, fontWeight: "500" }}>
            Talk directly with your personal AI Tutor. Ask doubts, clarify lecture concepts, and learn anything step-by-step.
          </p>
          <motion.button
            className="start-ai-learning-btn"
            onClick={() => navigate("/student/chat")}
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            style={{
              width: "100%",
              padding: "12px 18px",
              background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
              color: "#ffffff",
              border: "none",
              borderRadius: "14px",
              fontWeight: "700",
              fontSize: "14px",
              cursor: "pointer",
              boxShadow: "0 10px 22px -4px rgba(124, 58, 237, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <span>💬 start learning with AI</span>
            <span>→</span>
          </motion.button>
        </motion.div>
      </section>

      {/* ================= REAL METRICS SUMMARY ================= */}
      <section style={{ maxWidth: "1280px", margin: "0 auto 40px", padding: "0 24px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "20px",
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: "24px",
              borderRadius: "20px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
              border: "1px solid #f3e8ff",
            }}
          >
            <span style={{ fontSize: "28px" }}>📚</span>
            <div style={{ marginTop: "12px", fontSize: "14px", color: "#6b7280", fontWeight: 600 }}>
              UPLOADED DOCUMENTS
            </div>
            <div style={{ fontSize: "32px", fontWeight: 800, color: "#1f2937", marginTop: "4px" }}>
              {loading ? "..." : stats.totalDocuments}
            </div>
            <small style={{ color: "#7c3aed" }}>Processed via Groq</small>
          </div>

          <div
            style={{
              background: "#fff",
              padding: "24px",
              borderRadius: "20px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
              border: "1px solid #f3e8ff",
            }}
          >
            <span style={{ fontSize: "28px" }}>🎯</span>
            <div style={{ marginTop: "12px", fontSize: "14px", color: "#6b7280", fontWeight: 600 }}>
              QUIZZES ATTEMPTED
            </div>
            <div style={{ fontSize: "32px", fontWeight: 800, color: "#1f2937", marginTop: "4px" }}>
              {loading ? "..." : stats.totalQuizzesAttempted}
            </div>
            <small style={{ color: "#059669" }}>
              {stats.totalQuestionsCompleted} questions practiced
            </small>
          </div>

          <div
            style={{
              background: "#fff",
              padding: "24px",
              borderRadius: "20px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
              border: "1px solid #f3e8ff",
            }}
          >
            <span style={{ fontSize: "28px" }}>🏆</span>
            <div style={{ marginTop: "12px", fontSize: "14px", color: "#6b7280", fontWeight: 600 }}>
              AVERAGE SCORE
            </div>
            <div style={{ fontSize: "32px", fontWeight: 800, color: "#1f2937", marginTop: "4px" }}>
              {loading ? "..." : `${stats.averageScore}%`}
            </div>
            <small style={{ color: stats.averageScore >= 70 ? "#059669" : "#d97706" }}>
              {stats.averageScore >= 70 ? "Excellent mastery" : "Steady progress"}
            </small>
          </div>
        </div>
      </section>

      {/* ================= RECENT ACTIVITY / DOCUMENTS ================= */}
      {(recentDocuments.length > 0 || recentQuizResults.length > 0) && (
        <section style={{ maxWidth: "1280px", margin: "0 auto 40px", padding: "0 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
            {/* Recent Documents */}
            <div
              style={{
                background: "#fff",
                padding: "24px",
                borderRadius: "20px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
                border: "1px solid #f3e8ff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "18px", color: "#1f2937" }}>Recent Documents</h3>
                <Link to="/student/documents" style={{ color: "#7c3aed", fontSize: "13px", fontWeight: 600, textDecoration: "none" }}>
                  View All →
                </Link>
              </div>

              {recentDocuments.length === 0 ? (
                <p style={{ color: "#9ca3af", fontSize: "14px" }}>No documents uploaded yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {recentDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => navigate(`/student/documents/${doc.id}`)}
                      style={{
                        padding: "12px 16px",
                        background: "#faf5ff",
                        borderRadius: "12px",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: "14px", color: "#4c1d95" }}>{doc.title}</strong>
                        <div style={{ fontSize: "12px", color: "#6b7280" }}>
                          {doc.wordCount} words • {new Date(doc.uploadDate).toLocaleDateString()}
                        </div>
                      </div>
                      <span style={{ color: "#7c3aed", fontWeight: "bold" }}>→</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Quiz Scores */}
            <div
              style={{
                background: "#fff",
                padding: "24px",
                borderRadius: "20px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
                border: "1px solid #f3e8ff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "18px", color: "#1f2937" }}>Recent Quiz Performance</h3>
                <span style={{ color: "#6b7280", fontSize: "13px" }}>Recorded in Database</span>
              </div>

              {recentQuizResults.length === 0 ? (
                <p style={{ color: "#9ca3af", fontSize: "14px" }}>No quizzes completed yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {recentQuizResults.map((q) => (
                    <div
                      key={q.id}
                      style={{
                        padding: "12px 16px",
                        background: "#f0fdf4",
                        borderRadius: "12px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: "14px", color: "#065f46" }}>{q.documentTitle}</strong>
                        <div style={{ fontSize: "12px", color: "#6b7280" }}>
                          {new Date(q.completedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "16px", fontWeight: "bold", color: "#059669" }}>
                          {q.score}/{q.totalQuestions} ({q.percentage}%)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ================= FEATURES SECTION ================= */}
      <section className="features-section">
        <div className="section-heading">
          <div>
            <h2>How EDVIKO Works</h2>
            <p>Everything you need to learn smarter, faster, and better with Groq AI.</p>
          </div>
          <button className="see-all-button" onClick={() => navigate("/student/workspace")}>
            Upload Material →
          </button>
        </div>

        <div className="feature-grid">
          <motion.div
            className="feature-card upload"
            onClick={() => navigate("/student/workspace")}
            style={{ cursor: "pointer" }}
            whileHover={{ y: -8, scale: 1.015 }}
          >
            <div className="feature-preview">
              <div className="preview-window upload-preview">
                <strong>Upload Study Material</strong>
                <div className="mini-options">
                  <span>PDF Document</span>
                  <span>DOCX Document</span>
                  <span>Paste Text</span>
                </div>
              </div>
            </div>
            <div className="feature-info">
              <div className="feature-icon">↥</div>
              <h3>Upload & Extract</h3>
              <p>Turn lectures and textbooks into structured AI learning materials instantly.</p>
              <button className="try-button">Get Started →</button>
            </div>
          </motion.div>

          <motion.div
            className="feature-card quiz"
            onClick={() => navigate("/student/workspace")}
            style={{ cursor: "pointer" }}
            whileHover={{ y: -8, scale: 1.015 }}
          >
            <div className="feature-preview">
              <div className="preview-window quiz-preview">
                <strong>Smart 10-Question MCQ Quiz</strong>
                <div className="quiz-option correct">✓ Verified by Groq</div>
              </div>
            </div>
            <div className="feature-info">
              <div className="feature-icon">?</div>
              <h3>Interactive Quizzes</h3>
              <p>Learn from every question with instant AI explanations for incorrect answers.</p>
              <button className="try-button" onClick={() => navigate("/student/quizzes")}>Solve Quizzes →</button>
            </div>
          </motion.div>

          <motion.div
            className="feature-card tutor"
            onClick={() => navigate("/student/workspace")}
            style={{ cursor: "pointer" }}
            whileHover={{ y: -8, scale: 1.015 }}
          >
            <div className="feature-preview">
              <div className="preview-window tutor-preview">
                <div className="tutor-screen">Multi-turn Conversational AI Tutor</div>
              </div>
            </div>
            <div className="feature-info">
              <div className="feature-icon">▶</div>
              <h3>Personal AI Tutor</h3>
              <p>Ask in-depth questions and get explanations constrained strictly to your text.</p>
              <button className="try-button">Chat with Tutor →</button>
            </div>
          </motion.div>
        </div>
      </section>

      
      {/* ================= REAL-TIME POPUP NOTIFICATION FOR STUDENT ================= */}
      <AnimatePresence>
        {activePopup && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.92 }}
            style={{
              position: "fixed",
              bottom: "28px",
              right: "28px",
              maxWidth: "420px",
              background: "#ffffff",
              borderRadius: "20px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.22)",
              border: "2px solid #a78bfa",
              padding: "20px",
              zIndex: 999999,
              animation: "fadeIn 0.3s ease",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
              <div style={{ fontWeight: "800", fontSize: "15px", color: "#1e293b", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>{activePopup.title}</span>
              </div>
              <button
                onClick={() => handleDismissPopup(activePopup.id)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "50%",
                  width: "26px",
                  height: "26px",
                  cursor: "pointer",
                  fontSize: "12px",
                  color: "#64748b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginLeft: "8px",
                }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.5, margin: "0 0 14px 0" }}>
              {activePopup.message}
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", borderTop: "1px solid #f1f5f9" }}>
              <small style={{ fontSize: "11px", color: "#94a3b8", fontWeight: "600" }}>
                Instructor: {activePopup.sender || "Faculty"}
              </small>
              <button
                onClick={() => {
                  const link = activePopup.link;
                  handleDismissPopup(activePopup.id);
                  if (link) navigate(link);
                }}
                style={{
                  padding: "8px 16px",
                  background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "10px",
                  fontWeight: "700",
                  fontSize: "12px",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(124, 58, 237, 0.25)",
                }}
              >
                {activePopup.linkText || "View Now"} →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= MODAL 1: TEACHER ANNOUNCEMENTS / MESSAGES ================= */}
      {showAnnouncementsModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
          onClick={() => setShowAnnouncementsModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
              background: "#ffffff",
              borderRadius: "24px",
              maxWidth: "680px",
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid #f1f5f9",
              padding: "32px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", background: "#ede9fe", color: "#6d28d9", padding: "4px 10px", borderRadius: "8px" }}>
                  OFFICIAL NOTICES
                </span>
                <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#1e293b", margin: "8px 0 4px 0" }}>
                  📢 Teacher Messages & Announcements
                </h2>
                <p style={{ margin: 0, fontSize: "14px", color: "#64748b" }}>
                  Updates and study guidance posted by your assigned faculty mentor.
                </p>
              </div>
              <button
                onClick={() => setShowAnnouncementsModal(false)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "50%",
                  width: "36px",
                  height: "36px",
                  fontSize: "16px",
                  cursor: "pointer",
                  color: "#64748b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>

            {broadcasts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
                <span style={{ fontSize: "40px", display: "block", marginBottom: "12px" }}>📭</span>
                No announcements posted yet by your teacher.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {broadcasts.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      background: msg.priority === "High" ? "#fffbeb" : "#faf5ff",
                      border: msg.priority === "High" ? "1px solid #fde68a" : "1px solid #ede9fe",
                      borderRadius: "16px",
                      padding: "20px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: "700",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            background: msg.priority === "High" ? "#fef3c7" : "#ede9fe",
                            color: msg.priority === "High" ? "#b45309" : "#7c3aed",
                          }}
                        >
                          {msg.tag || "Notice"}
                        </span>
                        {msg.priority === "High" && (
                          <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 8px", borderRadius: "6px", background: "#fee2e2", color: "#b91c1c" }}>
                            🔥 Priority
                          </span>
                        )}
                        <strong style={{ fontSize: "16px", color: "#1e293b" }}>{msg.title}</strong>
                      </div>
                      <span style={{ fontSize: "12px", color: "#64748b" }}>{msg.date}</span>
                    </div>

                    <p style={{ margin: "0 0 12px 0", fontSize: "14px", lineHeight: "1.6", color: "#334155" }}>
                      {msg.content}
                    </p>

                    <div style={{ fontSize: "12px", color: "#7c3aed", fontWeight: "600" }}>
                      ✍️ Posted by: {msg.teacherName}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowAnnouncementsModal(false)}
                style={{
                  padding: "10px 20px",
                  background: "#6d28d9",
                  color: "#fff",
                  border: "none",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                Close Notices
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ================= MODAL 2: MESSAGE TEACHER PERSONALLY ================= */}
      {showMessageTeacherModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
          onClick={() => setShowMessageTeacherModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
              background: "#ffffff",
              borderRadius: "24px",
              maxWidth: "680px",
              width: "100%",
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid #f1f5f9",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: "24px", background: "linear-gradient(135deg, #4c1d95, #6d28d9)", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", background: "rgba(255,255,255,0.2)", padding: "3px 8px", borderRadius: "6px" }}>
                  PRIVATE FACULTY CONVERSATION
                </span>
                <h2 style={{ fontSize: "20px", fontWeight: "800", margin: "6px 0 2px 0" }}>
                  💬 Message Prof. Sarah Jenkins
                </h2>
                <div style={{ fontSize: "13px", opacity: 0.9 }}>
                  Direct Mentor Channel • Faculty Code: TEACH-101
                </div>
              </div>
              <button
                onClick={() => setShowMessageTeacherModal(false)}
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
                  border: "none",
                  borderRadius: "50%",
                  width: "36px",
                  height: "36px",
                  fontSize: "16px",
                  cursor: "pointer",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>

            {/* Strict Notice: 1-on-1 only, no group broadcast for students */}
            <div
              style={{
                background: "#eff6ff",
                borderBottom: "1px solid #bfdbfe",
                padding: "10px 20px",
                fontSize: "12px",
                color: "#1e40af",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>🔒</span>
              <div>
                <strong>Private 1-on-1 Policy:</strong> You are messaging your faculty mentor directly. For class privacy, students cannot broadcast messages to the entire group or other students.
              </div>
            </div>

            {toastNotice && (
              <div style={{ background: "#ecfdf5", color: "#065f46", padding: "8px 20px", fontSize: "13px", fontWeight: "600", textAlign: "center" }}>
                ✅ {toastNotice}
              </div>
            )}

            {/* Chat Body */}
            <div
              style={{
                flex: 1,
                padding: "24px",
                overflowY: "auto",
                maxHeight: "360px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                background: "#faf9ff",
              }}
            >
              {directMessages.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
                  <span style={{ fontSize: "36px", display: "block", marginBottom: "8px" }}>💬</span>
                  No messages yet. Send a message below to start your conversation with your teacher.
                </div>
              ) : (
                directMessages.map((msg) => {
                  const isMe = msg.senderRole === "student";
                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: isMe ? "flex-end" : "flex-start",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#64748b",
                          marginBottom: "4px",
                          fontWeight: "600",
                          display: "flex",
                          gap: "6px",
                        }}
                      >
                        <span>{isMe ? "You" : msg.senderName}</span>
                        <span>•</span>
                        <span>{msg.timestamp}</span>
                      </div>
                      <div
                        style={{
                          maxWidth: "80%",
                          padding: "12px 18px",
                          borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                          background: isMe ? "linear-gradient(135deg, #7c3aed, #6d28d9)" : "#ffffff",
                          color: isMe ? "#ffffff" : "#1e293b",
                          fontSize: "14px",
                          lineHeight: "1.5",
                          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
                          border: isMe ? "none" : "1px solid #ede9fe",
                        }}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Compose Form */}
            <form onSubmit={handleSendDirectMessage} style={{ padding: "16px 20px", background: "#ffffff", borderTop: "1px solid #f1f5f9", display: "flex", gap: "12px", alignItems: "center" }}>
              <input
                type="text"
                placeholder="Write your private message or question to the teacher..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: "12px 18px",
                  borderRadius: "12px",
                  border: "1.5px solid #e2e8f0",
                  fontSize: "14px",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={!messageInput.trim()}
                style={{
                  padding: "12px 24px",
                  background: messageInput.trim() ? "linear-gradient(135deg, #7c3aed, #6d28d9)" : "#e2e8f0",
                  color: messageInput.trim() ? "#ffffff" : "#94a3b8",
                  border: "none",
                  borderRadius: "12px",
                  fontSize: "14px",
                  fontWeight: "700",
                  cursor: messageInput.trim() ? "pointer" : "default",
                  boxShadow: messageInput.trim() ? "0 4px 14px rgba(124, 58, 237, 0.3)" : "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>Send</span>
                <span>➤</span>
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default StudentDashboard;