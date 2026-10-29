import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  getTeacherQuizzes,
  uploadQuiz,
  deleteQuiz,
  getUploadedNotes,
  uploadNote,
  deleteNote,
  getUploadedLectures,
  uploadLecture,
  deleteLecture,
} from "../services/frontendStorage";
import Navbar from "./Navbar";

function TeacherDocuments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "quizzes";
  const [activeTab, setActiveTab] = useState(initialTab); // "quizzes" | "notes" | "lectures"

  // Data states
  const [quizzes, setQuizzes] = useState([]);
  const [notes, setNotes] = useState([]);
  const [lectures, setLectures] = useState([]);
  const [toast, setToast] = useState("");

  // Quiz Form State
  const [quizTitle, setQuizTitle] = useState("");
  const [quizSubject, setQuizSubject] = useState("Artificial Intelligence");
  const [quizTimeLimit, setQuizTimeLimit] = useState(15);
  const [quizPassingScore, setQuizPassingScore] = useState(60);
  const [questionsList, setQuestionsList] = useState([
    {
      question: "",
      options: ["", "", "", ""],
      answerIndex: 0,
    },
  ]);

  // Notes Form State
  const [noteTitle, setNoteTitle] = useState("");
  const [noteSubject, setNoteSubject] = useState("Artificial Intelligence");
  const [noteModule, setNoteModule] = useState("");
  const [noteDescription, setNoteDescription] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteFileName, setNoteFileName] = useState("");

  // Lectures Form State
  const [lectureTitle, setLectureTitle] = useState("");
  const [lectureSubject, setLectureSubject] = useState("Artificial Intelligence");
  const [lectureDuration, setLectureDuration] = useState("40 min");
  const [lectureUrl, setLectureUrl] = useState("https://www.youtube.com/embed/JMUxmLyrhSk");
  const [lectureDescription, setLectureDescription] = useState("");
  const [lectureTakeaways, setLectureTakeaways] = useState("");

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  useEffect(() => {
    setQuizzes(getTeacherQuizzes());
    setNotes(getUploadedNotes());
    setLectures(getUploadedLectures());
  }, []);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && ["quizzes", "notes", "lectures"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // ================= QUIZ HANDLERS =================
  const addQuestionField = () => {
    setQuestionsList([
      ...questionsList,
      {
        question: "",
        options: ["", "", "", ""],
        answerIndex: 0,
      },
    ]);
  };

  const removeQuestionField = (idx) => {
    if (questionsList.length <= 1) return;
    setQuestionsList(questionsList.filter((_, i) => i !== idx));
  };

  const handleQuestionChange = (idx, text) => {
    const updated = [...questionsList];
    updated[idx].question = text;
    setQuestionsList(updated);
  };

  const handleOptionChange = (qIdx, optIdx, text) => {
    const updated = [...questionsList];
    updated[qIdx].options[optIdx] = text;
    setQuestionsList(updated);
  };

  const handleCorrectOptionChange = (qIdx, optIdx) => {
    const updated = [...questionsList];
    updated[qIdx].answerIndex = optIdx;
    setQuestionsList(updated);
  };

  const handlePublishQuiz = (e) => {
    e.preventDefault();
    if (!quizTitle.trim()) {
      showToast("Please enter a quiz title.");
      return;
    }

    const validQuestions = questionsList.filter((q) => q.question.trim().length > 0);
    const finalQuestions = validQuestions.length > 0 ? validQuestions : [
      {
        question: `Comprehensive evaluation question on ${quizTitle}: Identify the primary algorithm trait.`,
        options: ["Optimality & Completeness", "Exponential Search Space", "Unbounded Memory", "Greedy Suboptimal Step"],
        answerIndex: 0,
      },
    ];

    const updated = uploadQuiz({
      title: quizTitle.trim(),
      subject: quizSubject,
      timeLimit: quizTimeLimit,
      passingScore: quizPassingScore,
      questions: finalQuestions,
    });

    setQuizzes(updated);
    setQuizTitle("");
    setQuestionsList([{ question: "", options: ["", "", "", ""], answerIndex: 0 }]);
    showToast("🎯 Quiz published successfully! Students can now attempt it.");
  };

  const handleDeleteQuiz = (id) => {
    const updated = deleteQuiz(id);
    setQuizzes(updated);
    showToast("Quiz removed from course curriculum.");
  };

  // ================= NOTES HANDLERS =================
  const handlePublishNotes = (e) => {
    e.preventDefault();
    if (!noteTitle.trim()) {
      showToast("Please enter a note title.");
      return;
    }

    const updated = uploadNote({
      title: noteTitle.trim(),
      subject: noteSubject,
      module: noteModule.trim() || "Core Curriculum",
      description: noteDescription.trim() || "Handout notes prepared by course faculty.",
      content: noteContent.trim() || noteDescription.trim(),
      fileName: noteFileName ? noteFileName.replace(/^.*[\\\/]/, "") : "Lecture_Handout.pdf",
    });

    setNotes(updated);
    setNoteTitle("");
    setNoteModule("");
    setNoteDescription("");
    setNoteContent("");
    setNoteFileName("");
    showToast("📄 Notes uploaded and published to students!");
  };

  const handleDeleteNote = (id) => {
    const updated = deleteNote(id);
    setNotes(updated);
    showToast("Study notes deleted.");
  };

  // ================= LECTURE HANDLERS =================
  const handlePublishLecture = (e) => {
    e.preventDefault();
    if (!lectureTitle.trim()) {
      showToast("Please enter a lecture title.");
      return;
    }

    const takeawaysArray = lectureTakeaways
      .split("\n")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const updated = uploadLecture({
      title: lectureTitle.trim(),
      subject: lectureSubject,
      duration: lectureDuration,
      videoEmbedUrl: lectureUrl.trim(),
      description: lectureDescription.trim(),
      takeaways: takeawaysArray,
    });

    setLectures(updated);
    setLectureTitle("");
    setLectureDescription("");
    setLectureTakeaways("");
    showToast("🎥 Lecture published to student portal!");
  };

  const handleDeleteLecture = (id) => {
    const updated = deleteLecture(id);
    setLectures(updated);
    showToast("Lecture removed.");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#faf9ff" }}>
      <Navbar activeTab="documents" />

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
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "28px" }}>
          <div>
            <span style={{ fontSize: "12px", letterSpacing: "1px", textTransform: "uppercase", background: "#ede9fe", color: "#6d28d9", padding: "4px 10px", borderRadius: "8px", fontWeight: "700" }}>
              COURSE CONTENT HUB
            </span>
            <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#1f2937", margin: "8px 0 4px 0" }}>
              Teaching Materials & Quiz Management
            </h1>
            <p style={{ color: "#6b7280", margin: 0, fontSize: "15px" }}>
              Upload quizzes, lecture notes, and video sessions. View and manage historical course uploads.
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px", marginBottom: "32px" }}>
          <div
            onClick={() => switchTab("quizzes")}
            style={{
              background: "#fff",
              padding: "22px",
              borderRadius: "18px",
              border: activeTab === "quizzes" ? "2px solid #7c3aed" : "1px solid #f3e8ff",
              boxShadow: "0 4px 15px rgba(0,0,0,0.03)",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: "26px" }}>🎯</span>
            <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: "700", marginTop: "10px" }}>QUIZZES CONDUCTED</div>
            <div style={{ fontSize: "30px", fontWeight: "800", color: "#1f2937", marginTop: "2px" }}>
              {quizzes.length}
            </div>
            <small style={{ color: "#7c3aed", fontWeight: "600" }}>Click to create or manage quizzes →</small>
          </div>

          <div
            onClick={() => switchTab("notes")}
            style={{
              background: "#fff",
              padding: "22px",
              borderRadius: "18px",
              border: activeTab === "notes" ? "2px solid #7c3aed" : "1px solid #f3e8ff",
              boxShadow: "0 4px 15px rgba(0,0,0,0.03)",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: "26px" }}>📄</span>
            <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: "700", marginTop: "10px" }}>UPLOADED STUDY NOTES</div>
            <div style={{ fontSize: "30px", fontWeight: "800", color: "#1f2937", marginTop: "2px" }}>
              {notes.length}
            </div>
            <small style={{ color: "#059669", fontWeight: "600" }}>Click to upload or view notes →</small>
          </div>

          <div
            onClick={() => switchTab("lectures")}
            style={{
              background: "#fff",
              padding: "22px",
              borderRadius: "18px",
              border: activeTab === "lectures" ? "2px solid #7c3aed" : "1px solid #f3e8ff",
              boxShadow: "0 4px 15px rgba(0,0,0,0.03)",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: "26px" }}>🎥</span>
            <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: "700", marginTop: "10px" }}>UPLOADED LECTURES</div>
            <div style={{ fontSize: "30px", fontWeight: "800", color: "#1f2937", marginTop: "2px" }}>
              {lectures.length}
            </div>
            <small style={{ color: "#2563eb", fontWeight: "600" }}>Click to upload or view lectures →</small>
          </div>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "28px", borderBottom: "2px solid #f1f5f9", paddingBottom: "12px" }}>
          <button
            onClick={() => switchTab("quizzes")}
            style={{
              padding: "10px 24px",
              background: activeTab === "quizzes" ? "#6d28d9" : "#ffffff",
              color: activeTab === "quizzes" ? "#ffffff" : "#475569",
              border: "1px solid",
              borderColor: activeTab === "quizzes" ? "#6d28d9" : "#e2e8f0",
              borderRadius: "12px",
              fontWeight: "700",
              fontSize: "14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>🎯 Conduct Quizzes</span>
            <span style={{ background: activeTab === "quizzes" ? "rgba(255,255,255,0.25)" : "#ede9fe", color: activeTab === "quizzes" ? "#fff" : "#6d28d9", padding: "2px 8px", borderRadius: "8px", fontSize: "11px" }}>
              {quizzes.length}
            </span>
          </button>

          <button
            onClick={() => switchTab("notes")}
            style={{
              padding: "10px 24px",
              background: activeTab === "notes" ? "#6d28d9" : "#ffffff",
              color: activeTab === "notes" ? "#ffffff" : "#475569",
              border: "1px solid",
              borderColor: activeTab === "notes" ? "#6d28d9" : "#e2e8f0",
              borderRadius: "12px",
              fontWeight: "700",
              fontSize: "14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>📄 Upload Notes</span>
            <span style={{ background: activeTab === "notes" ? "rgba(255,255,255,0.25)" : "#ede9fe", color: activeTab === "notes" ? "#fff" : "#6d28d9", padding: "2px 8px", borderRadius: "8px", fontSize: "11px" }}>
              {notes.length}
            </span>
          </button>

          <button
            onClick={() => switchTab("lectures")}
            style={{
              padding: "10px 24px",
              background: activeTab === "lectures" ? "#6d28d9" : "#ffffff",
              color: activeTab === "lectures" ? "#ffffff" : "#475569",
              border: "1px solid",
              borderColor: activeTab === "lectures" ? "#6d28d9" : "#e2e8f0",
              borderRadius: "12px",
              fontWeight: "700",
              fontSize: "14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>🎥 Upload Lectures</span>
            <span style={{ background: activeTab === "lectures" ? "rgba(255,255,255,0.25)" : "#ede9fe", color: activeTab === "lectures" ? "#fff" : "#6d28d9", padding: "2px 8px", borderRadius: "8px", fontSize: "11px" }}>
              {lectures.length}
            </span>
          </button>
        </div>

        {/* ================= TAB 1: QUIZZES ================= */}
        {activeTab === "quizzes" && (
          <div>
            {/* Upload / Create Quiz Form */}
            <div style={{ background: "#ffffff", borderRadius: "20px", padding: "32px", border: "1px solid #f3e8ff", marginBottom: "36px", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div>
                  <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#1e293b", margin: 0 }}>
                    🎯 Create & Conduct a New Quiz
                  </h2>
                  <p style={{ color: "#64748b", fontSize: "14px", marginTop: "4px" }}>
                    Build multiple choice assessments for enrolled students to take on their portal.
                  </p>
                </div>
                <span style={{ fontSize: "12px", background: "#ecfdf5", color: "#065f46", padding: "6px 12px", borderRadius: "8px", fontWeight: "700" }}>
                  Live Class Evaluation
                </span>
              </div>

              <form onSubmit={handlePublishQuiz}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "16px", marginBottom: "24px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                      Quiz Title
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Heuristic Search & A* Evaluation"
                      value={quizTitle}
                      onChange={(e) => setQuizTitle(e.target.value)}
                      style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                      Subject
                    </label>
                    <select
                      value={quizSubject}
                      onChange={(e) => setQuizSubject(e.target.value)}
                      style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
                    >
                      <option value="Artificial Intelligence">Artificial Intelligence</option>
                      <option value="Deep Learning">Deep Learning</option>
                      <option value="Database Systems">Database Systems</option>
                      <option value="Computer Networks">Computer Networks</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                      Time Limit (Mins)
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="120"
                      value={quizTimeLimit}
                      onChange={(e) => setQuizTimeLimit(Number(e.target.value))}
                      style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                      Pass Score (%)
                    </label>
                    <input
                      type="number"
                      min="40"
                      max="100"
                      value={quizPassingScore}
                      onChange={(e) => setQuizPassingScore(Number(e.target.value))}
                      style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                {/* Question Builder */}
                <div style={{ marginBottom: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <label style={{ fontSize: "14px", fontWeight: "800", color: "#4c1d95" }}>
                      Questions ({questionsList.length})
                    </label>
                    <button
                      type="button"
                      onClick={addQuestionField}
                      style={{ padding: "6px 14px", background: "#ede9fe", color: "#6d28d9", border: "none", borderRadius: "8px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}
                    >
                      + Add Another Question
                    </button>
                  </div>

                  {questionsList.map((q, qIdx) => (
                    <div
                      key={qIdx}
                      style={{
                        background: "#fbfaff",
                        border: "1px solid #ede9fe",
                        borderRadius: "14px",
                        padding: "20px",
                        marginBottom: "16px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                        <span style={{ fontWeight: "700", fontSize: "13px", color: "#6d28d9" }}>
                          Question {qIdx + 1}
                        </span>
                        {questionsList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeQuestionField(qIdx)}
                            style={{ background: "none", border: "none", color: "#ef4444", fontSize: "12px", fontWeight: "600", cursor: "pointer" }}
                          >
                            Remove Question
                          </button>
                        )}
                      </div>

                      <input
                        type="text"
                        placeholder="Write the question prompt here..."
                        value={q.question}
                        onChange={(e) => handleQuestionChange(qIdx, e.target.value)}
                        style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box", marginBottom: "12px" }}
                        required
                      />

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        {q.options.map((opt, optIdx) => (
                          <div key={optIdx} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <input
                              type="radio"
                              name={`correct_${qIdx}`}
                              checked={q.answerIndex === optIdx}
                              onChange={() => handleCorrectOptionChange(qIdx, optIdx)}
                              title="Select as correct option"
                            />
                            <input
                              type="text"
                              placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                              value={opt}
                              onChange={(e) => handleOptionChange(qIdx, optIdx, e.target.value)}
                              style={{ flex: 1, padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                              required
                            />
                          </div>
                        ))}
                      </div>
                      <small style={{ display: "block", marginTop: "8px", color: "#64748b", fontSize: "11px" }}>
                        Select the radio button next to the option that is the correct answer.
                      </small>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="submit"
                    style={{
                      padding: "12px 28px",
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "12px",
                      fontWeight: "700",
                      fontSize: "15px",
                      cursor: "pointer",
                      boxShadow: "0 4px 14px rgba(16, 185, 129, 0.3)",
                    }}
                  >
                    Publish Quiz to Class →
                  </button>
                </div>
              </form>
            </div>

            {/* History of Conducted Quizzes */}
            <div style={{ background: "#ffffff", borderRadius: "20px", padding: "32px", border: "1px solid #f3e8ff", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
              <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#1e293b", margin: "0 0 4px 0" }}>
                Conducted Quizzes History
              </h2>
              <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 20px 0" }}>
                All quizzes active in your class with deletion control and direct link to quiz analytics.
              </p>

              {quizzes.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                  No quizzes published yet. Create your first quiz using the form above.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {quizzes.map((q) => (
                    <div
                      key={q.id}
                      style={{
                        padding: "20px",
                        background: "#fbfaff",
                        borderRadius: "16px",
                        border: "1px solid #f3e8ff",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "14px",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                          <span style={{ fontSize: "11px", fontWeight: "700", background: "#ecfdf5", color: "#065f46", padding: "3px 8px", borderRadius: "6px" }}>
                            {q.subject}
                          </span>
                          <strong style={{ fontSize: "16px", color: "#1e293b" }}>{q.title}</strong>
                        </div>
                        <div style={{ fontSize: "13px", color: "#64748b", display: "flex", gap: "14px", marginTop: "4px" }}>
                          <span>❓ {q.questionCount} Questions</span>
                          <span>⏱️ {q.timeLimit} Mins Limit</span>
                          <span>🎯 Pass: {q.passingScore}%</span>
                          <span>📅 Published: {q.date}</span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <Link
                          to={`/teacher/quiz-results?quizId=${q.id}`}
                          style={{
                            padding: "8px 16px",
                            background: "#ede9fe",
                            color: "#6d28d9",
                            borderRadius: "10px",
                            fontSize: "13px",
                            fontWeight: "700",
                            textDecoration: "none",
                          }}
                        >
                          View Results →
                        </Link>

                        <button
                          onClick={() => handleDeleteQuiz(q.id)}
                          style={{
                            padding: "8px 14px",
                            background: "#fee2e2",
                            color: "#b91c1c",
                            border: "none",
                            borderRadius: "10px",
                            fontSize: "13px",
                            fontWeight: "700",
                            cursor: "pointer",
                          }}
                        >
                          Delete Quiz
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 2: NOTES ================= */}
        {activeTab === "notes" && (
          <div>
            {/* Upload Notes Form */}
            <div style={{ background: "#ffffff", borderRadius: "20px", padding: "32px", border: "1px solid #f3e8ff", marginBottom: "36px", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
              <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#1e293b", margin: "0 0 4px 0" }}>
                📄 Upload Course Notes & Handouts
              </h2>
              <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 24px 0" }}>
                Upload written study notes, chapter summaries, or PDF handouts for your students.
              </p>

              <form onSubmit={handlePublishNotes}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                      Note Title
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Heuristic Search Algorithms & Admissibility Handout"
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                      Subject
                    </label>
                    <select
                      value={noteSubject}
                      onChange={(e) => setNoteSubject(e.target.value)}
                      style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
                    >
                      <option value="Artificial Intelligence">Artificial Intelligence</option>
                      <option value="Deep Learning">Deep Learning</option>
                      <option value="Database Systems">Database Systems</option>
                      <option value="Computer Networks">Computer Networks</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                      Module / Chapter
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Unit 2: Heuristics"
                      value={noteModule}
                      onChange={(e) => setNoteModule(e.target.value)}
                      style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                    Notes Overview / Summary Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Short description of the handout content..."
                    value={noteDescription}
                    onChange={(e) => setNoteDescription(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                    Detailed Notes Content (Markdown / Full Text)
                  </label>
                  <textarea
                    rows={5}
                    placeholder="Paste the notes text, key formulas, code snippets, or revision points..."
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box" }}
                    required
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <label style={{ fontSize: "13px", fontWeight: "600", color: "#64748b", cursor: "pointer" }}>
                      📎 Attach Document / PDF File:{" "}
                      <input
                        type="file"
                        accept=".pdf,.docx,.txt"
                        onChange={(e) => setNoteFileName(e.target.value)}
                        style={{ fontSize: "12px", marginLeft: "6px" }}
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    style={{
                      padding: "12px 28px",
                      background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "12px",
                      fontWeight: "700",
                      fontSize: "15px",
                      cursor: "pointer",
                      boxShadow: "0 4px 14px rgba(124, 58, 237, 0.3)",
                    }}
                  >
                    Upload Notes →
                  </button>
                </div>
              </form>
            </div>

            {/* History of Uploaded Notes */}
            <div style={{ background: "#ffffff", borderRadius: "20px", padding: "32px", border: "1px solid #f3e8ff", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
              <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#1e293b", margin: "0 0 4px 0" }}>
                History of Uploaded Notes
              </h2>
              <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 20px 0" }}>
                Manage all study notes currently accessible by your enrolled students.
              </p>

              {notes.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                  No study notes uploaded yet. Upload your first document above.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {notes.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        padding: "20px",
                        background: "#fbfaff",
                        borderRadius: "16px",
                        border: "1px solid #f3e8ff",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "16px",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                          <span style={{ fontSize: "11px", fontWeight: "700", background: "#ede9fe", color: "#6d28d9", padding: "3px 8px", borderRadius: "6px" }}>
                            {n.subject}
                          </span>
                          <span style={{ fontSize: "11px", color: "#64748b" }}>{n.module}</span>
                          <span style={{ fontSize: "11px", color: "#94a3b8" }}>• {n.date}</span>
                        </div>

                        <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#1e293b", margin: "0 0 6px 0" }}>
                          {n.title}
                        </h3>

                        <p style={{ fontSize: "13px", color: "#475569", margin: "0 0 8px 0", lineHeight: "1.5" }}>
                          {n.description}
                        </p>

                        <div style={{ fontSize: "12px", color: "#7c3aed", fontWeight: "600" }}>
                          📄 {n.fileSize || "PDF Handout"} • {n.pages || "Handout"}
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteNote(n.id)}
                        style={{
                          padding: "8px 14px",
                          background: "#fee2e2",
                          color: "#b91c1c",
                          border: "none",
                          borderRadius: "10px",
                          fontSize: "13px",
                          fontWeight: "700",
                          cursor: "pointer",
                        }}
                      >
                        Delete Note
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 3: LECTURES ================= */}
        {activeTab === "lectures" && (
          <div>
            {/* Upload Lecture Form */}
            <div style={{ background: "#ffffff", borderRadius: "20px", padding: "32px", border: "1px solid #f3e8ff", marginBottom: "36px", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
              <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#1e293b", margin: "0 0 4px 0" }}>
                🎥 Upload Video Lecture & Recording
              </h2>
              <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 24px 0" }}>
                Provide YouTube or video recording links for student lectures and attach takeaways.
              </p>

              <form onSubmit={handlePublishLecture}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                      Lecture Title
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Adversarial Search & Minimax Trees"
                      value={lectureTitle}
                      onChange={(e) => setLectureTitle(e.target.value)}
                      style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                      Subject
                    </label>
                    <select
                      value={lectureSubject}
                      onChange={(e) => setLectureSubject(e.target.value)}
                      style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
                    >
                      <option value="Artificial Intelligence">Artificial Intelligence</option>
                      <option value="Deep Learning">Deep Learning</option>
                      <option value="Database Systems">Database Systems</option>
                      <option value="Computer Networks">Computer Networks</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                      Duration
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 45 min"
                      value={lectureDuration}
                      onChange={(e) => setLectureDuration(e.target.value)}
                      style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                    Video URL (YouTube or Embed Link)
                  </label>
                  <input
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={lectureUrl}
                    onChange={(e) => setLectureUrl(e.target.value)}
                    style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
                    required
                  />
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                    Lecture Overview
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Short description of topics analyzed in this video session..."
                    value={lectureDescription}
                    onChange={(e) => setLectureDescription(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>

                <div style={{ marginBottom: "24px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                    Key Takeaways (One point per line)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Point 1: Rational agents maximize expected utility&#10;Point 2: Minimax evaluation optimal against optimal opponent"
                    value={lectureTakeaways}
                    onChange={(e) => setLectureTakeaways(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="submit"
                    style={{
                      padding: "12px 28px",
                      background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "12px",
                      fontWeight: "700",
                      fontSize: "15px",
                      cursor: "pointer",
                      boxShadow: "0 4px 14px rgba(37, 99, 235, 0.3)",
                    }}
                  >
                    Publish Lecture Video →
                  </button>
                </div>
              </form>
            </div>

            {/* History of Uploaded Lectures */}
            <div style={{ background: "#ffffff", borderRadius: "20px", padding: "32px", border: "1px solid #f3e8ff", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
              <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#1e293b", margin: "0 0 4px 0" }}>
                History of Uploaded Lectures
              </h2>
              <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 20px 0" }}>
                All recorded lecture modules with delete options.
              </p>

              {lectures.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                  No video lectures published yet. Add a lecture above.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {lectures.map((lec) => (
                    <div
                      key={lec.id}
                      style={{
                        padding: "24px",
                        background: "#fbfaff",
                        borderRadius: "16px",
                        border: "1px solid #f3e8ff",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                        gap: "20px",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: "280px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                          <span style={{ fontSize: "11px", fontWeight: "700", background: "#dbeafe", color: "#1d4ed8", padding: "3px 8px", borderRadius: "6px" }}>
                            {lec.subject}
                          </span>
                          <span style={{ fontSize: "12px", color: "#64748b" }}>⏱️ {lec.duration}</span>
                          <span style={{ fontSize: "12px", color: "#94a3b8" }}>• {lec.date}</span>
                        </div>

                        <h3 style={{ fontSize: "17px", fontWeight: "800", color: "#1e293b", margin: "0 0 8px 0" }}>
                          {lec.title}
                        </h3>

                        <p style={{ fontSize: "14px", color: "#475569", margin: "0 0 12px 0", lineHeight: "1.5" }}>
                          {lec.description}
                        </p>

                        {lec.takeaways && lec.takeaways.length > 0 && (
                          <div style={{ background: "#ffffff", padding: "12px 16px", borderRadius: "10px", border: "1px solid #ede9fe" }}>
                            <strong style={{ fontSize: "12px", color: "#6d28d9", display: "block", marginBottom: "4px" }}>
                              Key Takeaways:
                            </strong>
                            <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "13px", color: "#334155" }}>
                              {lec.takeaways.map((t, idx) => (
                                <li key={idx} style={{ marginBottom: "2px" }}>
                                  {t}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "10px" }}>
                        {lec.videoEmbedUrl && (
                          <a
                            href={lec.videoEmbedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: "8px 16px",
                              background: "#dbeafe",
                              color: "#1d4ed8",
                              borderRadius: "10px",
                              fontSize: "13px",
                              fontWeight: "700",
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <span>▶ Watch Video</span>
                          </a>
                        )}

                        <button
                          onClick={() => handleDeleteLecture(lec.id)}
                          style={{
                            padding: "8px 14px",
                            background: "#fee2e2",
                            color: "#b91c1c",
                            border: "none",
                            borderRadius: "10px",
                            fontSize: "13px",
                            fontWeight: "700",
                            cursor: "pointer",
                          }}
                        >
                          Delete Lecture
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default TeacherDocuments;
