import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { teacherApi } from "../services/api";
import Navbar from "./Navbar";

function TeacherDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let ignore = false;
    const fetchDocs = async () => {
      setLoading(true);
      try {
        const res = await teacherApi.getDocuments();
        if (!ignore) {
          setDocuments(res.documents || []);
        }
      } catch (err) {
        if (!ignore) {
          setError(err.message || "Failed to load student documents.");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchDocs();
    return () => {
      ignore = true;
    };
  }, []);

  const filteredDocs = documents.filter((doc) => {
    const q = searchQuery.toLowerCase();
    const titleMatch = doc.title?.toLowerCase().includes(q);
    const studentMatch = doc.student?.name?.toLowerCase().includes(q) || doc.student?.email?.toLowerCase().includes(q);
    const fileMatch = doc.originalFileName?.toLowerCase().includes(q);
    return titleMatch || studentMatch || fileMatch;
  });

  const totalWords = documents.reduce((acc, d) => acc + (d.wordCount || 0), 0);
  const totalSummaries = documents.filter((d) => d.hasSummary).length;

  return (
    <div style={{ minHeight: "100vh", background: "#faf9ff" }}>
      <Navbar activeTab="documents" />

      <main style={{ maxWidth: "1280px", margin: "40px auto", padding: "0 24px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "30px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#1f2937", margin: 0 }}>
              Student Study Materials
            </h1>
            <p style={{ color: "#6b7280", marginTop: "6px", fontSize: "15px" }}>
              Review all documents and study material uploaded across your enrolled students.
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

        {/* 3 Overview Metric Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px", marginBottom: "32px" }}>
          <div style={{ background: "#fff", padding: "20px", borderRadius: "18px", border: "1px solid #f3e8ff", boxShadow: "0 4px 15px rgba(0,0,0,0.03)" }}>
            <span style={{ fontSize: "26px" }}>📑</span>
            <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: "700", marginTop: "10px" }}>TOTAL DOCUMENTS</div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#1f2937", marginTop: "2px" }}>
              {loading ? "..." : documents.length}
            </div>
            <small style={{ color: "#7c3aed" }}>Across all your classes</small>
          </div>

          <div style={{ background: "#fff", padding: "20px", borderRadius: "18px", border: "1px solid #f3e8ff", boxShadow: "0 4px 15px rgba(0,0,0,0.03)" }}>
            <span style={{ fontSize: "26px" }}>📝</span>
            <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: "700", marginTop: "10px" }}>AI SUMMARIES GENERATED</div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#1f2937", marginTop: "2px" }}>
              {loading ? "..." : totalSummaries}
            </div>
            <small style={{ color: "#059669" }}>Processed with Groq AI</small>
          </div>

          <div style={{ background: "#fff", padding: "20px", borderRadius: "18px", border: "1px solid #f3e8ff", boxShadow: "0 4px 15px rgba(0,0,0,0.03)" }}>
            <span style={{ fontSize: "26px" }}>📖</span>
            <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: "700", marginTop: "10px" }}>TOTAL WORDS ANALYZED</div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#1f2937", marginTop: "2px" }}>
              {loading ? "..." : totalWords.toLocaleString()}
            </div>
            <small style={{ color: "#2563eb" }}>Extracted lecture content</small>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div style={{ marginBottom: "24px" }}>
          <input
            type="text"
            placeholder="🔍 Search by document title, student name, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              maxWidth: "500px",
              padding: "12px 18px",
              borderRadius: "12px",
              border: "1px solid #e5e7eb",
              fontSize: "14px",
              outline: "none",
              background: "#fff",
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            }}
          />
        </div>

        {error && (
          <div style={{ padding: "14px 20px", background: "#fef2f2", color: "#b91c1c", borderRadius: "12px", marginBottom: "20px" }}>
            ⚠️ {error}
          </div>
        )}

        {/* Document Table */}
        <div style={{ background: "#fff", borderRadius: "20px", padding: "28px", border: "1px solid #f3e8ff", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#7c3aed" }}>
              ⏳ Loading study documents...
            </div>
          ) : filteredDocs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#6b7280" }}>
              {documents.length === 0
                ? "No documents have been uploaded by your students yet."
                : "No documents matched your search filter."}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #f3f4f6", color: "#6b7280", fontSize: "12px", textTransform: "uppercase" }}>
                    <th style={{ padding: "12px 16px" }}>Document Title</th>
                    <th style={{ padding: "12px 16px" }}>Student</th>
                    <th style={{ padding: "12px 16px" }}>Words</th>
                    <th style={{ padding: "12px 16px" }}>AI Features</th>
                    <th style={{ padding: "12px 16px" }}>Quiz Accuracy</th>
                    <th style={{ padding: "12px 16px" }}>Upload Date</th>
                    <th style={{ padding: "12px 16px" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocs.map((doc) => (
                    <tr
                      key={doc.id}
                      style={{ borderBottom: "1px solid #f9fafb" }}
                    >
                      <td style={{ padding: "16px" }}>
                        <div style={{ fontWeight: "700", color: "#1f2937", fontSize: "15px" }}>
                          {doc.title}
                        </div>
                        <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
                          {doc.originalFileName} ({doc.fileType.toUpperCase()})
                        </div>
                      </td>

                      <td style={{ padding: "16px" }}>
                        <div style={{ fontWeight: "600", color: "#1f2937", fontSize: "14px" }}>
                          {doc.student?.name}
                        </div>
                        <div style={{ fontSize: "12px", color: "#6b7280" }}>
                          {doc.student?.email}
                        </div>
                      </td>

                      <td style={{ padding: "16px", color: "#374151", fontSize: "14px", fontWeight: "600" }}>
                        {doc.wordCount?.toLocaleString() || 0}
                      </td>

                      <td style={{ padding: "16px" }}>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {doc.hasSummary && (
                            <span style={{ fontSize: "11px", fontWeight: "600", background: "#ede9fe", color: "#6d28d9", padding: "2px 6px", borderRadius: "4px" }}>
                              Summary
                            </span>
                          )}
                          {doc.hasNotes && (
                            <span style={{ fontSize: "11px", fontWeight: "600", background: "#ede9fe", color: "#6d28d9", padding: "2px 6px", borderRadius: "4px" }}>
                              Notes
                            </span>
                          )}
                          {doc.hasQuestions && (
                            <span style={{ fontSize: "11px", fontWeight: "600", background: "#ede9fe", color: "#6d28d9", padding: "2px 6px", borderRadius: "4px" }}>
                              Questions
                            </span>
                          )}
                          {doc.hasQuiz && (
                            <span style={{ fontSize: "11px", fontWeight: "600", background: "#dcfce7", color: "#15803d", padding: "2px 6px", borderRadius: "4px" }}>
                              Quiz
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: "16px" }}>
                        {doc.latestScore ? (
                          <span
                            style={{
                              fontWeight: "bold",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              fontSize: "13px",
                              background: doc.latestScore.percentage >= 70 ? "#dcfce7" : doc.latestScore.percentage >= 40 ? "#fef3c7" : "#fee2e2",
                              color: doc.latestScore.percentage >= 70 ? "#15803d" : doc.latestScore.percentage >= 40 ? "#92400e" : "#b91c1c",
                            }}
                          >
                            {doc.latestScore.score}/{doc.latestScore.totalQuestions} ({doc.latestScore.percentage}%)
                          </span>
                        ) : (
                          <span style={{ color: "#9ca3af", fontSize: "13px" }}>Not attempted</span>
                        )}
                      </td>

                      <td style={{ padding: "16px", color: "#6b7280", fontSize: "13px" }}>
                        {new Date(doc.uploadDate).toLocaleDateString()}
                      </td>

                      <td style={{ padding: "16px" }}>
                        <Link
                          to={`/teacher/students/${doc.student.id}`}
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

export default TeacherDocuments;
