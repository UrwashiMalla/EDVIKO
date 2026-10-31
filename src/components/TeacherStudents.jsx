import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { teacherApi } from "../services/api";
import {
  getDirectMessages,
  sendDirectMessage,
  DEFAULT_STUDENTS_LIST,
  getRemovedStudentIds,
  addRemovedStudentId,
  restoreRemovedStudentId,
  restoreAllRemovedStudents,
} from "../services/frontendStorage";
import Navbar from "./Navbar";

function TeacherStudents() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [removedIds, setRemovedIds] = useState(() => getRemovedStudentIds());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  // Removal Modals & State
  const [studentToRemove, setStudentToRemove] = useState(null);
  const [showRemovedModal, setShowRemovedModal] = useState(false);
  const [lastRemoved, setLastRemoved] = useState(null);

  // Direct Message Modal State
  const [dmStudent, setDmStudent] = useState(null);
  const [dmMessages, setDmMessages] = useState([]);
  const [dmInput, setDmInput] = useState("");
  const [toast, setToast] = useState("");

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4500);
  };

  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      try {
        const res = await teacherApi.getStudents();
        const apiStudents = res.students || [];
        setStudents(apiStudents);
      } catch (err) {
        setError(err.message || "Failed to load students.");
        setStudents([]);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  // Remove handlers
  const handleOpenRemoveModal = (student) => {
    setStudentToRemove(student);
  };

  const handleConfirmRemove = async () => {
    if (!studentToRemove) return;
    const updated = addRemovedStudentId(studentToRemove.id, studentToRemove.email);
    setRemovedIds(updated);
    setLastRemoved(studentToRemove);

    try {
      if (studentToRemove.id && !String(studentToRemove.id).startsWith("std_") && studentToRemove.id !== "default_student") {
        await teacherApi.removeStudent(studentToRemove.id);
      }
    } catch (err) {
      console.warn("Backend remove student:", err.message);
    }

    showToast(`Permanently removed "${studentToRemove.name}". They cannot log in again with ${studentToRemove.email}.`);
    setStudentToRemove(null);
  };

  const handleRestoreStudent = (studentId) => {
    const updated = restoreRemovedStudentId(studentId);
    setRemovedIds(updated);
    const restored = allKnownStudents.find((s) => String(s.id) === String(studentId));
    showToast(`Restored "${restored ? restored.name : "Student"}" back to roster!`);
  };

  const handleRestoreAll = () => {
    restoreAllRemovedStudents();
    setRemovedIds([]);
    setShowRemovedModal(false);
    setLastRemoved(null);
    showToast("All students have been restored to your roster!");
  };

  const handleUndoRemove = () => {
    if (!lastRemoved) return;
    handleRestoreStudent(lastRemoved.id);
    setLastRemoved(null);
  };

  // Direct message handlers
  const handleOpenDM = async (student) => {
    setDmStudent(student);
    setDmMessages(getDirectMessages(student.id));

    // Fetch conversation from backend API
    try {
      const res = await teacherApi.getDirectMessages(student.id);
      if (res && res.messages && res.messages.length > 0) {
        const formatted = res.messages.map((m) => ({
          id: m._id,
          studentId: student.id,
          studentName: student.name,
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
        setDmMessages(formatted);
      }
    } catch (err) {
      console.warn("Could not load backend messages:", err.message);
    }
  };

  const handleSendDM = async (e) => {
    e.preventDefault();
    if (!dmInput.trim() || !dmStudent) return;

    const text = dmInput.trim();

    // 1. Send via backend API to store in MongoDB and create student Notification
    try {
      await teacherApi.sendDirectMessage(dmStudent.id, { text });
    } catch (err) {
      console.warn("Backend DM save error:", err.message);
    }

    // 2. Also save to frontend storage and sync bus
    const updated = sendDirectMessage(dmStudent.id, {
      senderRole: "teacher",
      senderName: user?.name || "Prof. Sarah Jenkins",
      text,
      studentName: dmStudent.name,
      studentEmail: dmStudent.email,
    });

    setDmMessages(updated);
    setDmInput("");
    showToast(`Personal message delivered to ${dmStudent.name}!`);
  };

  // Real students map for recovery
  const allKnownStudents = (() => {
    const map = new Map();
    students.forEach((s) => map.set(String(s.id), s));
    return Array.from(map.values());
  })();

  const activeStudents = students.filter(
    (s) => !removedIds.includes(String(s.id))
  );

  const filteredStudents = activeStudents.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q))
    );
  });

  const removedStudentsList = allKnownStudents.filter((s) =>
    removedIds.includes(String(s.id))
  );

  return (
    <div style={{ minHeight: "100vh", background: "#faf9ff" }}>
      <Navbar activeTab="students" />

      {/* Floating Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: "#1e1b4b",
            color: "#fff",
            padding: "14px 22px",
            borderRadius: "14px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            zIndex: 10000,
            fontSize: "14px",
            fontWeight: "600",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <span>✨</span>
          <span>{toast}</span>
          {lastRemoved && (
            <button
              onClick={handleUndoRemove}
              style={{
                marginLeft: "8px",
                padding: "4px 12px",
                background: "#7c3aed",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(124, 58, 237, 0.4)",
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}

      <main style={{ maxWidth: "1280px", margin: "40px auto", padding: "0 24px" }}>
        {/* Top Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "28px",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#1f2937", margin: 0 }}>
                Assigned Students
              </h1>
              <span
                style={{
                  background: "#ede9fe",
                  color: "#6d28d9",
                  padding: "4px 12px",
                  borderRadius: "20px",
                  fontSize: "13px",
                  fontWeight: "700",
                }}
              >
                {activeStudents.length} Active
              </span>
            </div>
            <p style={{ color: "#6b7280", marginTop: "6px", fontSize: "15px" }}>
              Comprehensive performance monitoring, document review, roster management, and direct personal messaging.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {removedStudentsList.length > 0 && (
              <button
                onClick={() => setShowRemovedModal(true)}
                style={{
                  padding: "10px 18px",
                  background: "#fee2e2",
                  color: "#b91c1c",
                  border: "1px solid #fecaca",
                  borderRadius: "12px",
                  fontWeight: "700",
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "background 0.2s",
                }}
              >
                <span>🗑️</span>
                <span>Removed Students ({removedStudentsList.length})</span>
              </button>
            )}

            <Link
              to="/teacher/dashboard"
              style={{
                padding: "10px 20px",
                background: "#ede9fe",
                color: "#6d28d9",
                borderRadius: "12px",
                fontWeight: 600,
                textDecoration: "none",
                fontSize: "14px",
              }}
            >
              ← Overview Dashboard
            </Link>
          </div>
        </div>

        {error && (
          <div style={{ padding: "14px 20px", background: "#fef2f2", color: "#b91c1c", borderRadius: "12px", marginBottom: "20px" }}>
            ⚠️ {error}
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div
          style={{
            background: "#fff",
            borderRadius: "16px",
            padding: "16px 20px",
            border: "1px solid #f3e8ff",
            boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          <div style={{ position: "relative", flex: "1 1 280px", maxWidth: "420px" }}>
            <span
              style={{
                position: "absolute",
                left: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: "15px",
                color: "#9ca3af",
                pointerEvents: "none",
              }}
            >
              🔍
            </span>
            <input
              type="text"
              placeholder="Filter by student name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px 10px 38px",
                borderRadius: "10px",
                border: "1.5px solid #e2e8f0",
                fontSize: "13px",
                outline: "none",
                background: "#faf9ff",
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", color: "#6b7280" }}>
            <span>
              Showing <strong>{filteredStudents.length}</strong> of {activeStudents.length} students
            </span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  background: "none",
                  border: "none",
                  color: "#7c3aed",
                  fontWeight: "600",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Clear filter
              </button>
            )}
          </div>
        </div>

        {/* Main Students Roster Card */}
        <div style={{ background: "#fff", borderRadius: "20px", padding: "28px", border: "1px solid #f3e8ff", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#7c3aed" }}>
              ⏳ Loading student roster...
            </div>
          ) : activeStudents.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 20px" }}>
              <div style={{ fontSize: "42px", marginBottom: "12px" }}>
                {removedStudentsList.length > 0 ? "🗑️" : "👥"}
              </div>
              <h3 style={{ fontSize: "18px", fontWeight: "800", color: "#1f2937", margin: "0 0 6px 0" }}>
                {removedStudentsList.length > 0 ? "All Students Removed from Roster" : "No Enrolled Students Found"}
              </h3>
              <p style={{ color: "#6b7280", margin: "0 0 20px 0", fontSize: "14px", maxWidth: "460px", marginLeft: "auto", marginRight: "auto" }}>
                {removedStudentsList.length > 0
                  ? "You have removed all students from your active roster view. You can restore them anytime with one click."
                  : "No students currently assigned to your class. Students can join using your teacher code."}
              </p>
              {removedStudentsList.length > 0 && (
                <button
                  onClick={handleRestoreAll}
                  style={{
                    padding: "10px 22px",
                    background: "#7c3aed",
                    color: "#fff",
                    border: "none",
                    borderRadius: "12px",
                    fontWeight: "700",
                    fontSize: "14px",
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(124, 58, 237, 0.3)",
                  }}
                >
                  ↩ Restore All Students
                </button>
              )}
            </div>
          ) : filteredStudents.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#6b7280" }}>
              No students found matching &quot;{searchQuery}&quot;.
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
                    <th style={{ padding: "12px 16px" }}>Average Accuracy</th>
                    <th style={{ padding: "12px 16px" }}>Personal Message</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => (
                    <tr
                      key={student.id}
                      style={{ borderBottom: "1px solid #f9fafb", cursor: "pointer", transition: "background 0.15s" }}
                      onClick={() => navigate(`/teacher/students/${student.id}`)}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#faf9ff")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "16px", fontWeight: "600", color: "#1f2937" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            style={{
                              width: "34px",
                              height: "34px",
                              borderRadius: "50%",
                              background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                              color: "#fff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "13px",
                              fontWeight: "700",
                              flexShrink: 0,
                            }}
                          >
                            {student.name ? student.name.charAt(0).toUpperCase() : "S"}
                          </div>
                          <span>{student.name}</span>
                        </div>
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
                            background:
                              (student.averageScore || 0) >= 70
                                ? "#dcfce7"
                                : (student.averageScore || 0) >= 40
                                ? "#fef3c7"
                                : "#fee2e2",
                            color:
                              (student.averageScore || 0) >= 70
                                ? "#15803d"
                                : (student.averageScore || 0) >= 40
                                ? "#92400e"
                                : "#b91c1c",
                          }}
                        >
                          {student.averageScore || 0}%
                        </span>
                      </td>
                      <td style={{ padding: "16px" }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDM(student);
                          }}
                          style={{
                            padding: "7px 14px",
                            background: "#ede9fe",
                            color: "#6d28d9",
                            border: "none",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: "700",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          <span>💬 Message Personally</span>
                        </button>
                      </td>
                      <td style={{ padding: "16px", textAlign: "right" }}>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            justifyContent: "flex-end",
                          }}
                        >
                          <Link
                            to={`/teacher/students/${student.id}`}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              color: "#7c3aed",
                              fontWeight: "700",
                              fontSize: "12px",
                              textDecoration: "none",
                              padding: "6px 12px",
                              background: "#f3e8ff",
                              borderRadius: "8px",
                              whiteSpace: "nowrap",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <span>Inspect</span>
                            <span>→</span>
                          </Link>

                          {/* REMOVE STUDENT BUTTON */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenRemoveModal(student);
                            }}
                            title={`Remove ${student.name} from class`}
                            style={{
                              padding: "6px 12px",
                              background: "#fef2f2",
                              color: "#dc2626",
                              border: "1px solid #fee2e2",
                              borderRadius: "8px",
                              fontSize: "12px",
                              fontWeight: "700",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              whiteSpace: "nowrap",
                              transition: "all 0.15s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#fee2e2";
                              e.currentTarget.style.borderColor = "#fca5a5";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "#fef2f2";
                              e.currentTarget.style.borderColor = "#fee2e2";
                            }}
                          >
                            <span>🗑️</span>
                            <span>Remove</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ================= MODAL: CONFIRM REMOVE STUDENT ================= */}
      {studentToRemove && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
          onClick={() => setStudentToRemove(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "20px",
              maxWidth: "480px",
              width: "100%",
              padding: "28px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid #fee2e2",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: "#fee2e2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "22px",
                  flexShrink: 0,
                }}
              >
                🗑️
              </div>
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#1f2937", margin: 0 }}>
                  Remove Student
                </h2>
                <span style={{ fontSize: "13px", color: "#6b7280" }}>
                  Confirm removal from active roster
                </span>
              </div>
            </div>

            <p style={{ fontSize: "14px", color: "#4b5563", lineHeight: 1.6, margin: "0 0 16px 0" }}>
              Are you sure you want to remove <strong>{studentToRemove.name}</strong> ({studentToRemove.email}) from your assigned students list?
            </p>

            <div
              style={{
                background: "#fef3c7",
                border: "1px solid #fde68a",
                borderRadius: "12px",
                padding: "12px 16px",
                fontSize: "13px",
                color: "#92400e",
                marginBottom: "24px",
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                lineHeight: 1.5,
              }}
            >
              <span>💡</span>
              <span>
                <strong>Notice:</strong> Once removed, this student cannot log in again with the email (<strong>{studentToRemove.email}</strong>). You can also view past removed students in the <strong>Removed Students</strong> tab.
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setStudentToRemove(null)}
                style={{
                  padding: "10px 18px",
                  background: "#f3f4f6",
                  color: "#374151",
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
                type="button"
                onClick={handleConfirmRemove}
                style={{
                  padding: "10px 20px",
                  background: "#dc2626",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: "700",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(220, 38, 38, 0.25)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>🗑️</span>
                <span>Yes, Remove Student</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: VIEW & RESTORE REMOVED STUDENTS ================= */}
      {showRemovedModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
          onClick={() => setShowRemovedModal(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "24px",
              maxWidth: "560px",
              width: "100%",
              padding: "28px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid #ede9fe",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#1f2937", margin: 0 }}>
                  Removed Students ({removedStudentsList.length})
                </h2>
                <span style={{ fontSize: "13px", color: "#6b7280" }}>
                  Restore individual students or all students back to your active roster
                </span>
              </div>
              <button
                onClick={() => setShowRemovedModal(false)}
                style={{
                  background: "#f3f4f6",
                  border: "none",
                  borderRadius: "50%",
                  width: "34px",
                  height: "34px",
                  cursor: "pointer",
                  fontWeight: "bold",
                  fontSize: "15px",
                }}
              >
                ✕
              </button>
            </div>

            {removedStudentsList.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: "#6b7280", fontSize: "14px" }}>
                No removed students to display.
              </div>
            ) : (
              <div style={{ maxHeight: "320px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", paddingRight: "4px" }}>
                {removedStudentsList.map((st) => (
                  <div
                    key={st.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      background: "#f9fafb",
                      borderRadius: "12px",
                      border: "1px solid #f3f4f6",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: "700", color: "#1f2937", fontSize: "14px" }}>{st.name}</div>
                      <div style={{ fontSize: "12px", color: "#6b7280" }}>{st.email}</div>
                    </div>
                    <button
                      onClick={() => handleRestoreStudent(st.id)}
                      style={{
                        padding: "6px 14px",
                        background: "#dcfce7",
                        color: "#15803d",
                        border: "1px solid #bbf7d0",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: "700",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span>↩</span>
                      <span>Restore</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {removedStudentsList.length > 0 && (
              <div
                style={{
                  marginTop: "20px",
                  paddingTop: "16px",
                  borderTop: "1px solid #f3f4f6",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <button
                  onClick={handleRestoreAll}
                  style={{
                    padding: "9px 18px",
                    background: "#7c3aed",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: "700",
                    cursor: "pointer",
                  }}
                >
                  ↩ Restore All Students
                </button>
                <button
                  onClick={() => setShowRemovedModal(false)}
                  style={{
                    padding: "9px 18px",
                    background: "#f3f4f6",
                    color: "#374151",
                    border: "none",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL: DIRECT PERSONAL MESSAGE TO STUDENT ================= */}
      {dmStudent && (
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
          onClick={() => setDmStudent(null)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "24px",
              maxWidth: "640px",
              width: "100%",
              overflow: "hidden",
              boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding: "24px", background: "linear-gradient(135deg, #4c1d95, #6d28d9)", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", background: "rgba(255,255,255,0.2)", padding: "3px 8px", borderRadius: "6px" }}>
                  PERSONAL 1-ON-1 MESSAGE
                </span>
                <h2 style={{ fontSize: "20px", fontWeight: "800", margin: "4px 0 2px 0" }}>
                  {dmStudent.name}
                </h2>
                <div style={{ fontSize: "12px", opacity: 0.85 }}>{dmStudent.email}</div>
              </div>
              <button
                onClick={() => setDmStudent(null)}
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
                  border: "none",
                  borderRadius: "50%",
                  width: "36px",
                  height: "36px",
                  fontSize: "16px",
                  cursor: "pointer",
                  color: "#fff",
                }}
              >
                ✕
              </button>
            </div>

            {/* Conversation Feed */}
            <div style={{ padding: "20px", maxHeight: "300px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px", background: "#faf9ff" }}>
              {dmMessages.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px", color: "#94a3b8", fontSize: "14px" }}>
                  No previous messages with {dmStudent.name}. Send your first message below.
                </div>
              ) : (
                dmMessages.map((msg) => {
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
                      <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "3px" }}>
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
                          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                          border: isFaculty ? "none" : "1px solid #e2e8f0",
                        }}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Send Input */}
            <form onSubmit={handleSendDM} style={{ padding: "16px 20px", background: "#fff", borderTop: "1px solid #f1f5f9", display: "flex", gap: "10px" }}>
              <input
                type="text"
                placeholder={`Write private message to ${dmStudent.name}...`}
                value={dmInput}
                onChange={(e) => setDmInput(e.target.value)}
                style={{ flex: 1, padding: "12px 16px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "13px" }}
              />
              <button
                type="submit"
                disabled={!dmInput.trim()}
                style={{
                  padding: "12px 22px",
                  background: dmInput.trim() ? "#6d28d9" : "#e2e8f0",
                  color: dmInput.trim() ? "#fff" : "#94a3b8",
                  border: "none",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: "700",
                  cursor: dmInput.trim() ? "pointer" : "default",
                }}
              >
                Send Message
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeacherStudents;
