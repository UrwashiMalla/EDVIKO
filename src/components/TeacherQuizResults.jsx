import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { teacherApi } from "../services/api";
import Navbar from "./Navbar";

function TeacherQuizResults() {
  const [quizResults, setQuizResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [performanceFilter, setPerformanceFilter] = useState("all");

  useEffect(() => {
    let ignore = false;
    const fetchResults = async () => {
      setLoading(true);
      try {
        const res = await teacherApi.getQuizResults();
        if (!ignore) {
          setQuizResults(res.quizResults || []);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || "Failed to load quiz results.");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchResults();
    return () => {
      ignore = true;
    };
  }, []);

  const filteredResults = quizResults.filter((item) => {
    const q = searchQuery.toLowerCase();
    const studentMatch = item.student?.name?.toLowerCase().includes(q) || item.student?.email?.toLowerCase().includes(q);
    const docMatch = item.documentTitle?.toLowerCase().includes(q);
    const matchesQuery = studentMatch || docMatch;

    if (!matchesQuery) return false;

    if (performanceFilter === "high") return item.percentage >= 70;
    if (performanceFilter === "medium") return item.percentage >= 40 && item.percentage < 70;
    if (performanceFilter === "low") return item.percentage < 40;
    return true;
  });

  const totalAttempts = quizResults.length;
  const avgScore = totalAttempts > 0
    ? Math.round(quizResults.reduce((acc, r) => acc + r.percentage, 0) / totalAttempts)
    : 0;
  const perfectScores = quizResults.filter((r) => r.percentage === 100).length;

  return (
    <div style={{ minHeight: "100vh", background: "#faf9ff" }}>
      <Navbar activeTab="quiz-results" />

      <main style={{ maxWidth: "1280px", margin: "40px auto", padding: "0 24px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "30px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#1f2937", margin: 0 }}>
              Class Quiz Results & Analytics
            </h1>
            <p style={{ color: "#6b7280", marginTop: "6px", fontSize: "15px" }}>
              Evaluate student comprehension and accuracy across generated 10-question MCQ tests.
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

        {/* 3 Metric Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px", marginBottom: "32px" }}>
          <div style={{ background: "#fff", padding: "20px", borderRadius: "18px", border: "1px solid #f3e8ff", boxShadow: "0 4px 15px rgba(0,0,0,0.03)" }}>
            <span style={{ fontSize: "26px" }}>📝</span>
            <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: "700", marginTop: "10px" }}>TOTAL EVALUATIONS</div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#1f2937", marginTop: "2px" }}>
              {loading ? "..." : totalAttempts}
            </div>
            <small style={{ color: "#2563eb" }}>Completed quiz submissions</small>
          </div>

          <div style={{ background: "#fff", padding: "20px", borderRadius: "18px", border: "1px solid #f3e8ff", boxShadow: "0 4px 15px rgba(0,0,0,0.03)" }}>
            <span style={{ fontSize: "26px" }}>🎯</span>
            <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: "700", marginTop: "10px" }}>AVERAGE CLASS ACCURACY</div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: avgScore >= 70 ? "#059669" : "#d97706", marginTop: "2px" }}>
              {loading ? "..." : `${avgScore}%`}
            </div>
            <small style={{ color: avgScore >= 70 ? "#059669" : "#d97706" }}>Across all completed tests</small>
          </div>

          <div style={{ background: "#fff", padding: "20px", borderRadius: "18px", border: "1px solid #f3e8ff", boxShadow: "0 4px 15px rgba(0,0,0,0.03)" }}>
            <span style={{ fontSize: "26px" }}>🌟</span>
            <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: "700", marginTop: "10px" }}>PERFECT SCORES (100%)</div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#1f2937", marginTop: "2px" }}>
              {loading ? "..." : perfectScores}
            </div>
            <small style={{ color: "#7c3aed" }}>Full marks achieved</small>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginBottom: "24px", alignItems: "center" }}>
          <input
            type="text"
            placeholder="🔍 Search by student name, email, or topic..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              minWidth: "280px",
              padding: "12px 18px",
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              fontSize: "14px",
              outline: "none",
              background: "#fff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            }}
          />

          <div style={{ display: "flex", gap: "8px" }}>
            {[
              { id: "all", label: "All Scores" },
              { id: "high", label: "≥ 70% (Pass)" },
              { id: "medium", label: "40% - 69%" },
              { id: "low", label: "< 40% (Needs Review)" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setPerformanceFilter(tab.id)}
                style={{
                  padding: "10px 16px",
                  borderRadius: "10px",
                  border: "none",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  background: performanceFilter === tab.id ? "#7c3aed" : "#fff",
                  color: performanceFilter === tab.id ? "#fff" : "#4b5563",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.03)",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ padding: "14px 20px", background: "#fef2f2", color: "#b91c1c", borderRadius: "12px", marginBottom: "20px" }}>
            ⚠️ {error}
          </div>
        )}

        {/* Results Table */}
        <div style={{ background: "#fff", borderRadius: "20px", padding: "28px", border: "1px solid #f3e8ff", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#7c3aed" }}>
              ⏳ Loading quiz submissions...
            </div>
          ) : filteredResults.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#6b7280" }}>
              {quizResults.length === 0
                ? "No quizzes have been attempted by your students yet."
                : "No quiz submissions matched your filter."}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #f3f4f6", color: "#6b7280", fontSize: "12px", textTransform: "uppercase" }}>
                    <th style={{ padding: "12px 16px" }}>Student</th>
                    <th style={{ padding: "12px 16px" }}>Study Material</th>
                    <th style={{ padding: "12px 16px" }}>Score</th>
                    <th style={{ padding: "12px 16px" }}>Performance</th>
                    <th style={{ padding: "12px 16px" }}>Submission Date</th>
                    <th style={{ padding: "12px 16px" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((item) => (
                    <tr
                      key={item.id}
                      style={{ borderBottom: "1px solid #f9fafb" }}
                    >
                      <td style={{ padding: "16px" }}>
                        <div style={{ fontWeight: "600", color: "#1f2937", fontSize: "14px" }}>
                          {item.student?.name}
                        </div>
                        <div style={{ fontSize: "12px", color: "#6b7280" }}>
                          {item.student?.email}
                        </div>
                      </td>

                      <td style={{ padding: "16px" }}>
                        <div style={{ fontWeight: "600", color: "#1f2937", fontSize: "14px" }}>
                          {item.documentTitle}
                        </div>
                      </td>

                      <td style={{ padding: "16px" }}>
                        <span style={{ fontSize: "15px", fontWeight: "800", color: "#1f2937" }}>
                          {item.score} / {item.totalQuestions}
                        </span>
                        <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "6px" }}>
                          ({item.percentage}%)
                        </span>
                      </td>

                      <td style={{ padding: "16px" }}>
                        <span
                          style={{
                            fontWeight: "bold",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            background: item.percentage >= 70 ? "#dcfce7" : item.percentage >= 40 ? "#fef3c7" : "#fee2e2",
                            color: item.percentage >= 70 ? "#15803d" : item.percentage >= 40 ? "#92400e" : "#b91c1c",
                          }}
                        >
                          {item.percentage >= 80
                            ? "🌟 Excellent"
                            : item.percentage >= 70
                            ? "✓ Passed"
                            : item.percentage >= 40
                            ? "⚠️ Moderate"
                            : "❌ Needs Help"}
                        </span>
                      </td>

                      <td style={{ padding: "16px", color: "#6b7280", fontSize: "13px" }}>
                        {new Date(item.completedAt).toLocaleString()}
                      </td>

                      <td style={{ padding: "16px" }}>
                        <Link
                          to={`/teacher/students/${item.student?.id}`}
                          style={{
                            color: "#7c3aed",
                            fontWeight: "700",
                            fontSize: "13px",
                            textDecoration: "none",
                          }}
                        >
                          View Student →
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

export default TeacherQuizResults;
