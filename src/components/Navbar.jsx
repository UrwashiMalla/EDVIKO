import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import {
  getInstitutionName,
  setInstitutionName,
  getTeacherSubject,
  setTeacherSubject,
} from "../services/frontendStorage";

export default function Navbar({ activeTab = "dashboard" }) {
  const { user, logout, updateUser } = useAuth();
  const navigate = useNavigate();

  const isTeacher = user?.role === "teacher";

  // Mobile Menu Drawer State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Teacher Profile Modal State
  const [showTeacherProfile, setShowTeacherProfile] = useState(false);
  const [teacherName, setTeacherName] = useState(user?.name || "Prof. Sarah Jenkins");
  const [teacherSubject, setTeacherSubjectState] = useState(getTeacherSubject());
  const [institution, setInstitutionState] = useState(getInstitutionName());
  const [copiedCode, setCopiedCode] = useState(false);
  const [saveToast, setSaveToast] = useState("");

  const classCode = "TEACH-101";

  useEffect(() => {
    if (user?.name) setTeacherName(user.name);
    setTeacherSubjectState(getTeacherSubject());
    setInstitutionState(getInstitutionName());
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const handleProfileClick = () => {
    if (isTeacher) {
      setTeacherName(user?.name || "Prof. Sarah Jenkins");
      setTeacherSubjectState(getTeacherSubject());
      setInstitutionState(getInstitutionName());
      setShowTeacherProfile(true);
    } else {
      navigate("/student/profile");
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(classCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSaveTeacherProfile = (e) => {
    e.preventDefault();
    if (!teacherName.trim()) return;

    if (updateUser) {
      updateUser({ name: teacherName.trim() });
    }
    setInstitutionName(institution.trim());
    setTeacherSubject(teacherSubject.trim());

    setSaveToast("Profile updated successfully!");
    setTimeout(() => {
      setSaveToast("");
      setShowTeacherProfile(false);
    }, 1200);
  };

  return (
    <>
      <header className="dashboard-navbar">
        <Link to={isTeacher ? "/teacher/dashboard" : "/student/dashboard"} style={{ textDecoration: "none" }}>
          <div className="dashboard-brand">
            <span className="brand-cap">🎓</span>
            <strong>EDVIKO</strong>
          </div>
        </Link>

        <nav className="dashboard-nav">
          {!isTeacher ? (
            <>
              <Link
                to="/student/dashboard"
                className={`nav-link ${activeTab === "dashboard" ? "active" : ""}`}
              >
                Dashboard
              </Link>
              <Link
                to="/student/workspace"
                className={`nav-link ${activeTab === "workspace" ? "active" : ""}`}
              >
                Upload Material
              </Link>
              <Link
                to="/student/documents"
                className={`nav-link ${activeTab === "documents" ? "active" : ""}`}
              >
                My Documents
              </Link>
              <Link
                to="/student/lectures-notes"
                className={`nav-link ${activeTab === "lectures-notes" || activeTab === "courses" ? "active" : ""}`}
              >
                Lectures & Notes
              </Link>
              <Link
                to="/student/chat"
                className={`nav-link ${activeTab === "chat" ? "active" : ""}`}
              >
                AI Tutor
              </Link>
              <Link
                to="/student/profile"
                className={`nav-link ${activeTab === "profile" ? "active" : ""}`}
              >
                Profile
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/teacher/dashboard"
                className={`nav-link ${activeTab === "dashboard" ? "active" : ""}`}
              >
                Overview
              </Link>
              <Link
                to="/teacher/students"
                className={`nav-link ${activeTab === "students" ? "active" : ""}`}
              >
                My Students
              </Link>
              <Link
                to="/teacher/documents"
                className={`nav-link ${activeTab === "documents" ? "active" : ""}`}
              >
                Course Content & Quizzes
              </Link>
              <Link
                to="/teacher/quiz-results"
                className={`nav-link ${activeTab === "quiz-results" ? "active" : ""}`}
              >
                Quiz Results
              </Link>
            </>
          )}
        </nav>

        <div className="dashboard-actions">
          {/* Avatar and Name clickable to open profile */}
          <div
            className="student-profile"
            style={{ cursor: "pointer" }}
            onClick={handleProfileClick}
            title={isTeacher ? "Click to view & edit Faculty Profile" : "View Student Profile"}
          >
            <div className="profile-avatar">
              {user?.name ? user.name.charAt(0).toUpperCase() : isTeacher ? "P" : "S"}
            </div>
            <div className="profile-text">
              <strong>{user?.name || (isTeacher ? "Professor" : "Student")}</strong>
              <small style={{ textTransform: "capitalize", display: "flex", alignItems: "center", gap: "4px" }}>
                <span>{user?.role || "Student"}</span>
                {isTeacher && <span style={{ fontSize: "10px", opacity: 0.8 }}>(Edit ✎)</span>}
              </small>
            </div>
          </div>

          <motion.button
            onClick={handleLogout}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
              marginLeft: "12px",
              padding: "8px 16px",
              background: "#fee2e2",
              color: "#b91c1c",
              border: "none",
              borderRadius: "10px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Logout
          </motion.button>

          {/* Mobile Navigation Hamburger Toggle (strictly hidden on desktop > 900px) */}
          <button
            className="mobile-nav-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
            style={{
              display: "none",
              alignItems: "center",
              justifyContent: "center",
              width: "38px",
              height: "38px",
              marginLeft: "10px",
              background: mobileMenuOpen ? "#ede9fe" : "#f1f5f9",
              color: mobileMenuOpen ? "#6d28d9" : "#334155",
              border: "1.5px solid",
              borderColor: mobileMenuOpen ? "#c4b5fd" : "#cbd5e1",
              borderRadius: "10px",
              cursor: "pointer",
              fontSize: "18px",
              fontWeight: "bold",
              transition: "all 0.2s ease",
            }}
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>
      </header>

      {/* ================= MOBILE NAV DRAWER (strictly hidden on desktop > 900px) ================= */}
      {mobileMenuOpen && (
        <>
          <div
            className="mobile-drawer-backdrop"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="mobile-nav-drawer">
            {!isTeacher ? (
              <>
                <Link
                  to="/student/dashboard"
                  className={`mobile-nav-link ${activeTab === "dashboard" ? "active" : ""}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span>🏠</span>
                  <span>Dashboard</span>
                </Link>
                <Link
                  to="/student/workspace"
                  className={`mobile-nav-link ${activeTab === "workspace" ? "active" : ""}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span>📤</span>
                  <span>Upload Material</span>
                </Link>
                <Link
                  to="/student/documents"
                  className={`mobile-nav-link ${activeTab === "documents" ? "active" : ""}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span>📁</span>
                  <span>My Documents</span>
                </Link>
                <Link
                  to="/student/lectures-notes"
                  className={`mobile-nav-link ${activeTab === "lectures-notes" || activeTab === "courses" ? "active" : ""}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span>📚</span>
                  <span>Lectures & Notes</span>
                </Link>
                <Link
                  to="/student/chat"
                  className={`mobile-nav-link ${activeTab === "chat" ? "active" : ""}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span>🤖</span>
                  <span>AI Tutor</span>
                </Link>
                <Link
                  to="/student/profile"
                  className={`mobile-nav-link ${activeTab === "profile" ? "active" : ""}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span>👤</span>
                  <span>Profile</span>
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/teacher/dashboard"
                  className={`mobile-nav-link ${activeTab === "dashboard" ? "active" : ""}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span>📊</span>
                  <span>Overview</span>
                </Link>
                <Link
                  to="/teacher/students"
                  className={`mobile-nav-link ${activeTab === "students" ? "active" : ""}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span>👥</span>
                  <span>My Students</span>
                </Link>
                <Link
                  to="/teacher/documents"
                  className={`mobile-nav-link ${activeTab === "documents" ? "active" : ""}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span>📚</span>
                  <span>Course Content & Quizzes</span>
                </Link>
                <Link
                  to="/teacher/quiz-results"
                  className={`mobile-nav-link ${activeTab === "quiz-results" ? "active" : ""}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span>📈</span>
                  <span>Quiz Results</span>
                </Link>
              </>
            )}
          </div>
        </>
      )}

      {/* ================= TEACHER PROFILE MODAL ================= */}
      {showTeacherProfile && (
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
            zIndex: 99999,
            padding: "20px",
          }}
          onClick={() => setShowTeacherProfile(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
              background: "#ffffff",
              borderRadius: "24px",
              maxWidth: "540px",
              width: "100%",
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid #f1f5f9",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                background: "linear-gradient(135deg, #4c1d95, #6d28d9)",
                color: "#fff",
                padding: "28px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    background: "#ffffff",
                    color: "#6d28d9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "24px",
                    fontWeight: "800",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  }}
                >
                  {teacherName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", background: "rgba(255,255,255,0.2)", padding: "3px 8px", borderRadius: "6px" }}>
                    FACULTY PROFILE
                  </span>
                  <h2 style={{ fontSize: "20px", fontWeight: "800", margin: "4px 0 0 0" }}>
                    {teacherName}
                  </h2>
                  <div style={{ fontSize: "12px", opacity: 0.85 }}>{user?.email || "teacher@lerniq.edu"}</div>
                </div>
              </div>

              <button
                onClick={() => setShowTeacherProfile(false)}
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

            {saveToast && (
              <div style={{ background: "#ecfdf5", color: "#065f46", padding: "10px 20px", fontSize: "13px", fontWeight: "700", textAlign: "center" }}>
                ✅ {saveToast}
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleSaveTeacherProfile} style={{ padding: "28px" }}>
              {/* Field 1: Teacher Name */}
              <div style={{ marginBottom: "18px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                  👨‍🏫 Teacher Name
                </label>
                <input
                  type="text"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  placeholder="e.g. Prof. Sarah Jenkins"
                  style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
                  required
                />
              </div>

              {/* Field 2: Subject / Department */}
              <div style={{ marginBottom: "18px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                  📚 Teaching Subject / Department
                </label>
                <input
                  type="text"
                  value={teacherSubject}
                  onChange={(e) => setTeacherSubjectState(e.target.value)}
                  placeholder="e.g. Computer Science & AI"
                  style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
                  required
                />
              </div>

              {/* Field 3: University / School / College */}
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                  🏛️ University / School / College Name
                </label>
                <input
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitutionState(e.target.value)}
                  placeholder="e.g. Stanford University / Delhi University"
                  style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
                  required
                />
                <small style={{ color: "#64748b", fontSize: "11px", display: "block", marginTop: "4px" }}>
                  This institution name is also displayed on your enrolled students' profiles as verified read-only.
                </small>
              </div>

              {/* Field 4: Class Code */}
              <div style={{ background: "#f8fafc", padding: "14px 18px", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", color: "#64748b" }}>
                      YOUR ACTIVE CLASS CODE
                    </span>
                    <div style={{ fontSize: "20px", fontWeight: "800", color: "#1e293b", letterSpacing: "1.5px", marginTop: "2px" }}>
                      {classCode}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    style={{
                      padding: "8px 14px",
                      background: copiedCode ? "#dcfce7" : "#ede9fe",
                      color: copiedCode ? "#15803d" : "#6d28d9",
                      border: "none",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: "700",
                      cursor: "pointer",
                    }}
                  >
                    {copiedCode ? "✓ Copied!" : "📋 Copy Code"}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowTeacherProfile(false)}
                  style={{
                    padding: "11px 20px",
                    background: "#f1f5f9",
                    color: "#475569",
                    border: "none",
                    borderRadius: "10px",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "11px 24px",
                    background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "10px",
                    fontSize: "14px",
                    fontWeight: "700",
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(124, 58, 237, 0.3)",
                  }}
                >
                  Save Profile Changes
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </>
  );
}
