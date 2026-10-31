import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { documentApi } from "../services/api";
import { onLerniqSync } from "../services/frontendStorage";
import Navbar from "./Navbar";

function StudentDocuments() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const loadDocuments = (isInitial = false) => {
    if (isInitial) setLoading(true);
    documentApi.getMyDocuments()
      .then((res) => {
        if (res.documents) {
          setDocuments(res.documents);
        }
      })
      .catch((err) => {
        console.error("Failed to load documents:", err);
        setError(err.message || "Failed to load document history.");
      })
      .finally(() => {
        if (isInitial) setLoading(false);
      });
  };

  useEffect(() => {
    loadDocuments(true);
    const unsubscribe = onLerniqSync((detail) => {
      if (
        detail.type === "NOTE_UPLOADED" ||
        detail.type === "NOTE_DELETED" ||
        detail.type === "DOCUMENT_UPLOADED"
      ) {
        loadDocuments(false);
      }
    });
    return unsubscribe;
  }, []);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this document and all its study materials?")) {
      return;
    }

    try {
      await documentApi.delete(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      alert("Failed to delete document: " + err.message);
    }
  };

  const getDocIcon = (doc) => {
    if (doc.fileType === "docx") return "📘";
    if (doc.fileType === "pdf") return "📕";
    if (
      doc.originalFileName?.match(/\.(jpe?g|png)$/i) ||
      doc.fileType === "other"
    ) {
      return "🖼️";
    }
    return "📄";
  };

  return (
    <div style={{ minHeight: "100vh", background: "#faf9ff" }}>
      <Navbar activeTab="documents" />

      <main style={{ maxWidth: "1200px", margin: "40px auto", padding: "0 24px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#1f2937", margin: 0 }}>
              My Study Documents
            </h1>
            <p style={{ color: "#6b7280", marginTop: "6px", fontSize: "15px" }}>
              Access previous notes, summaries, and quizzes without re-uploading your files.
            </p>
          </div>

          <motion.button
            onClick={() => navigate("/student/workspace")}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            style={{
              padding: "12px 24px",
              background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
              color: "#fff",
              border: "none",
              borderRadius: "14px",
              fontWeight: "600",
              fontSize: "14px",
              cursor: "pointer",
              boxShadow: "0 6px 20px -3px rgba(124, 58, 237, 0.35)",
            }}
          >
            + Upload New Document
          </motion.button>
        </div>

        {error && (
          <div style={{ padding: "14px 20px", background: "#fef2f2", color: "#b91c1c", borderRadius: "12px", marginBottom: "20px" }}>
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#7c3aed", fontWeight: "600" }}>
            ⏳ Loading your document library...
          </div>
        ) : documents.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 24px",
              background: "#fff",
              borderRadius: "20px",
              border: "1px dashed #d8b4fe",
            }}
          >
            <span style={{ fontSize: "48px" }}>📚</span>
            <h3 style={{ fontSize: "20px", color: "#1f2937", marginTop: "12px" }}>No documents uploaded yet</h3>
            <p style={{ color: "#6b7280", maxWidth: "450px", margin: "8px auto 20px" }}>
              Upload a lecture PDF, Word doc, JPEG/PNG image, or paste notes to generate your first AI summary, practice questions, and quiz!
            </p>
            <button
              onClick={() => navigate("/student/workspace")}
              style={{
                padding: "10px 20px",
                background: "#7c3aed",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Upload Document →
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "20px" }}>
            {documents.map((doc) => (
              <motion.div
                key={doc.id}
                onClick={() => navigate(`/student/documents/${doc.id}`)}
                whileHover={{ y: -4, boxShadow: "0 12px 30px -5px rgba(0,0,0,0.08)" }}
                style={{
                  background: "#fff",
                  borderRadius: "18px",
                  padding: "24px",
                  border: "1px solid #f3e8ff",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.03)",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "24px" }}>
                        {getDocIcon(doc)}
                      </span>
                      {doc.isTeacherMaterial && (
                        <span style={{ fontSize: "11px", fontWeight: "700", background: "#fef3c7", color: "#92400e", padding: "3px 8px", borderRadius: "6px" }}>
                          👨‍🏫 Faculty Document {doc.teacherName ? `• ${doc.teacherName}` : ""}
                        </span>
                      )}
                    </div>
                    {!doc.isTeacherMaterial && (
                      <button
                        onClick={(e) => handleDelete(doc.id, e)}
                        title="Delete document"
                        style={{
                          background: "none",
                          border: "none",
                          color: "#ef4444",
                          cursor: "pointer",
                          fontSize: "14px",
                          padding: "4px 8px",
                        }}
                      >
                        🗑️
                      </button>
                    )}
                  </div>

                  <h3 style={{ fontSize: "17px", fontWeight: "700", color: "#1f2937", marginTop: "12px", marginBottom: "6px" }}>
                    {doc.title}
                  </h3>

                  <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "16px" }}>
                    {doc.originalFileName} • {doc.wordCount} words • {new Date(doc.uploadDate).toLocaleDateString()}
                  </div>

                  {/* Feature Badges */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px" }}>
                    {doc.hasSummary && (
                      <span style={{ fontSize: "11px", fontWeight: 600, background: "#ede9fe", color: "#6d28d9", padding: "3px 8px", borderRadius: "6px" }}>
                        ✓ Summary
                      </span>
                    )}
                    {doc.hasNotes && (
                      <span style={{ fontSize: "11px", fontWeight: 600, background: "#ede9fe", color: "#6d28d9", padding: "3px 8px", borderRadius: "6px" }}>
                        ✓ Notes
                      </span>
                    )}
                    {doc.hasQuestions && (
                      <span style={{ fontSize: "11px", fontWeight: 600, background: "#ede9fe", color: "#6d28d9", padding: "3px 8px", borderRadius: "6px" }}>
                        ✓ 10 Questions
                      </span>
                    )}
                    {doc.hasQuiz && (
                      <span style={{ fontSize: "11px", fontWeight: 600, background: "#dcfce7", color: "#15803d", padding: "3px 8px", borderRadius: "6px" }}>
                        ✓ MCQ Quiz
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  {doc.latestScore ? (
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#059669" }}>
                      Score: {doc.latestScore.score}/10 ({doc.latestScore.percentage}%)
                    </span>
                  ) : (
                    <span style={{ fontSize: "12px", color: "#9ca3af" }}>Quiz not attempted yet</span>
                  )}

                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#7c3aed" }}>
                    Study Now →
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default StudentDocuments;
