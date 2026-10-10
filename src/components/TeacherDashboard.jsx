import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { teacherApi } from "../services/api";
import Navbar from "./Navbar";

function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [dashboardData, setDashboardData] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
  }, []);

  const stats = dashboardData?.stats || {
    totalStudents: 0,
    totalDocuments: 0,
    totalQuizAttempts: 0,
    averageStudentScore: 0,
  };

  const teacherCode = dashboardData?.teacherProfile?.teacherCode || "TEACH-101";
  const recentActivity = dashboardData?.recentActivity || [];

  return (
    <div style={{ minHeight: "100vh", background: "#faf9ff" }}>
      <Navbar activeTab="dashboard" />

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
            gap: "20px",
          }}
        >
          <div>
            <span style={{ fontSize: "12px", letterSpacing: "1px", textTransform: "uppercase", background: "rgba(255,255,255,0.2)", padding: "4px 12px", borderRadius: "8px", fontWeight: "bold" }}>
              FACULTY OVERVIEW
            </span>
            <h1 style={{ fontSize: "30px", fontWeight: "800", margin: "12px 0 6px 0" }}>
              Welcome, {user?.name || "Professor"}! 🎓
            </h1>
            <p style={{ margin: 0, opacity: 0.9, fontSize: "15px" }}>
              Monitor student engagement, review generated study materials, and track quiz accuracy.
            </p>
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

        {/* 4 STATS CARDS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px", marginBottom: "40px" }}>
          <div style={{ background: "#fff", padding: "24px", borderRadius: "20px", border: "1px solid #f3e8ff", boxShadow: "0 4px 15px rgba(0,0,0,0.03)" }}>
            <span style={{ fontSize: "28px" }}>👨‍🎓</span>
            <div style={{ fontSize: "13px", color: "#6b7280", fontWeight: "700", marginTop: "12px" }}>
              TOTAL ENROLLED STUDENTS
            </div>
            <div style={{ fontSize: "32px", fontWeight: "800", color: "#1f2937", marginTop: "4px" }}>
              {loading ? "..." : stats.totalStudents}
            </div>
            <small style={{ color: "#7c3aed" }}>Assigned to your mentor code</small>
          </div>

          <div style={{ background: "#fff", padding: "24px", borderRadius: "20px", border: "1px solid #f3e8ff", boxShadow: "0 4px 15px rgba(0,0,0,0.03)" }}>
            <span style={{ fontSize: "28px" }}>📑</span>
            <div style={{ fontSize: "13px", color: "#6b7280", fontWeight: "700", marginTop: "12px" }}>
              STUDENT DOCUMENTS
            </div>
            <div style={{ fontSize: "32px", fontWeight: "800", color: "#1f2937", marginTop: "4px" }}>
              {loading ? "..." : stats.totalDocuments}
            </div>
            <small style={{ color: "#059669" }}>Uploaded by your students</small>
          </div>

          <div style={{ background: "#fff", padding: "24px", borderRadius: "20px", border: "1px solid #f3e8ff", boxShadow: "0 4px 15px rgba(0,0,0,0.03)" }}>
            <span style={{ fontSize: "28px" }}>🧠</span>
            <div style={{ fontSize: "13px", color: "#6b7280", fontWeight: "700", marginTop: "12px" }}>
              QUIZ ATTEMPTS
            </div>
            <div style={{ fontSize: "32px", fontWeight: "800", color: "#1f2937", marginTop: "4px" }}>
              {loading ? "..." : stats.totalQuizAttempts}
            </div>
            <small style={{ color: "#2563eb" }}>Total completed evaluations</small>
          </div>

          <div style={{ background: "#fff", padding: "24px", borderRadius: "20px", border: "1px solid #f3e8ff", boxShadow: "0 4px 15px rgba(0,0,0,0.03)" }}>
            <span style={{ fontSize: "28px" }}>🏆</span>
            <div style={{ fontSize: "13px", color: "#6b7280", fontWeight: "700", marginTop: "12px" }}>
              CLASS AVERAGE SCORE
            </div>
            <div style={{ fontSize: "32px", fontWeight: "800", color: "#1f2937", marginTop: "4px" }}>
              {loading ? "..." : `${stats.averageStudentScore}%`}
            </div>
            <small style={{ color: stats.averageStudentScore >= 70 ? "#059669" : "#d97706" }}>
              Overall accuracy rate
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
                Click on any student to review their documents, summaries, and quiz scores.
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
                    <th style={{ padding: "12px 16px" }}>Last Activity</th>
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
                        {student.totalDocuments}
                      </td>
                      <td style={{ padding: "16px", color: "#1f2937", fontWeight: "600" }}>
                        {student.totalQuizAttempts}
                      </td>
                      <td style={{ padding: "16px" }}>
                        <span
                          style={{
                            fontWeight: "bold",
                            padding: "4px 8px",
                            borderRadius: "6px",
                            fontSize: "13px",
                            background: student.averageScore >= 70 ? "#dcfce7" : student.averageScore >= 40 ? "#fef3c7" : "#fee2e2",
                            color: student.averageScore >= 70 ? "#15803d" : student.averageScore >= 40 ? "#92400e" : "#b91c1c",
                          }}
                        >
                          {student.averageScore}%
                        </span>
                      </td>
                      <td style={{ padding: "16px", color: "#6b7280", fontSize: "13px" }}>
                        {student.lastActivity ? new Date(student.lastActivity).toLocaleDateString() : "No activity"}
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
    </div>
  );
}

export default TeacherDashboard;
