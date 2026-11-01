import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import studentImage from "../assets/student/student.png";

function RoleSelection() {
  const navigate = useNavigate();

  const capabilities = [
    {
      icon: "🤖",
      title: "AI Personalized Learning",
      desc: "Tailored doubt-clearing and intelligent concept explanations.",
    },
    {
      icon: "📄",
      title: "Smart Notes & Handouts",
      desc: "Instant summaries and organized faculty lecture materials.",
    },
    {
      icon: "🎯",
      title: "Interactive Practice Quizzes",
      desc: "Self-paced MCQ evaluations with instant feedback.",
    },
    {
      icon: "💬",
      title: "Teacher-Student Sync",
      desc: "Group classroom announcements and private 1-on-1 messaging.",
    },
    {
      icon: "📊",
      title: "Real-Time Progress Tracking",
      desc: "Continuous performance metrics and historical learning records.",
    },
    {
      icon: "🌐",
      title: "Multilingual Support",
      desc: "Learn comfortably in English, Hinglish, Hindi, or Marathi.",
    },
  ];

  return (
    <div className="role-page" style={{ overflowY: "auto", minHeight: "100vh" }}>
      {/* Decorative Background */}
      <div className="background-circle circle-one"></div>
      <div className="background-circle circle-two"></div>

      {/* =========================
          LEFT SECTION: INTRO & CAPABILITIES
      ========================= */}
      <motion.div
        className="intro-section"
        style={{ height: "auto", minHeight: "85vh", paddingBottom: "30px" }}
        initial={{ opacity: 0, x: -60 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8 }}
      >
        {/* Logo */}
        <div className="logo" style={{ marginBottom: "28px" }}>
          <span>🎓</span>
          <strong>EDVIKO</strong>
        </div>

        {/* 1. EDVIKO Introduction */}
        <div className="intro-text" style={{ marginLeft: 0, marginBottom: "24px" }}>
          <p className="small-heading">SMART LEARNING PLATFORM</p>
          <h1 style={{ fontSize: "clamp(36px, 4.2vw, 56px)", lineHeight: "1.08" }}>
            Welcome to
            <br />
            <span>EDVIKO</span>
          </h1>
          <p
            className="description"
            style={{
              width: "100%",
              maxWidth: "580px",
              marginTop: "16px",
              fontSize: "16px",
              lineHeight: "1.6",
              color: "#5b5675",
            }}
          >
            EDVIKO is an intelligent educational ecosystem that bridges classroom instruction with personalized AI tutoring. We empower students to master complex coursework through grounded study assistants and instant practice, while giving faculty complete transparency into classroom comprehension and student growth.
          </p>
        </div>

        {/* 2. What EDVIKO Offers: Key Capabilities */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          style={{
            maxWidth: "600px",
            background: "rgba(255, 255, 255, 0.75)",
            backdropFilter: "blur(12px)",
            borderRadius: "20px",
            padding: "20px",
            border: "1px solid rgba(231, 224, 247, 0.9)",
            boxShadow: "0 10px 25px rgba(112, 68, 229, 0.05)",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: "800",
              textTransform: "uppercase",
              letterSpacing: "1.5px",
              color: "#7044e5",
              marginBottom: "12px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>⚡</span> WHAT EDVIKO OFFERS
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "12px",
            }}
          >
            {capabilities.map((cap, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  padding: "8px",
                  borderRadius: "10px",
                  background: "#ffffff",
                  border: "1px solid #f3efff",
                }}
              >
                <span style={{ fontSize: "20px", lineHeight: "1" }}>{cap.icon}</span>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: "#1e1b4b" }}>
                    {cap.title}
                  </div>
                  <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px", lineHeight: "1.3" }}>
                    {cap.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Student Illustration (Desktop/Tablet) */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "6px" }}>
          <img
            src={studentImage}
            alt="Student learning with EDVIKO"
            style={{
              width: "120px",
              height: "auto",
              filter: "drop-shadow(0 10px 18px rgba(78, 53, 150, 0.15))",
            }}
          />
          <p style={{ fontSize: "13px", color: "#7955dd", fontWeight: "600", margin: 0 }}>
            ✨ Designed for higher education, high school scholars, and faculty mentors.
          </p>
        </div>
      </motion.div>

      {/* =========================
          RIGHT SECTION: 3. CHOOSE YOUR ROLE
      ========================= */}
      <motion.div
        className="selection-card"
        initial={{ opacity: 0, x: 60 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 0.25 }}
      >
        <p className="hello-text">Get Started 👋</p>
        <h2>Choose your role</h2>
        <p className="choose-text" style={{ marginBottom: "24px" }}>
          Select how you want to access EDVIKO
        </p>

        {/* STUDENT OPTION */}
        <motion.button
          className="role-card"
          onClick={() => navigate("/student/login")}
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="role-icon student-icon">👨‍🎓</div>
          <div className="role-info">
            <h3 style={{ fontSize: "17px", fontWeight: "700" }}>Student Portal</h3>
            <p style={{ fontSize: "13px", color: "#64748b" }}>
              Student Login • Upload materials, study with AI Tutor, take quizzes & track progress
            </p>
          </div>
          <span className="arrow">→</span>
        </motion.button>

        {/* TEACHER OPTION */}
        <motion.button
          className="role-card"
          onClick={() => navigate("/teacher/login")}
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="role-icon teacher-icon">👨‍🏫</div>
          <div className="role-info">
            <h3 style={{ fontSize: "17px", fontWeight: "700" }}>Faculty Portal</h3>
            <p style={{ fontSize: "13px", color: "#64748b" }}>
              Teacher Login • Share materials, broadcast announcements & monitor class analytics
            </p>
          </div>
          <span className="arrow">→</span>
        </motion.button>

        {/* Quick Registration Option */}
        <div style={{ marginTop: "20px", textAlign: "center", padding: "12px", background: "rgba(255, 255, 255, 0.7)", borderRadius: "14px", border: "1px solid #ede9fe", fontSize: "13px", color: "#64748b" }}>
          <span>New to EDVIKO? </span>
          <button
            type="button"
            onClick={() => navigate("/student/signup")}
            style={{ background: "none", border: "none", color: "#7c3aed", fontWeight: "700", cursor: "pointer", textDecoration: "underline", padding: "0 6px" }}
          >
            Student Sign Up
          </button>
          <span style={{ color: "#cbd5e1" }}>•</span>
          <button
            type="button"
            onClick={() => navigate("/teacher/signup")}
            style={{ background: "none", border: "none", color: "#7c3aed", fontWeight: "700", cursor: "pointer", textDecoration: "underline", padding: "0 6px" }}
          >
            Faculty Sign Up
          </button>
        </div>

        {/* Bottom Tagline */}
        <p className="bottom-text" style={{ marginTop: "24px", textAlign: "center", fontSize: "13px", color: "#858097" }}>
          One unified platform. Smarter learning. Better growth.
        </p>
      </motion.div>
    </div>
  );
}

export default RoleSelection;
