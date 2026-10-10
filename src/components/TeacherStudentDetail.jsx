import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { teacherApi } from "../services/api";
import Navbar from "./Navbar";

function TeacherStudentDetail() {
  const { studentId, id } = useParams();
  const effectiveStudentId = studentId || id;
  const navigate = useNavigate();

  const [studentData, setStudentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
                {student.email} • {student.gradeOrClass}
              </div>
              <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>
                Joined: {new Date(student.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "16px" }}>
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
              <p style={{ color: "#9ca3af", fontSize: "14px" }}>No documents uploaded yet by this student.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    style={{
                      padding: "16px",
                      background: "#faf5ff",
                      borderRadius: "14px",
                      border: "1px solid #f3e8ff",
                    }}
                  >
                    <strong style={{ fontSize: "15px", color: "#4c1d95" }}>{doc.title}</strong>
                    <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                      {doc.originalFileName} • {doc.wordCount} words • Uploaded {new Date(doc.uploadDate).toLocaleDateString()}
                    </div>

                    <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
                      {doc.hasSummary && (
                        <span style={{ fontSize: "10px", fontWeight: "600", background: "#ede9fe", color: "#6d28d9", padding: "2px 6px", borderRadius: "4px" }}>
                          ✓ Summary
                        </span>
                      )}
                      {doc.hasNotes && (
                        <span style={{ fontSize: "10px", fontWeight: "600", background: "#ede9fe", color: "#6d28d9", padding: "2px 6px", borderRadius: "4px" }}>
                          ✓ Notes
                        </span>
                      )}
                      {doc.hasQuestions && (
                        <span style={{ fontSize: "10px", fontWeight: "600", background: "#ede9fe", color: "#6d28d9", padding: "2px 6px", borderRadius: "4px" }}>
                          ✓ Questions
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* QUIZ EVALUATIONS */}
          <section style={{ background: "#fff", borderRadius: "20px", padding: "28px", border: "1px solid #f3e8ff", boxShadow: "0 4px 15px rgba(0,0,0,0.03)" }}>
            <h2 style={{ fontSize: "19px", fontWeight: "800", color: "#1f2937", marginBottom: "16px" }}>
              Quiz Performance & Attempts ({quizResults.length})
            </h2>

            {quizResults.length === 0 ? (
              <p style={{ color: "#9ca3af", fontSize: "14px" }}>No quiz evaluations recorded yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {quizResults.map((q) => (
                  <div
                    key={q.id}
                    style={{
                      padding: "16px",
                      background: "#f0fdf4",
                      borderRadius: "14px",
                      border: "1px solid #dcfce7",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "14px", color: "#065f46" }}>{q.documentTitle}</strong>
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
    </div>
  );
}

export default TeacherStudentDetail;
