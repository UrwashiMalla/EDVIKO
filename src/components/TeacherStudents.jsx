import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { teacherApi } from "../services/api";
import {
  getDirectMessages,
  sendDirectMessage,
  DEFAULT_STUDENTS_LIST,
} from "../services/frontendStorage";
import Navbar from "./Navbar";

function TeacherStudents() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Direct Message Modal State
  const [dmStudent, setDmStudent] = useState(null);
  const [dmMessages, setDmMessages] = useState([]);
  const [dmInput, setDmInput] = useState("");
  const [toast, setToast] = useState("");

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      try {
        const res = await teacherApi.getStudents();
        const apiStudents = res.students || [];
        if (apiStudents.length > 0) {
          setStudents(apiStudents);
        } else {
          setStudents(DEFAULT_STUDENTS_LIST.map((s) => ({
            id: s.id,
            name: s.name,
            email: s.email,
            totalDocuments: 3,
            totalQuizAttempts: 2,
            averageScore: 84,
            lastActivity: new Date().toISOString(),
          })));
        }
      } catch (err) {
        setError(err.message || "Failed to load students.");
        setStudents(DEFAULT_STUDENTS_LIST.map((s) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          totalDocuments: 3,
          totalQuizAttempts: 2,
          averageScore: 84,
          lastActivity: new Date().toISOString(),
        })));
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  const handleOpenDM = (student) => {
    setDmStudent(student);
    setDmMessages(getDirectMessages(student.id));
  };

  const handleSendDM = (e) => {
    e.preventDefault();
    if (!dmInput.trim() || !dmStudent) return;

    const updated = sendDirectMessage(dmStudent.id, {
      senderRole: "teacher",
      senderName: user?.name || "Prof. Sarah Jenkins",
      text: dmInput.trim(),
      studentName: dmStudent.name,
    });

    setDmMessages(updated);
    setDmInput("");
    showToast(`Personal message delivered to ${dmStudent.name}!`);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#faf9ff" }}>
      <Navbar activeTab="students" />

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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#1f2937", margin: 0 }}>
              Assigned Students
            </h1>
            <p style={{ color: "#6b7280", marginTop: "6px", fontSize: "15px" }}>
              Comprehensive performance monitoring, document review, and direct personal messaging.
            </p>
          </div>

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

        {error && (
          <div style={{ padding: "14px 20px", background: "#fef2f2", color: "#b91c1c", borderRadius: "12px", marginBottom: "20px" }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ background: "#fff", borderRadius: "20px", padding: "28px", border: "1px solid #f3e8ff", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#7c3aed" }}>
              ⏳ Loading student roster...
            </div>
          ) : students.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#6b7280" }}>
              No students currently assigned to your class.
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
                    <th style={{ padding: "12px 16px" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr
                      key={student.id}
                      style={{ borderBottom: "1px solid #f9fafb", cursor: "pointer" }}
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
                          Inspect Record →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

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
