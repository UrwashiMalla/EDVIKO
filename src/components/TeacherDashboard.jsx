import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/useAuth";
import { teacherApi } from "../services/api";
import {
  getInstitutionName,
  setInstitutionName,
  getTeacherBroadcasts,
  saveTeacherBroadcast,
  deleteTeacherBroadcast,
  getDirectMessages,
  sendDirectMessage,
  getTeacherQuizzes,
  getUploadedNotes,
  uploadNote,
  DEFAULT_STUDENTS_LIST,
} from "../services/frontendStorage";
import Navbar from "./Navbar";

function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Frontend states for modal and actions
  const [institution, setInstitution] = useState(getInstitutionName());
  const [showEditInstModal, setShowEditInstModal] = useState(false);
  const [tempInstName, setTempInstName] = useState(getInstitutionName());

  // Message modal
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageTab, setMessageTab] = useState("broadcast"); // "broadcast" or "direct"
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastContent, setBroadcastContent] = useState("");
  const [broadcastPriority, setBroadcastPriority] = useState("Normal");
  const [broadcastTag, setBroadcastTag] = useState("Announcement");
  const [broadcastList, setBroadcastList] = useState([]);

  // Direct messages with student
  const [selectedStudentForDM, setSelectedStudentForDM] = useState("default_student");
  const [teacherReplyText, setTeacherReplyText] = useState("");
  const [directMessages, setDirectMessages] = useState([]);

  // Quick upload notes modal
  const [showUploadNotesModal, setShowUploadNotesModal] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteSubject, setNoteSubject] = useState("Artificial Intelligence");
  const [noteDescription, setNoteDescription] = useState("");

  // Quick Toast
  const [toast, setToast] = useState("");

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [dashRes, studentsRes] = await Promise.all([
          teacherApi.getDashboard(),
          teacherApi.getStudents(),
        ]);
        setDashboardData(dashRes);
        setStudents(studentsRes.students || []);
      } catch (err) {
        console.error("Teacher Dashboard Error:", err);
        setError(err.message || "Failed to load faculty dashboard.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    setInstitution(getInstitutionName());
    setBroadcastList(getTeacherBroadcasts());
    setDirectMessages(getDirectMessages(selectedStudentForDM));
  }, [selectedStudentForDM]);

  const teacherCode = dashboardData?.teacherProfile?.teacherCode || "TEACH-101";
  const recentActivity = dashboardData?.recentActivity || [];

  // Dynamic quizzes conducted from frontend storage
  const conductedQuizzes = getTeacherQuizzes();
  const totalQuizzesConducted = conductedQuizzes.length;

  const stats = dashboardData?.stats || {
    totalStudents: 0,
    averageStudentScore: 0,
  };

  const handleSaveInstitution = (e) => {
    e.preventDefault();
    if (tempInstName.trim()) {
      setInstitutionName(tempInstName.trim());
      setInstitution(tempInstName.trim());
      setShowEditInstModal(false);
      showToast("Institution name saved! It will now appear on student profiles.");
    }
  };

  const handleSendBroadcast = (e) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastContent.trim()) return;

    const updated = saveTeacherBroadcast({
      title: broadcastTitle.trim(),
      content: broadcastContent.trim(),
      priority: broadcastPriority,
      tag: broadcastTag,
      teacherName: user?.name || "Prof. Sarah Jenkins",
    });

    setBroadcastList(updated);
    setBroadcastTitle("");
    setBroadcastContent("");
    showToast("Announcement published! Students can view it on their dashboard.");
  };

  const handleDeleteBroadcast = (id) => {
    const updated = deleteTeacherBroadcast(id);
    setBroadcastList(updated);
    showToast("Announcement removed.");
  };

  // Merge students roster for personal messaging selector
  const availableStudentsForDM = (() => {
    const combined = [...students];
    const ids = new Set(combined.map((s) => s.id));
    DEFAULT_STUDENTS_LIST.forEach((s) => {
      if (!ids.has(s.id)) combined.push(s);
    });
    return combined;
  })();

  const handleTeacherReply = (e) => {
    e.preventDefault();
    if (!teacherReplyText.trim()) return;

    const currentStudentObj = availableStudentsForDM.find((s) => s.id === selectedStudentForDM) || { name: "Student" };

    const updated = sendDirectMessage(selectedStudentForDM, {
      senderRole: "teacher",
      senderName: user?.name || "Prof. Sarah Jenkins",
      text: teacherReplyText.trim(),
      studentName: currentStudentObj.name,
    });

    setDirectMessages(updated);
    setTeacherReplyText("");
    showToast(`Personal message sent to ${currentStudentObj.name}!`);
  };

  const handleQuickUploadNote = (e) => {
    e.preventDefault();
    if (!noteTitle.trim()) return;

    uploadNote({
      title: noteTitle.trim(),
      subject: noteSubject.trim(),
      description: noteDescription.trim() || "Uploaded by course faculty.",
      content: noteDescription.trim() || "Detailed lecture summary notes provided by faculty.",
    });

    setNoteTitle("");
    setNoteDescription("");
    setShowUploadNotesModal(false);
    showToast("Study notes uploaded successfully!");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#faf9ff" }}>
      <Navbar activeTab="dashboard" />

      {/* Floating Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: "#1e1b4b",
            color: "#fff",
            padding: "14px 24px",
            borderRadius: "14px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            zIndex: 10000,
            fontSize: "14px",
            fontWeight: "600",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span>✨</span>
          <span>{toast}</span>
        </div>
      )}

      <main style={{ maxWidth: "1280px", margin: "40px auto", padding: "0 24px" }}>
        {/* Banner */}
        <div
          style={{
            background: "linear-gradient(135deg, #4c1d95 0%, #6d28d9 100%)",
            color: "#fff",
            borderRadius: "24px",
            padding: "36px",
            marginBottom: "36px",
            boxShadow: "0 10px 30px -5px rgba(109, 40, 217, 0.3)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "24px",
          }}
        >
          <div style={{ maxWidth: "560px" }}>
            <span style={{ fontSize: "12px", letterSpacing: "1px", textTransform: "uppercase", background: "rgba(255,255,255,0.2)", padding: "4px 12px", borderRadius: "8px", fontWeight: "bold" }}>
              FACULTY OVERVIEW
            </span>
            <h1 style={{ fontSize: "30px", fontWeight: "800", margin: "12px 0 6px 0" }}>
              Welcome, {user?.name || "Professor"}! 🎓
            </h1>
            <p style={{ margin: 0, opacity: 0.9, fontSize: "15px" }}>
              Monitor student engagement, upload learning materials, and conduct live quizzes.
            </p>

            {/* University / School / College Display */}
            <div
              style={{
                marginTop: "16px",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(255,255,255,0.18)",
                padding: "6px 14px",
                borderRadius: "12px",
                fontSize: "13px",
                border: "1px solid rgba(255,255,255,0.3)",
              }}
            >
              <span>🏛️</span>
              <strong>{institution}</strong>
              <button
                onClick={() => {
                  setTempInstName(institution);
                  setShowEditInstModal(true);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: "12px",
                  marginLeft: "4px",
                  textDecoration: "underline",
                  opacity: 0.9,
                }}
              >
                (Edit)
              </button>
            </div>
          </div>

          {/* Action Buttons: Send Message, Upload Notes, Conduct Quiz */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              minWidth: "200px",
            }}
          >
            {/* Button 1: Send Message */}
            <button
              onClick={() => {
                setBroadcastList(getTeacherBroadcasts());
                setShowMessageModal(true);
              }}
              style={{
                padding: "11px 22px",
                background: "#ffffff",
                color: "#6d28d9",
                border: "none",
                borderRadius: "14px",
                fontWeight: "700",
                fontSize: "14px",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(0, 0, 0, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(0, 0, 0, 0.18)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 14px rgba(0, 0, 0, 0.12)";
              }}
            >
              <span>✉️</span>
              <span>Send Message</span>
            </button>

            {/* Button 2: Upload Notes */}
            <button
              onClick={() => setShowUploadNotesModal(true)}
              style={{
                padding: "11px 22px",
                background: "rgba(255, 255, 255, 0.2)",
                backdropFilter: "blur(8px)",
                color: "#ffffff",
                border: "1px solid rgba(255, 255, 255, 0.35)",
                borderRadius: "14px",
                fontWeight: "700",
                fontSize: "14px",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(0, 0, 0, 0.06)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
              }}
            >
              <span>📄</span>
              <span>Upload Notes</span>
            </button>

            {/* Button 3: Conduct Quiz */}
            <button
              onClick={() => navigate("/teacher/documents?tab=quizzes")}
              style={{
                padding: "11px 22px",
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: "14px",
                fontWeight: "700",
                fontSize: "14px",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(16, 185, 129, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(16, 185, 129, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 14px rgba(16, 185, 129, 0.3)";
              }}
            >
              <span>🎯</span>
              <span>Conduct Quiz</span>
            </button>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(8px)",
              padding: "16px 24px",
              borderRadius: "16px",
              textAlign: "center",
              border: "1px solid rgba(255,255,255,0.25)",
            }}
          >
            <div style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", opacity: 0.85 }}>
              YOUR CLASS CODE
            </div>
            <div style={{ fontSize: "28px", fontWeight: "800", letterSpacing: "2px", marginTop: "4px" }}>
              {teacherCode}
            </div>
            <small style={{ fontSize: "11px", opacity: 0.8 }}>Share with students to auto-link</small>
          </div>
        </div>

        {error && (
          <div style={{ padding: "14px 20px", background: "#fef2f2", color: "#b91c1c", borderRadius: "12px", marginBottom: "24px" }}>
            ⚠️ {error}
          </div>
        )}

        {/* 3 UPDATED STATS CARDS (Student Documents card removed, Quiz Attempts changed to Quizzes Conducted) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px", marginBottom: "40px" }}>
          {/* Card 1: Total Enrolled Students */}
          <div style={{ background: "#fff", padding: "26px", borderRadius: "20px", border: "1px solid #f3e8ff", boxShadow: "0 4px 15px rgba(0,0,0,0.03)" }}>
            <span style={{ fontSize: "28px" }}>👨‍🎓</span>
            <div style={{ fontSize: "13px", color: "#6b7280", fontWeight: "700", marginTop: "12px" }}>
              TOTAL ENROLLED STUDENTS
            </div>
            <div style={{ fontSize: "34px", fontWeight: "800", color: "#1f2937", marginTop: "4px" }}>
              {loading ? "..." : (students.length || stats.totalStudents)}
            </div>
            <small style={{ color: "#7c3aed", fontWeight: "600" }}>Active students in your classes</small>
          </div>

          {/* Card 2: Quizzes Conducted (Changed from Quiz Attempts as requested) */}
          <div
            style={{ background: "#fff", padding: "26px", borderRadius: "20px", border: "1px solid #f3e8ff", boxShadow: "0 4px 15px rgba(0,0,0,0.03)", cursor: "pointer" }}
            onClick={() => navigate("/teacher/documents?tab=quizzes")}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span style={{ fontSize: "28px" }}>🎯</span>
              <span style={{ fontSize: "12px", background: "#ecfdf5", color: "#059669", padding: "4px 8px", borderRadius: "6px", fontWeight: "700" }}>
                + Conduct New
              </span>
            </div>
            <div style={{ fontSize: "13px", color: "#6b7280", fontWeight: "700", marginTop: "12px" }}>
              QUIZZES CONDUCTED
            </div>
            <div style={{ fontSize: "34px", fontWeight: "800", color: "#1f2937", marginTop: "4px" }}>
              {totalQuizzesConducted}
            </div>
            <small style={{ color: "#059669", fontWeight: "600" }}>Active quizzes managed by you</small>
          </div>

          {/* Card 3: Class Average Score */}
          <div style={{ background: "#fff", padding: "26px", borderRadius: "20px", border: "1px solid #f3e8ff", boxShadow: "0 4px 15px rgba(0,0,0,0.03)" }}>
            <span style={{ fontSize: "28px" }}>🏆</span>
            <div style={{ fontSize: "13px", color: "#6b7280", fontWeight: "700", marginTop: "12px" }}>
              CLASS AVERAGE SCORE
            </div>
            <div style={{ fontSize: "34px", fontWeight: "800", color: "#1f2937", marginTop: "4px" }}>
              {loading ? "..." : `${stats.averageStudentScore || 81}%`}
            </div>
            <small style={{ color: "#2563eb", fontWeight: "600" }}>
              Overall accuracy across student attempts
            </small>
          </div>
        </div>

        {/* ASSIGNED STUDENTS TABLE */}
        <section style={{ background: "#fff", borderRadius: "20px", padding: "28px", border: "1px solid #f3e8ff", marginBottom: "40px", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#1f2937", margin: 0 }}>
                Enrolled Students
              </h2>
              <p style={{ color: "#6b7280", fontSize: "14px", marginTop: "4px" }}>
                Manage students, track performance, and inspect individual quiz history.
              </p>
            </div>

            <span style={{ fontSize: "14px", fontWeight: "600", color: "#7c3aed" }}>
              {students.length} Total Students
            </span>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#7c3aed" }}>
              ⏳ Loading student roster...
            </div>
          ) : students.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#6b7280" }}>
              No students have joined with code <strong>{teacherCode}</strong> yet. Students can enter this code during signup!
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #f3f4f6", color: "#6b7280", fontSize: "12px", textTransform: "uppercase" }}>
                    <th style={{ padding: "12px 16px" }}>Student Name</th>
                    <th style={{ padding: "12px 16px" }}>Email</th>
                    <th style={{ padding: "12px 16px" }}>Documents</th>
                    <th style={{ padding: "12px 16px" }}>Quiz Attempts</th>
                    <th style={{ padding: "12px 16px" }}>Average Score</th>
                    <th style={{ padding: "12px 16px" }}>Direct Message</th>
                    <th style={{ padding: "12px 16px" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr
                      key={student.id}
                      style={{ borderBottom: "1px solid #f9fafb", cursor: "pointer", transition: "background 0.2s" }}
                      onClick={() => navigate(`/teacher/students/${student.id}`)}
                    >
                      <td style={{ padding: "16px", fontWeight: "600", color: "#1f2937" }}>
                        {student.name}
                      </td>
                      <td style={{ padding: "16px", color: "#6b7280", fontSize: "14px" }}>
                        {student.email}
                      </td>
                      <td style={{ padding: "16px", color: "#1f2937", fontWeight: "600" }}>
                        {student.totalDocuments || 0}
                      </td>
                      <td style={{ padding: "16px", color: "#1f2937", fontWeight: "600" }}>
                        {student.totalQuizAttempts || 0}
                      </td>
                      <td style={{ padding: "16px" }}>
                        <span
                          style={{
                            fontWeight: "bold",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            fontSize: "13px",
                            background: (student.averageScore || 0) >= 70 ? "#dcfce7" : (student.averageScore || 0) >= 40 ? "#fef3c7" : "#fee2e2",
                            color: (student.averageScore || 0) >= 70 ? "#15803d" : (student.averageScore || 0) >= 40 ? "#92400e" : "#b91c1c",
                          }}
                        >
                          {student.averageScore || 0}%
                        </span>
                      </td>
                      <td style={{ padding: "16px" }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedStudentForDM(student.id || "default_student");
                            setMessageTab("direct");
                            setShowMessageModal(true);
                          }}
                          style={{
                            padding: "6px 12px",
                            background: "#ede9fe",
                            color: "#6d28d9",
                            border: "none",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: "700",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <span>💬 Message</span>
                        </button>
                      </td>
                      <td style={{ padding: "16px" }}>
                        <Link
                          to={`/teacher/students/${student.id}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            color: "#7c3aed",
                            fontWeight: "700",
                            fontSize: "13px",
                            textDecoration: "none",
                          }}
                        >
                          View Details →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* RECENT QUIZ SUBMISSIONS FEED */}
        {recentActivity.length > 0 && (
          <section style={{ background: "#fff", borderRadius: "20px", padding: "28px", border: "1px solid #f3e8ff", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#1f2937", marginBottom: "16px" }}>
              Live Student Quiz Submissions
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {recentActivity.map((act) => (
                <div
                  key={act.id}
                  style={{
                    padding: "14px 20px",
                    background: "#fbfaff",
                    borderRadius: "12px",
                    border: "1px solid #f3e8ff",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong style={{ color: "#1f2937", fontSize: "14px" }}>{act.studentName}</strong>{" "}
                    <span style={{ color: "#6b7280", fontSize: "13px" }}>
                      completed quiz on <em>"{act.documentTitle}"</em>
                    </span>
                    <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>
                      {new Date(act.timestamp).toLocaleString()}
                    </div>
                  </div>

                  <span
                    style={{
                      fontWeight: "bold",
                      fontSize: "14px",
                      color: act.percentage >= 70 ? "#059669" : "#d97706",
                    }}
                  >
                    {act.score}/{act.totalQuestions} ({act.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* ================= MODAL: EDIT UNIVERSITY / INSTITUTION ================= */}
      {showEditInstModal && (
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
          onClick={() => setShowEditInstModal(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "20px",
              maxWidth: "500px",
              width: "100%",
              padding: "28px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#1e293b", margin: "0 0 8px 0" }}>
              🏛️ University / School / College Name
            </h2>
            <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 20px 0" }}>
              This institution name is displayed on your faculty profile and on all of your enrolled students' profiles as verified read-only.
            </p>

            <form onSubmit={handleSaveInstitution}>
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                  Institution Name
                </label>
                <input
                  type="text"
                  value={tempInstName}
                  onChange={(e) => setTempInstName(e.target.value)}
                  placeholder="e.g. Stanford University / MIT / Delhi University"
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    borderRadius: "10px",
                    border: "1.5px solid #cbd5e1",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                  required
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowEditInstModal(false)}
                  style={{
                    padding: "10px 18px",
                    background: "#f1f5f9",
                    color: "#475569",
                    border: "none",
                    borderRadius: "10px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "10px 22px",
                    background: "#6d28d9",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "10px",
                    fontWeight: "700",
                    cursor: "pointer",
                  }}
                >
                  Save Institution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: TEACHER MESSAGING (BROADCAST & DIRECT) ================= */}
      {showMessageModal && (
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
          onClick={() => setShowMessageModal(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "24px",
              maxWidth: "760px",
              width: "100%",
              maxHeight: "88vh",
              overflowY: "auto",
              padding: "32px",
              boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", background: "#ede9fe", color: "#6d28d9", padding: "4px 10px", borderRadius: "8px" }}>
                  COMMUNICATIONS CENTER
                </span>
                <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#1e293b", margin: "8px 0 0 0" }}>
                  ✉️ Faculty Messaging
                </h2>
              </div>
              <button
                onClick={() => setShowMessageModal(false)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "50%",
                  width: "36px",
                  height: "36px",
                  fontSize: "16px",
                  cursor: "pointer",
                  color: "#64748b",
                }}
              >
                ✕
              </button>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: "flex", gap: "10px", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px", marginBottom: "24px" }}>
              <button
                onClick={() => setMessageTab("broadcast")}
                style={{
                  padding: "8px 18px",
                  borderRadius: "10px",
                  border: "none",
                  background: messageTab === "broadcast" ? "#6d28d9" : "#f1f5f9",
                  color: messageTab === "broadcast" ? "#ffffff" : "#475569",
                  fontWeight: "700",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                📢 Broadcast to All Students ({broadcastList.length})
              </button>
              <button
                onClick={() => setMessageTab("direct")}
                style={{
                  padding: "8px 18px",
                  borderRadius: "10px",
                  border: "none",
                  background: messageTab === "direct" ? "#6d28d9" : "#f1f5f9",
                  color: messageTab === "direct" ? "#ffffff" : "#475569",
                  fontWeight: "700",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                💬 1-on-1 Student Inquiries
              </button>
            </div>

            {/* TAB 1: BROADCAST ANNOUNCEMENT */}
            {messageTab === "broadcast" ? (
              <div>
                <form onSubmit={handleSendBroadcast} style={{ background: "#faf5ff", padding: "20px", borderRadius: "16px", border: "1px solid #ede9fe", marginBottom: "24px" }}>
                  <h3 style={{ margin: "0 0 12px 0", fontSize: "16px", color: "#4c1d95" }}>
                    Compose New Class Announcement
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 140px", gap: "10px", marginBottom: "12px" }}>
                    <input
                      type="text"
                      placeholder="Announcement Subject / Title"
                      value={broadcastTitle}
                      onChange={(e) => setBroadcastTitle(e.target.value)}
                      style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      required
                    />
                    <select
                      value={broadcastTag}
                      onChange={(e) => setBroadcastTag(e.target.value)}
                      style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                    >
                      <option value="Announcement">Announcement</option>
                      <option value="Assignment">Assignment</option>
                      <option value="Materials">Materials</option>
                      <option value="Exam / Quiz">Exam / Quiz</option>
                    </select>
                    <select
                      value={broadcastPriority}
                      onChange={(e) => setBroadcastPriority(e.target.value)}
                      style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                    >
                      <option value="Normal">Normal Priority</option>
                      <option value="High">High Priority 🔥</option>
                    </select>
                  </div>

                  <textarea
                    rows={3}
                    placeholder="Write instructions, quiz notices, or study reminders to your students..."
                    value={broadcastContent}
                    onChange={(e) => setBroadcastContent(e.target.value)}
                    style={{ width: "100%", padding: "12px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box", marginBottom: "12px" }}
                    required
                  />

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="submit"
                      style={{
                        padding: "10px 22px",
                        background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "10px",
                        fontSize: "13px",
                        fontWeight: "700",
                        cursor: "pointer",
                      }}
                    >
                      Publish Announcement →
                    </button>
                  </div>
                </form>

                {/* Broadcast History */}
                <h4 style={{ margin: "0 0 12px 0", fontSize: "15px", color: "#1e293b" }}>
                  Published Announcements History
                </h4>
                {broadcastList.length === 0 ? (
                  <p style={{ color: "#94a3b8", fontSize: "13px" }}>No announcements published yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {broadcastList.map((msg) => (
                      <div
                        key={msg.id}
                        style={{
                          background: "#fff",
                          border: "1px solid #e2e8f0",
                          borderRadius: "12px",
                          padding: "16px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                            <span style={{ fontSize: "11px", fontWeight: "700", background: "#ede9fe", color: "#6d28d9", padding: "2px 8px", borderRadius: "6px" }}>
                              {msg.tag}
                            </span>
                            <strong style={{ fontSize: "14px", color: "#1e293b" }}>{msg.title}</strong>
                            <span style={{ fontSize: "11px", color: "#94a3b8" }}>{msg.date}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: "13px", color: "#475569", lineHeight: "1.5" }}>
                            {msg.content}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteBroadcast(msg.id)}
                          style={{
                            background: "#fee2e2",
                            color: "#b91c1c",
                            border: "none",
                            borderRadius: "6px",
                            padding: "6px 10px",
                            fontSize: "12px",
                            fontWeight: "600",
                            cursor: "pointer",
                            marginLeft: "12px",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* TAB 2: DIRECT STUDENT MESSAGES (SEND PERSONALLY TO ANY STUDENT) */
              <div>
                <div style={{ background: "#f8fafc", padding: "16px 20px", borderRadius: "14px", border: "1px solid #e2e8f0", marginBottom: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      SELECT STUDENT TO MESSAGE PERSONALLY
                    </span>
                    <span style={{ fontSize: "11px", color: "#059669", background: "#ecfdf5", padding: "3px 8px", borderRadius: "6px", fontWeight: "700" }}>
                      🔒 Direct 1-on-1 Channel
                    </span>
                  </div>

                  <select
                    value={selectedStudentForDM}
                    onChange={(e) => {
                      setSelectedStudentForDM(e.target.value);
                      setDirectMessages(getDirectMessages(e.target.value));
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: "1.5px solid #cbd5e1",
                      fontSize: "14px",
                      fontWeight: "700",
                      color: "#1e293b",
                      background: "#ffffff",
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    {availableStudentsForDM.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.email})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Message Feed */}
                <div style={{ background: "#faf9ff", borderRadius: "16px", padding: "20px", maxHeight: "300px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px", border: "1px solid #ede9fe" }}>
                  {directMessages.map((msg) => {
                    const isFaculty = msg.senderRole === "teacher";
                    return (
                      <div
                        key={msg.id}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: isFaculty ? "flex-end" : "flex-start",
                        }}
                      >
                        <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>
                          {isFaculty ? "You (Faculty)" : msg.senderName} • {msg.timestamp}
                        </div>
                        <div
                          style={{
                            maxWidth: "80%",
                            padding: "10px 16px",
                            borderRadius: isFaculty ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                            background: isFaculty ? "#6d28d9" : "#ffffff",
                            color: isFaculty ? "#ffffff" : "#1e293b",
                            fontSize: "13px",
                            border: isFaculty ? "none" : "1px solid #e2e8f0",
                          }}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Reply Box */}
                <form onSubmit={handleTeacherReply} style={{ display: "flex", gap: "10px" }}>
                  <input
                    type="text"
                    placeholder="Reply to Alex Smith..."
                    value={teacherReplyText}
                    onChange={(e) => setTeacherReplyText(e.target.value)}
                    style={{ flex: 1, padding: "12px 16px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "13px" }}
                  />
                  <button
                    type="submit"
                    style={{
                      padding: "12px 22px",
                      background: "#6d28d9",
                      color: "#fff",
                      border: "none",
                      borderRadius: "10px",
                      fontSize: "13px",
                      fontWeight: "700",
                      cursor: "pointer",
                    }}
                  >
                    Send Reply
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL: QUICK UPLOAD NOTES ================= */}
      {showUploadNotesModal && (
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
          onClick={() => setShowUploadNotesModal(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "24px",
              maxWidth: "580px",
              width: "100%",
              padding: "32px",
              boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1e293b", margin: 0 }}>
                📄 Upload Course Study Notes
              </h2>
              <button
                onClick={() => setShowUploadNotesModal(false)}
                style={{
                  background: "#f1f5f9",
                  border: "none",
                  borderRadius: "50%",
                  width: "36px",
                  height: "36px",
                  fontSize: "16px",
                  cursor: "pointer",
                  color: "#64748b",
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleQuickUploadNote}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                  Note Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Heuristic Search Strategies Summary"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
                  required
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                  Subject / Topic
                </label>
                <select
                  value={noteSubject}
                  onChange={(e) => setNoteSubject(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
                >
                  <option value="Artificial Intelligence">Artificial Intelligence</option>
                  <option value="Deep Learning">Deep Learning</option>
                  <option value="Database Systems">Database Systems</option>
                  <option value="Computer Networks">Computer Networks</option>
                </select>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                  Notes Content / Key Takeaways
                </label>
                <textarea
                  rows={4}
                  placeholder="Paste lecture takeaway bullets, key formulas, or reference guidance..."
                  value={noteDescription}
                  onChange={(e) => setNoteDescription(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box" }}
                  required
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Link
                  to="/teacher/documents?tab=notes"
                  onClick={() => setShowUploadNotesModal(false)}
                  style={{ fontSize: "13px", color: "#6d28d9", fontWeight: "600", textDecoration: "none" }}
                >
                  View full notes manager →
                </Link>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setShowUploadNotesModal(false)}
                    style={{ padding: "10px 18px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: "10px", fontWeight: "600", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ padding: "10px 22px", background: "#6d28d9", color: "#fff", border: "none", borderRadius: "10px", fontWeight: "700", cursor: "pointer" }}
                  >
                    Publish Notes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeacherDashboard;
