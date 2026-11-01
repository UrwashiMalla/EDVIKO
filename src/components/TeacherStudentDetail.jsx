import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { teacherApi } from "../services/api";
import {
  getDirectMessages,
  sendDirectMessage,
  getRemovedStudentIds,
  addRemovedStudentId,
  restoreRemovedStudentId,
} from "../services/frontendStorage";
import Navbar from "./Navbar";

function TeacherStudentDetail() {
  const { user } = useAuth();
  const { studentId, id } = useParams();
  const effectiveStudentId = studentId || id;
  const navigate = useNavigate();

  const [studentData, setStudentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // DM Modal
  const [showDM, setShowDM] = useState(false);
  const [dmMessages, setDmMessages] = useState([]);
  const [dmInput, setDmInput] = useState("");
  const [toast, setToast] = useState("");
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [isRemoved, setIsRemoved] = useState(() => {
    const list = getRemovedStudentIds();
    return list.includes(String(effectiveStudentId));
  });

  const handleConfirmRemove = async () => {
    addRemovedStudentId(effectiveStudentId, studentData?.student?.email);
    setIsRemoved(true);
    setShowRemoveConfirm(false);

    try {
      if (effectiveStudentId && !String(effectiveStudentId).startsWith("std_") && effectiveStudentId !== "default_student") {
        await teacherApi.removeStudent(effectiveStudentId);
      }
    } catch (err) {
      console.warn("Backend remove student error:", err.message);
    }

    showToast(`Permanently removed ${studentData?.student?.name || "student"}. They cannot log in again with this email.`);
    setTimeout(() => {
      navigate("/teacher/students");
    }, 1500);
  };

  const handleRestore = () => {
    restoreRemovedStudentId(effectiveStudentId);
    setIsRemoved(false);
    showToast(`Restored ${studentData?.student?.name || "student"} back to active roster!`);
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  useEffect(() => {
    let ignore = false;
    const fetchDetail = async () => {
      setLoading(true);
      try {
        const res = await teacherApi.getStudentDetails(effectiveStudentId);
        if (!ignore) {
          setStudentData(res);
        }
      } catch (err) {
        if (!ignore) {
          console.error("Student detail error:", err);
          setError(err.message || "Failed to load student details.");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    fetchDetail();
    return () => {
      ignore = true;
    };
  }, [effectiveStudentId]);

  const handleOpenDM = async () => {
    setDmMessages(getDirectMessages(effectiveStudentId));
    setShowDM(true);
    try {
      const res = await teacherApi.getDirectMessages(effectiveStudentId);
      if (res && res.messages && res.messages.length > 0) {
        setDmMessages(
          res.messages.map((m) => ({
            id: m._id,
            studentId: effectiveStudentId,
            studentName: studentData?.student?.name || "Student",
            senderRole: m.senderRole,
            senderName: m.senderName,
            text: m.text,
            timestamp: new Date(m.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
          }))
        );
      }
    } catch (err) {
      console.warn("Could not load direct messages from backend:", err.message);
    }
  };

  const handleSendDM = async (e) => {
    e.preventDefault();
    if (!dmInput.trim()) return;

    const text = dmInput.trim();
    const studentName = studentData?.student?.name || "Student";
    const studentEmail = studentData?.student?.email || "";

    // 1. Send via backend API to store in MongoDB and trigger notification
    try {
      await teacherApi.sendDirectMessage(effectiveStudentId, { text });
    } catch (err) {
      console.warn("Backend direct message error:", err.message);
    }

    // 2. Also save to frontend storage and sync bus
    const updated = sendDirectMessage(effectiveStudentId, {
      senderRole: "teacher",
      senderName: user?.name || "Prof. Sarah Jenkins",
      text,
      studentName,
      studentEmail,
    });

    // 3. Immediately refresh from backend
    try {
      const res = await teacherApi.getDirectMessages(effectiveStudentId);
      if (res && res.messages && res.messages.length > 0) {
        setDmMessages(
          res.messages.map((m) => ({
            id: m._id,
            studentId: effectiveStudentId,
            studentName,
            senderRole: m.senderRole,
            senderName: m.senderName,
            text: m.text,
            timestamp: new Date(m.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
          }))
        );
      } else {
        setDmMessages(updated);
      }
    } catch {
      setDmMessages(updated);
    }

    setDmInput("");
    showToast(`Personal message delivered to ${studentName}!`);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#faf9ff" }}>
        <Navbar activeTab="students" />
        <div style={{ textAlign: "center", padding: "80px 0", color: "#7c3aed", fontWeight: "600" }}>
          ⏳ Loading student academic records...
        </div>
      </div>
    );
  }

  if (error || !studentData) {
    return (
      <div style={{ minHeight: "100vh", background: "#faf9ff" }}>
        <Navbar activeTab="students" />
        <div style={{ maxWidth: "800px", margin: "40px auto", padding: "0 24px" }}>
          <div style={{ padding: "16px 20px", background: "#fef2f2", color: "#b91c1c", borderRadius: "12px", marginBottom: "20px" }}>
            ⚠️ {error || "Student record not found or access denied."}
          </div>
          <button
            onClick={() => navigate("/teacher/students")}
            style={{ padding: "10px 20px", background: "#7c3aed", color: "#fff", border: "none", borderRadius: "10px", cursor: "pointer" }}
          >
            ← Back to Students
          </button>
        </div>
      </div>
    );
  }

  const { student, stats, documents, quizResults } = studentData;

  return (
    <div style={{ minHeight: "100vh", background: "#faf9ff" }}>
      <Navbar activeTab="students" />

      {/* Toast Notice */}
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

      <main style={{ maxWidth: "1200px", margin: "40px auto", padding: "0 24px" }}>
        {/* Header Breadcrumbs */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <Link
            to="/teacher/students"
            style={{ color: "#7c3aed", fontWeight: "600", textDecoration: "none", fontSize: "14px" }}
          >
            ← Back to All Students
          </Link>
          <span style={{ fontSize: "13px", color: "#6b7280" }}>Faculty Assessment View</span>
        </div>

        {/* Student Banner */}
        <div
          style={{
            background: "#fff",
            borderRadius: "20px",
            padding: "32px",
            border: "1px solid #f3e8ff",
            boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "20px",
            marginBottom: "32px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "30px",
                fontWeight: "bold",
              }}
            >
              {student.name.charAt(0).toUpperCase()}
            </div>

            <div>
              <h1 style={{ fontSize: "26px", fontWeight: "800", color: "#1f2937", margin: 0 }}>
                {student.name}
              </h1>
              <div style={{ color: "#6b7280", fontSize: "14px", marginTop: "4px" }}>
                {student.email} • {student.gradeOrClass || "Enrolled Student"}
              </div>
              <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>
                Joined: {new Date(student.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <div style={{ textAlign: "center", padding: "12px 20px", background: "#fbfaff", borderRadius: "12px", border: "1px solid #ede9fe" }}>
              <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: "600" }}>DOCUMENTS</div>
              <div style={{ fontSize: "24px", fontWeight: "800", color: "#4c1d95" }}>{stats.totalDocuments}</div>
            </div>

            <div style={{ textAlign: "center", padding: "12px 20px", background: "#fbfaff", borderRadius: "12px", border: "1px solid #ede9fe" }}>
              <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: "600" }}>QUIZZES</div>
              <div style={{ fontSize: "24px", fontWeight: "800", color: "#2563eb" }}>{stats.totalQuizAttempts}</div>
            </div>

            <div style={{ textAlign: "center", padding: "12px 20px", background: "#fbfaff", borderRadius: "12px", border: "1px solid #ede9fe" }}>
              <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: "600" }}>AVG ACCURACY</div>
              <div style={{ fontSize: "24px", fontWeight: "800", color: stats.averageScore >= 70 ? "#059669" : "#d97706" }}>
                {stats.averageScore}%
              </div>
            </div>

            <button
              onClick={handleOpenDM}
              style={{
                padding: "12px 20px",
                background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                color: "#ffffff",
                border: "none",
                borderRadius: "12px",
                fontWeight: "700",
                fontSize: "13px",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(124, 58, 237, 0.3)",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>💬 Message Personally</span>
            </button>

            {isRemoved ? (
              <button
                onClick={handleRestore}
                style={{
                  padding: "12px 20px",
                  background: "#dcfce7",
                  color: "#15803d",
                  border: "1px solid #bbf7d0",
                  borderRadius: "12px",
                  fontWeight: "700",
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span>↩ Restore Student</span>
              </button>
            ) : (
              <button
                onClick={() => setShowRemoveConfirm(true)}
                style={{
                  padding: "12px 18px",
                  background: "#fee2e2",
                  color: "#dc2626",
                  border: "1px solid #fecaca",
                  borderRadius: "12px",
                  fontWeight: "700",
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span>🗑️ Remove Student</span>
              </button>
            )}
          </div>
        </div>

        {/* 2 COLUMN GRID: DOCUMENTS & QUIZZES */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "28px" }}>
          {/* UPLOADED DOCUMENTS */}
          <section style={{ background: "#fff", borderRadius: "20px", padding: "28px", border: "1px solid #f3e8ff", boxShadow: "0 4px 15px rgba(0,0,0,0.03)" }}>
            <h2 style={{ fontSize: "19px", fontWeight: "800", color: "#1f2937", marginBottom: "16px" }}>
              Uploaded Study Materials ({documents.length})
            </h2>

            {documents.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: "#9ca3af" }}>
                No documents uploaded yet by this student.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    style={{
                      padding: "16px",
                      background: "#fbfaff",
                      borderRadius: "14px",
                      border: "1px solid #f3e8ff",
                    }}
                  >
                    <div style={{ fontWeight: "700", color: "#1f2937", fontSize: "15px" }}>
                      {doc.title}
                    </div>
                    <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                      {doc.wordCount} words • Uploaded on {new Date(doc.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* QUIZ RESULTS */}
          <section style={{ background: "#fff", borderRadius: "20px", padding: "28px", border: "1px solid #f3e8ff", boxShadow: "0 4px 15px rgba(0,0,0,0.03)" }}>
            <h2 style={{ fontSize: "19px", fontWeight: "800", color: "#1f2937", marginBottom: "16px" }}>
              Quiz Attempts ({quizResults.length})
            </h2>

            {quizResults.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: "#9ca3af" }}>
                No quiz submissions recorded yet for this student.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {quizResults.map((q) => (
                  <div
                    key={q.id}
                    style={{
                      padding: "16px",
                      background: "#fbfaff",
                      borderRadius: "14px",
                      border: "1px solid #f3e8ff",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: "700", color: "#1f2937", fontSize: "14px" }}>
                        {q.documentTitle}
                      </div>
                      <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
                        Completed on {new Date(q.completedAt).toLocaleDateString()}
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <span
                        style={{
                          fontSize: "16px",
                          fontWeight: "800",
                          color: q.percentage >= 70 ? "#059669" : "#d97706",
                        }}
                      >
                        {q.score}/{q.totalQuestions} ({q.percentage}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* ================= MODAL: DIRECT PERSONAL MESSAGE ================= */}
      {showDM && (
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
          onClick={() => setShowDM(false)}
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
                  DIRECT PERSONAL MESSAGE
                </span>
                <h2 style={{ fontSize: "20px", fontWeight: "800", margin: "4px 0 2px 0" }}>
                  {student.name}
                </h2>
                <div style={{ fontSize: "12px", opacity: 0.85 }}>{student.email}</div>
              </div>
              <button
                onClick={() => setShowDM(false)}
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
                  No previous messages with {student.name}. Send your message below.
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
                placeholder={`Write private message to ${student.name}...`}
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

      {/* ================= MODAL: CONFIRM REMOVE STUDENT ================= */}
      {showRemoveConfirm && (
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
          onClick={() => setShowRemoveConfirm(false)}
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
              Are you sure you want to remove <strong>{student.name}</strong> ({student.email}) from your assigned students roster?
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
                Notice: Once removed, this student will NOT be able to log in again with this email address.
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setShowRemoveConfirm(false)}
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
    </div>
  );
}

export default TeacherStudentDetail;
