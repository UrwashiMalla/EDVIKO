import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { teacherApi } from "../services/api";
import Navbar from "./Navbar";

function TeacherStudents() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      try {
        const res = await teacherApi.getStudents();
        setStudents(res.students || []);
      } catch (err) {
        setError(err.message || "Failed to load students.");
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#faf9ff" }}>
      <Navbar activeTab="students" />

      <main style={{ maxWidth: "1280px", margin: "40px auto", padding: "0 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#1f2937", margin: 0 }}>
              Assigned Students
            </h1>
            <p style={{ color: "#6b7280", marginTop: "6px", fontSize: "15px" }}>
              Comprehensive performance monitoring and document review for your students.
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
                    <th style={{ padding: "12px 16px" }}>Last Activity</th>
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
                          Inspect Student →
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
    </div>
  );
}

export default TeacherStudents;
