import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { studentApi } from "../services/api";
import Navbar from "./Navbar";
import studentImage from "../assets/student/student.png";
import "./StudentDashboard.css";

function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

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
  }, []);

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

          {/* QUICK ACTION BUTTON */}
          <motion.div style={{ marginTop: "24px", display: "flex", gap: "12px" }}>
            <motion.button
              onClick={() => navigate("/student/workspace")}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: "14px 28px",
                background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                color: "#fff",
                border: "none",
                borderRadius: "14px",
                fontWeight: "600",
                fontSize: "15px",
                cursor: "pointer",
                boxShadow: "0 10px 25px -5px rgba(124, 58, 237, 0.4)",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>📄 Upload New Study Material</span>
              <span>→</span>
            </motion.button>

            <motion.button
              onClick={() => navigate("/student/documents")}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: "14px 24px",
                background: "#ffffff",
                color: "#4c1d95",
                border: "1px solid #e9d5ff",
                borderRadius: "14px",
                fontWeight: "600",
                fontSize: "15px",
                cursor: "pointer",
              }}
            >
              📚 Document History
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
              alt="Student learning with LERNIQ"
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

        {/* ================= QUOTE CARD ================= */}
        <motion.div
          className="hero-quote"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          <span className="quote-mark">“</span>
          <div className="quote-badge">STUDY SMARTER 💜</div>
          <p>
            Master any subject
            <br />
            by testing your memory
            <br />
            with active recall.
          </p>
          <div className="quote-bottom">
            <small>— Groq AI Engine</small>
            <motion.button onClick={() => navigate("/student/workspace")}>
              →
            </motion.button>
          </div>
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
            <h2>How LERNIQ Works</h2>
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
              <button className="try-button">Start Quiz →</button>
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
    </div>
  );
}

export default StudentDashboard;