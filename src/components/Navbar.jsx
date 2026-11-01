import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { notificationApi, teacherApi } from "../services/api";
import {
  getInstitutionName,
  setInstitutionName,
  getTeacherSubject,
  setTeacherSubject,
  getTeacherClassCode,
  setTeacherClassCode,
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

  // Removed students state
  const [removedStudentsList, setRemovedStudentsList] = useState([]);

  const fetchRemovedStudents = async () => {
    if (!isTeacher) return;
    try {
      const res = await teacherApi.getRemovedStudents();
      setRemovedStudentsList(res.removedStudents || []);
    } catch (err) {
      console.warn("Could not load removed students:", err);
    }
  };

  const handleUnremoveStudent = async (studentId) => {
    try {
      await teacherApi.unremoveStudent(studentId);
      setSaveToast("Student unremoved! They can now rejoin your classroom.");
      fetchRemovedStudents();
      setTimeout(() => setSaveToast(""), 3500);
    } catch (err) {
      setSaveToast("Error unremoving: " + err.message);
    }
  };

  // Unique Teacher Class Code (synchronized with backend & teacher dashboard)
  const [classCode, setClassCode] = useState(() => {
    return user?.profile?.teacherCode || user?.teacherCode || getTeacherClassCode(user?.id || user?._id || "default_teacher");
  });

  // Keep Navbar teacher class code 100% in sync with real MongoDB TeacherProfile
  useEffect(() => {
    if (isTeacher) {
      teacherApi.getDashboard()
        .then((res) => {
          if (res && res.teacherProfile && res.teacherProfile.teacherCode) {
            const realCode = res.teacherProfile.teacherCode;
            setClassCode(realCode);
            setTeacherClassCode(realCode, user?.id || user?._id || "default_teacher");
          }
        })
        .catch(() => {});
    }
  }, [isTeacher, user]);

  // Notifications State (MongoDB backed for BOTH Teacher & Student)
  const [userNotifications, setUserNotifications] = useState([]);
  const [showStudentNotificationPopup, setShowStudentNotificationPopup] = useState(false);
  const [quizPopup, setQuizPopup] = useState(null);

  const studentNotifications = userNotifications;
  const studentUnreadCount = userNotifications.filter((n) => !n.isRead).length;
  const teacherUnreadCount = userNotifications.filter((n) => !n.isRead).length;

  // Classroom Entry Alerts (Teacher header popup)
  const [showClassEntryPopup, setShowClassEntryPopup] = useState(false);
  const [classroomEntries, setClassroomEntries] = useState(() => getClassroomEntries());
  const [entryToast, setEntryToast] = useState(null);

  const entryUnreadCount = classroomEntries.filter((e) => !e.read).length;
  const unreadCount = entryUnreadCount + teacherUnreadCount;

  const fetchUserNotifications = async (showPopupOnLogin = false) => {
    if (!user) return;
    try {
      const res = await notificationApi.getMyNotifications();
      const list = res.notifications || [];
      setUserNotifications(list);

      // Show popup notification when student logs in / visits if there are unread alerts
      if (showPopupOnLogin && !isTeacher) {
        const unread = list.filter((n) => !n.isRead);
        if (unread.length > 0) {
          const latest = unread[0];
          setQuizPopup({
            id: latest.id || latest._id,
            title: latest.title,
            message: latest.message,
            quizId: latest.quizId,
            link: latest.link || "/student/quizzes",
          });
        }
      }
    } catch (err) {
      console.warn("Could not load notifications:", err);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchUserNotifications(true);

    // 10-second polling interval for real-time background notification updates
    const pollInterval = setInterval(() => {
      fetchUserNotifications(false);
    }, 10000);

    // Refetch on window focus
    const handleFocus = () => fetchUserNotifications(false);
    window.addEventListener("focus", handleFocus);

    const unsubscribe = onLerniqSync((detail) => {
      fetchUserNotifications(false);
      const p = detail.payload || {};

      // Sync classroom code in real-time across components
      if (detail.type === "CLASSROOM_CODE_UPDATED" && detail.payload?.code) {
        setClassCode(detail.payload.code);
      }

      // ONLY display quiz alert popup when a quiz is explicitly published or uploaded.
      // Personal messaging or announcements never trigger a quiz alert.
      if (!isTeacher) {
        if (detail.type === "QUIZ_UPLOADED" || detail.type === "QUIZ_PUBLISHED") {
          const qTitle = p.title || "Classroom Quiz";
          const qId = p._id || p.id;
          setQuizPopup({
            id: qId || `quiz-pop-${Date.now()}`,
            title: qTitle.startsWith("New Quiz") ? qTitle : `New Quiz: ${qTitle}`,
            message: p.description || p.message || `A new quiz "${qTitle}" was published to your classroom. Test your knowledge now!`,
            quizId: qId,
            link: `/student/quizzes?quizId=${qId}&action=solve`,
          });
        }
      }
    });

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener("focus", handleFocus);
      unsubscribe();
    };
  }, [user, isTeacher]);

  const handleToggleStudentNotifications = async () => {
    const nextState = !showStudentNotificationPopup;
    setShowStudentNotificationPopup(nextState);
    if (nextState && studentUnreadCount > 0) {
      try {
        await notificationApi.markAllRead();
        setUserNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      } catch (err) {
        console.warn("Error marking notifications read:", err);
      }
    }
  };

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

  const handleProfileClick = async () => {
    if (isTeacher) {
      setTeacherName(user?.name || "Prof. Sarah Jenkins");
      setTeacherSubjectState(getTeacherSubject());
      setInstitutionState(getInstitutionName());
      fetchRemovedStudents();

      // Ensure classCode in Teacher Profile matches Dashboard exactly
      try {
        const res = await teacherApi.getDashboard();
        if (res && res.teacherProfile && res.teacherProfile.teacherCode) {
          const realCode = res.teacherProfile.teacherCode;
          setClassCode(realCode);
          setTeacherClassCode(realCode, user?.id || user?._id || "default_teacher");
        }
      } catch {
        if (user?.profile?.teacherCode || user?.teacherCode) {
          setClassCode(user.profile?.teacherCode || user.teacherCode);
        }
      }

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

      {/* Real-time Quiz Notification Toast / Popup for Students */}
      {quizPopup && !isTeacher && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20 }}
          style={{
            position: "fixed",
            top: "76px",
            right: "24px",
            zIndex: 99999,
            background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
            color: "#ffffff",
            padding: "16px 20px",
            borderRadius: "16px",
            boxShadow: "0 14px 35px rgba(124, 58, 237, 0.4)",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            maxWidth: "420px",
            border: "1px solid rgba(255, 255, 255, 0.25)",
          }}
        >
          <span style={{ fontSize: "28px" }}>🎯</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px", color: "#c4b5fd" }}>
              Classroom Quiz Alert
            </div>
            <div style={{ fontSize: "14px", fontWeight: "700", color: "#ffffff", margin: "2px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {quizPopup.title}
            </div>
            <div style={{ fontSize: "12px", opacity: 0.9, lineHeight: "1.3" }}>
              {quizPopup.message}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <button
              onClick={() => {
                const targetLink = quizPopup.quizId
                  ? `/student/quizzes?quizId=${quizPopup.quizId}&action=solve`
                  : (quizPopup.link || "/student/quizzes");
                setQuizPopup(null);
                navigate(targetLink);
              }}
              style={{
                background: "#ffffff",
                color: "#6d28d9",
                border: "none",
                borderRadius: "8px",
                padding: "7px 12px",
                fontSize: "12px",
                fontWeight: "800",
                cursor: "pointer",
                whiteSpace: "nowrap",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}
            >
              Open Quiz →
            </button>
            <button
              onClick={() => setQuizPopup(null)}
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(255, 255, 255, 0.8)",
                fontSize: "11px",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              Dismiss
            </button>
          </div>
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
                    if (teacherUnreadCount > 0) {
                      notificationApi.markAllRead().catch(() => {});
                      setUserNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
                    }
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

                  <div style={{ maxHeight: "320px", overflowY: "auto", padding: "10px" }}>
                    {userNotifications.length > 0 && (
                      <div style={{ marginBottom: "10px" }}>
                        <div style={{ fontSize: "11px", fontWeight: "800", color: "#6d28d9", textTransform: "uppercase", padding: "2px 6px", marginBottom: "6px" }}>
                          Classroom Events & Submissions
                        </div>
                        {userNotifications.map((n) => (
                          <Link
                            key={n.id || n._id}
                            to={n.link || "/teacher/dashboard"}
                            onClick={() => setShowClassEntryPopup(false)}
                            style={{
                              display: "block",
                              textDecoration: "none",
                              padding: "10px 12px",
                              borderRadius: "10px",
                              background: n.isRead ? "#ffffff" : "#f5f3ff",
                              border: "1px solid",
                              borderColor: n.isRead ? "#f1f5f9" : "#ddd6fe",
                              marginBottom: "8px",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <div style={{ fontSize: "12px", fontWeight: "700", color: "#1e293b" }}>
                                {n.title}
                              </div>
                              {!n.isRead && (
                                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444" }} />
                              )}
                            </div>
                            <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px", lineHeight: "1.3" }}>
                              {n.message}
                            </div>
                            <div style={{ fontSize: "10px", color: "#8b5cf6", marginTop: "4px" }}>
                              {n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Recent"} • Click to view
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}

                    {classroomEntries.length > 0 && (
                      <div style={{ fontSize: "11px", fontWeight: "800", color: "#6d28d9", textTransform: "uppercase", padding: "2px 6px", marginBottom: "6px" }}>
                        Student Entrance Logs
                      </div>
                    )}

                    {userNotifications.length === 0 && classroomEntries.length === 0 ? (
                      <div style={{ padding: "24px 16px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                        <span style={{ fontSize: "28px", display: "block", marginBottom: "6px" }}>👋</span>
                        No recent alerts or student entries yet.
                        <br />
                        <small style={{ fontSize: "11px", color: "#cbd5e1" }}>
                          When a student completes a quiz, sends a message, or joins class, you will be notified here immediately.
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

          {/* STUDENT NOTIFICATION BELL & POPUP DROPDOWN (Requirement E) */}
          {!isTeacher && (
            <div style={{ position: "relative", marginRight: "14px" }}>
              <button
                type="button"
                className="icon-button notification-button"
                onClick={handleToggleStudentNotifications}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  border: studentUnreadCount > 0 ? "1.5px solid #a78bfa" : "1px solid #e2e8f0",
                  background: studentUnreadCount > 0 ? "#ede9fe" : "#ffffff",
                  color: studentUnreadCount > 0 ? "#6d28d9" : "#64748b",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  boxShadow: studentUnreadCount > 0 ? "0 4px 12px rgba(124, 58, 237, 0.2)" : "none",
                  transition: "all 0.2s ease",
                }}
                title="Classroom & Quiz Notifications"
                aria-label="Student Notifications"
              >
                <span style={{ fontSize: "16px" }}>🔔</span>
                {studentUnreadCount > 0 && (
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
                    {studentUnreadCount}
                  </span>
                )}
              </button>

              {/* Student Notification Dropdown */}
              {showStudentNotificationPopup && (
                <div
                  style={{
                    position: "absolute",
                    top: "46px",
                    right: 0,
                    width: "340px",
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
                        🔔 Classroom Notifications {studentUnreadCount > 0 && `(${studentUnreadCount} new)`}
                      </div>
                      <small style={{ opacity: 0.85, fontSize: "11px" }}>
                        Preserved classroom updates
                      </small>
                    </div>
                    <button
                      onClick={() => setShowStudentNotificationPopup(false)}
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

                  <div style={{ maxHeight: "320px", overflowY: "auto", padding: "10px" }}>
                    {studentNotifications.length === 0 ? (
                      <div style={{ padding: "28px 16px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                        <span style={{ fontSize: "28px", display: "block", marginBottom: "6px" }}>🔕</span>
                        No notifications yet.
                        <br />
                        <small style={{ fontSize: "11px", color: "#cbd5e1" }}>
                          When your teacher publishes quizzes, you'll see alerts here.
                        </small>
                      </div>
                    ) : (
                      studentNotifications.map((n) => (
                        <div
                          key={n._id || n.id}
                          style={{
                            padding: "12px 14px",
                            borderRadius: "12px",
                            background: n.isRead ? "#ffffff" : "#f5f3ff",
                            border: "1px solid",
                            borderColor: n.isRead ? "#f1f5f9" : "#ddd6fe",
                            marginBottom: "8px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: "12px", fontWeight: "800", color: "#7c3aed" }}>
                              {n.type === "announcement" ? "📢 " : n.type === "message" ? "💬 " : n.type === "note" ? "📚 " : n.type === "lecture" ? "🎥 " : n.type === "quiz" ? "🎯 " : "🔔 "}{n.title}
                            </span>
                            {!n.isRead && (
                              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444" }} />
                            )}
                          </div>
                          <p style={{ margin: 0, fontSize: "12px", color: "#475569", lineHeight: "1.4" }}>
                            {n.message}
                          </p>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                            <small style={{ fontSize: "10px", color: "#94a3b8" }}>
                              {n.createdAt ? new Date(n.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Just now"}
                            </small>
                            <button
                              onClick={() => {
                                setShowStudentNotificationPopup(false);
                                let targetLink = n.link || "/student/dashboard";
                                if (n.type === "quiz") {
                                  const qId = n.quizId || n.metadata?.quizId;
                                  targetLink = qId ? `/student/quizzes?quizId=${qId}&action=solve` : "/student/quizzes";
                                } else if (n.type === "note") {
                                  targetLink = "/student/lectures-notes?tab=notes";
                                } else if (n.type === "lecture") {
                                  targetLink = "/student/lectures-notes?tab=lectures";
                                } else if (n.type === "message") {
                                  targetLink = "/student/dashboard?tab=messages";
                                } else if (n.type === "announcement") {
                                  targetLink = "/student/dashboard?tab=announcements";
                                }
                                navigate(targetLink);
                              }}
                              style={{
                                background: "#ede9fe",
                                color: "#6d28d9",
                                border: "none",
                                borderRadius: "6px",
                                padding: "5px 10px",
                                fontSize: "11px",
                                fontWeight: "700",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              {n.type === "quiz" ? "Solve Now →" : n.type === "note" ? "View Notes →" : n.type === "lecture" ? "View Lecture →" : n.type === "message" ? "Reply Message →" : "View Announcement →"}
                            </button>
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
            <div className="profile-avatar" style={{ overflow: "hidden", padding: 0 }}>
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name || "Student"}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              ) : (
                user?.name ? user.name.charAt(0).toUpperCase() : isTeacher ? "P" : "S"
              )}
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

                            {/* Removed Students Section */}
              <div style={{ background: "#fef2f2", padding: "16px 18px", borderRadius: "14px", border: "1px solid #fecaca", marginBottom: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px", color: "#991b1b" }}>
                    🚫 REMOVED STUDENTS ({removedStudentsList.length})
                  </span>
                  <button
                    type="button"
                    onClick={fetchRemovedStudents}
                    style={{ background: "none", border: "none", color: "#b91c1c", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}
                  >
                    Refresh
                  </button>
                </div>
                <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#7f1d1d" }}>
                  Students removed from your classroom cannot rejoin using your code until you unremove them here. Their historical learning records remain intact.
                </p>
                {removedStudentsList.length === 0 ? (
                  <div style={{ fontSize: "12px", color: "#6b7280", fontStyle: "italic" }}>
                    No students currently removed from your classroom.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "160px", overflowY: "auto" }}>
                    {removedStudentsList.map((st) => (
                      <div
                        key={st.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 12px",
                          background: "#fff",
                          borderRadius: "8px",
                          border: "1px solid #fca5a5",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: "700", color: "#1f2937" }}>{st.name || "Student"}</div>
                          <div style={{ fontSize: "11px", color: "#6b7280" }}>{st.email} • Status: <span style={{ color: "#dc2626", fontWeight: "700" }}>Removed</span></div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUnremoveStudent(st.id)}
                          style={{
                            padding: "5px 10px",
                            background: "#dcfce7",
                            color: "#166534",
                            border: "1px solid #bbf7d0",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: "700",
                            cursor: "pointer",
                          }}
                        >
                          ↩ Unremove Student
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
