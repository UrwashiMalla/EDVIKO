import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import {
  getInstitutionName,
  setInstitutionName,
  getTeacherSubject,
  setTeacherSubject,
  getTeacherClassCode,
  getClassroomEntries,
  markClassroomEntriesAsRead,
  onLerniqSync,
} from "../services/frontendStorage";

function Navbar({ activeTab = "dashboard" }) {
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

  // Unique Teacher Class Code
  const [classCode, setClassCode] = useState(() => {
    return user?.profile?.teacherCode || getTeacherClassCode(user?.id || user?._id || "default_teacher");
  });

  // Classroom Entry Alerts (Teacher header popup)
  const [showClassEntryPopup, setShowClassEntryPopup] = useState(false);
  const [classroomEntries, setClassroomEntries] = useState(() => getClassroomEntries());
  const [entryToast, setEntryToast] = useState(null);

  const unreadCount = classroomEntries.filter((e) => !e.read).length;

  useEffect(() => {
    if (user?.name) setTeacherName(user.name);
    setTeacherSubjectState(getTeacherSubject());
    setInstitutionState(getInstitutionName());
    if (isTeacher) {
      const code = user?.profile?.teacherCode || getTeacherClassCode(user?.id || user?._id || "default_teacher");
      setClassCode(code);
    }
  }, [user, isTeacher]);

  useEffect(() => {
    if (!isTeacher) return;
    setClassroomEntries(getClassroomEntries());
    const unsubscribe = onLerniqSync((detail) => {
      if (detail.type === "STUDENT_ENTERED_CLASS") {
        setClassroomEntries(getClassroomEntries());
        setEntryToast(`🔔 ${detail.payload.studentName || "Student"} entered your classroom!`);
        setTimeout(() => setEntryToast(null), 5000);
      } else if (detail.type === "CLASSROOM_ENTRIES_READ") {
        setClassroomEntries(getClassroomEntries());
      }
    });
    return unsubscribe;
  }, [isTeacher]);

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
      {/* Real-time Entry Toast Alert for Teacher */}
      {entryToast && isTeacher && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          style={{
            position: "fixed",
            top: "70px",
            right: "24px",
            zIndex: 99999,
            background: "linear-gradient(135deg, #10b981, #059669)",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "12px",
            boxShadow: "0 10px 25px rgba(16, 185, 129, 0.4)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontWeight: "700",
            fontSize: "14px",
          }}
        >
          <span>{entryToast}</span>
          <button
            onClick={() => setEntryToast(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "#ffffff",
              fontSize: "16px",
              cursor: "pointer",
              marginLeft: "8px",
            }}
          >
            ✕
          </button>
        </motion.div>
      )}

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
                to="/student/quizzes"
                className={`nav-link ${activeTab === "quizzes" ? "active" : ""}`}
              >
                Quizzes
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

        <div className="dashboard-actions" style={{ display: "flex", alignItems: "center" }}>
          {/* POPUP NOTIFICATION: BETWEEN QUIZ RESULTS AND PROFILE IN HEADER */}
          {isTeacher && (
            <div style={{ position: "relative", marginRight: "14px" }}>
              <button
                type="button"
                className="icon-button notification-button"
                onClick={() => {
                  const nextState = !showClassEntryPopup;
                  setShowClassEntryPopup(nextState);
                  if (nextState) {
                    markClassroomEntriesAsRead();
                  }
                }}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  border: unreadCount > 0 ? "1.5px solid #a78bfa" : "1px solid #e2e8f0",
                  background: unreadCount > 0 ? "#ede9fe" : "#ffffff",
                  color: unreadCount > 0 ? "#6d28d9" : "#64748b",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  boxShadow: unreadCount > 0 ? "0 4px 12px rgba(124, 58, 237, 0.2)" : "none",
                  transition: "all 0.2s ease",
                }}
                title="Classroom Entry Notifications (Students entering class)"
                aria-label="Student Entries Notification"
              >
                <span style={{ fontSize: "16px" }}>🔔</span>
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: "-4px",
                      right: "-4px",
                      background: "#ef4444",
                      color: "#ffffff",
                      borderRadius: "10px",
                      padding: "1px 5px",
                      fontSize: "10px",
                      fontWeight: "800",
                      minWidth: "16px",
                      textAlign: "center",
                      lineHeight: "14px",
                      border: "2px solid #ffffff",
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Popup Dropdown */}
              {showClassEntryPopup && (
                <div
                  style={{
                    position: "absolute",
                    top: "46px",
                    right: 0,
                    width: "330px",
                    background: "#ffffff",
                    borderRadius: "16px",
                    boxShadow: "0 12px 36px rgba(0,0,0,0.18)",
                    border: "1px solid #ede9fe",
                    zIndex: 99999,
                    overflow: "hidden",
                    animation: "fadeIn 0.2s ease-out",
                  }}
                >
                  <div
                    style={{
                      padding: "14px 18px",
                      background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                      color: "#ffffff",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: "800", fontSize: "14px" }}>
                        🚪 Classroom Entry Alerts
                      </div>
                      <small style={{ opacity: 0.85, fontSize: "11px" }}>
                        Real-time student entrance log
                      </small>
                    </div>
                    <button
                      onClick={() => setShowClassEntryPopup(false)}
                      style={{
                        background: "rgba(255,255,255,0.2)",
                        border: "none",
                        color: "#fff",
                        borderRadius: "50%",
                        width: "24px",
                        height: "24px",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  <div style={{ maxHeight: "300px", overflowY: "auto", padding: "10px" }}>
                    {classroomEntries.length === 0 ? (
                      <div style={{ padding: "24px 16px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                        <span style={{ fontSize: "28px", display: "block", marginBottom: "6px" }}>👋</span>
                        No recent student entries recorded yet.
                        <br />
                        <small style={{ fontSize: "11px", color: "#cbd5e1" }}>
                          When a student signs in or joins class, you will be notified here immediately.
                        </small>
                      </div>
                    ) : (
                      classroomEntries.map((entry) => (
                        <div
                          key={entry.id}
                          style={{
                            padding: "10px 12px",
                            borderRadius: "10px",
                            background: entry.read ? "#ffffff" : "#f5f3ff",
                            border: "1px solid",
                            borderColor: entry.read ? "#f1f5f9" : "#ddd6fe",
                            marginBottom: "8px",
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "10px",
                          }}
                        >
                          <div
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "50%",
                              background: entry.read ? "#f1f5f9" : "#ede9fe",
                              color: "#6d28d9",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: "800",
                              fontSize: "13px",
                              flexShrink: 0,
                            }}
                          >
                            {entry.studentName ? entry.studentName.charAt(0).toUpperCase() : "S"}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "13px", fontWeight: "700", color: "#1e293b" }}>
                              {entry.studentName}
                            </div>
                            <div style={{ fontSize: "11px", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {entry.studentEmail}
                            </div>
                            <div style={{ fontSize: "10px", color: "#8b5cf6", marginTop: "3px", fontWeight: "600" }}>
                              Entered Classroom • {entry.timestamp} ({entry.date})
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

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

          {/* Mobile Navigation Hamburger Toggle */}
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

      {/* ================= MOBILE NAV DRAWER ================= */}
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
                  to="/student/quizzes"
                  className={`mobile-nav-link ${activeTab === "quizzes" ? "active" : ""}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span>🎯</span>
                  <span>Quizzes</span>
                </Link>
                <Link
                  to="/student/chat"
                  className={`mobile-nav-link ${activeTab === "chat" ? "active" : ""}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span>💬</span>
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
                  <span>📑</span>
                  <span>Course Content & Quizzes</span>
                </Link>
                <Link
                  to="/teacher/quiz-results"
                  className={`mobile-nav-link ${activeTab === "quiz-results" ? "active" : ""}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span>🎯</span>
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
            background: "rgba(15, 23, 42, 0.7)",
            backdropFilter: "blur(6px)",
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
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            style={{
              background: "#ffffff",
              borderRadius: "24px",
              width: "100%",
              maxWidth: "520px",
              boxShadow: "0 25px 60px rgba(0,0,0,0.25)",
              border: "1px solid #e2e8f0",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                background: "linear-gradient(135deg, #7c3aed, #4c1d95)",
                padding: "24px 28px",
                color: "#ffffff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "22px",
                    fontWeight: "800",
                    border: "2px solid rgba(255,255,255,0.4)",
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
                </div>
              </div>

              <button
                onClick={() => setShowTeacherProfile(false)}
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
                  border: "none",
                  borderRadius: "50%",
                  width: "32px",
                  height: "32px",
                  color: "#ffffff",
                  fontSize: "14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>

            {/* Save Notification Toast */}
            {saveToast && (
              <div style={{ background: "#dcfce7", color: "#166534", padding: "12px 28px", fontSize: "13px", fontWeight: "700", borderBottom: "1px solid #bbf7d0" }}>
                ✓ {saveToast}
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleSaveTeacherProfile} style={{ padding: "28px" }}>
              {/* Field 1: Teacher Name */}
              <div style={{ marginBottom: "18px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                  Full Name / Title
                </label>
                <input
                  type="text"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  placeholder="e.g. Prof. Sarah Jenkins"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border: "1.5px solid #cbd5e1",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#1e293b",
                    boxSizing: "border-box",
                  }}
                  required
                />
              </div>

              {/* Field 2: Subject */}
              <div style={{ marginBottom: "18px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                  Subject / Specialization
                </label>
                <input
                  type="text"
                  value={teacherSubject}
                  onChange={(e) => setTeacherSubjectState(e.target.value)}
                  placeholder="e.g. Computer Science & AI"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border: "1.5px solid #cbd5e1",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#1e293b",
                    boxSizing: "border-box",
                  }}
                  required
                />
              </div>

              {/* Field 3: Institution */}
              <div style={{ marginBottom: "18px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                  College / School / University
                </label>
                <input
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitutionState(e.target.value)}
                  placeholder="e.g. Stanford University"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border: "1.5px solid #cbd5e1",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#1e293b",
                    boxSizing: "border-box",
                  }}
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
                      YOUR UNIQUE CLASS CODE
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
                      transition: "all 0.2s ease",
                    }}
                  >
                    {copiedCode ? "✓ Copied!" : "📋 Copy Code"}
                  </button>
                </div>
                <small style={{ color: "#64748b", fontSize: "11px", display: "block", marginTop: "8px" }}>
                  Share this unique code with students so they can join your class during registration.
                </small>
              </div>

              {/* Action Buttons */}
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
                    fontSize: "13px",
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
                    fontSize: "13px",
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

export default Navbar;
