import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getTeacherQuizzes, sendQuizReminder, notifyLerniqSync, onLerniqSync } from "../services/frontendStorage";
import { quizApi, teacherApi } from "../services/api";
import { useAuth } from "../context/useAuth";
import Navbar from "./Navbar";

function TeacherQuizResults() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [backendRoster, setBackendRoster] = useState(null);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [reviewModalStudent, setReviewModalStudent] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [attemptFilter, setAttemptFilter] = useState("all"); // "all" | "attempted" | "not_attempted"
  const [toast, setToast] = useState("");

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  const loadSubmissions = async (quizId) => {
    if (!quizId) return;
    setIsLoadingSubmissions(true);
    try {
      const res = await quizApi.getSubmissions(quizId);
      if (res && res.studentRoster && res.studentRoster.length > 0) {
        setBackendRoster(res.studentRoster);
      } else if (res && res.attempts && res.attempts.length > 0) {
        const formatted = res.attempts.map((a) => ({
          studentId: a.student?.id || a.studentId,
          name: a.student?.name || "Student",
          email: a.student?.email || "",
          attempted: true,
          score: a.percentage,
          marks: a.score,
          totalMarks: a.totalQuestions,
          totalQuestions: a.totalQuestions,
          correctCount: a.correctCount,
          wrongCount: a.wrongCount,
          unattemptedCount: a.unattemptedCount,
          percentage: a.percentage,
          passed: a.passed,
          completedAt: a.completedAt ? new Date(a.completedAt).toLocaleString() : null,
          attemptId: a.id,
          answers: a.answers || [],
        }));
        setBackendRoster(formatted);
      } else if (res && res.studentRoster) {
        setBackendRoster(res.studentRoster);
      } else {
        setBackendRoster(null);
      }
    } catch (err) {
      console.warn("Could not load backend submissions, using local roster:", err);
      setBackendRoster(null);
    } finally {
      setIsLoadingSubmissions(false);
    }
  };

  const loadQuizzes = async () => {
    try {
      const res = await quizApi.list();
      const apiQuizzes = (res.quizzes || []).map((q) => ({
        id: q._id || q.id,
        title: q.title,
        subject: q.subject,
        questionCount: q.questions ? q.questions.length : (q.questionCount || 0),
        passingScore: q.passingScore,
        timeLimit: q.timeLimit,
        difficulty: q.difficulty,
        studentRoster: q.studentRoster || [],
        questions: q.questions || [],
      }));

      const localQuizzes = getTeacherQuizzes();
      const combined = apiQuizzes.length > 0 ? apiQuizzes : localQuizzes;
      setQuizzes(combined);

      const paramId = searchParams.get("quizId");
      const targetId = paramId && combined.some((q) => q.id === paramId)
        ? paramId
        : (combined.length > 0 ? combined[0].id : "");

      setSelectedQuizId(targetId);
      if (targetId) {
        loadSubmissions(targetId);
      }
    } catch (err) {
      console.warn("Falling back to local quizzes:", err);
      const list = getTeacherQuizzes();
      setQuizzes(list);
      if (list.length > 0) {
        setSelectedQuizId(list[0].id);
      }
    }
  };

  useEffect(() => {
    loadQuizzes();
    const unsubscribe = onLerniqSync((detail) => {
      if (
        detail.type === "QUIZ_ATTEMPT_SUBMITTED" ||
        detail.type === "QUIZ_UPLOADED" ||
        detail.type === "QUIZ_PUBLISHED" ||
        detail.type === "QUIZ_DELETED"
      ) {
        loadQuizzes();
      }
    });
    return unsubscribe;
  }, [searchParams]);

  const handleSendReminderToStudent = async (std) => {
    if (!selectedQuiz) return;
    const sId = std.studentId || std.id;
    const qTitle = selectedQuiz.title;
    const qId = selectedQuiz._id || selectedQuiz.id;

    // 1. Send via backend API to store message & notification in MongoDB
    try {
      if (sId) {
        await teacherApi.sendDirectMessage(sId, {
          text: `Quiz Reminder: Please attempt and complete your quiz "${qTitle}". Test your knowledge now!`,
          type: "quiz_reminder",
          quizId: qId,
          quizTitle: qTitle,
        });
      }
    } catch (err) {
      console.warn("Backend quiz reminder API warning:", err.message);
    }

    // 2. Also send via frontend storage and sync bus
    sendQuizReminder({
      studentId: sId,
      studentName: std.name,
      studentEmail: std.email,
      quizTitle: qTitle,
      teacherName: user?.name || "Prof. Sarah Jenkins",
    });

    notifyLerniqSync("QUIZ_NOTIFICATION", {
      title: `Reminder: ${qTitle}`,
      message: `${user?.name || "Your Teacher"} sent a reminder to complete "${qTitle}".`,
      studentId: sId,
      quizId: qId,
    });

    showToast(`📢 Reminder delivered directly to ${std.name} (${std.email})!`);
  };

  const handleSelectQuiz = (id) => {
    setSelectedQuizId(id);
    setSearchParams({ quizId: id });
    loadSubmissions(id);
  };

  const selectedQuiz = quizzes.find((q) => q.id === selectedQuizId) || quizzes[0] || null;

  // Student roster for selected quiz (backend roster from MongoDB or local fallback)
  const baseRoster = (backendRoster && backendRoster.length > 0)
    ? backendRoster
    : (selectedQuiz?.studentRoster && selectedQuiz.studentRoster.length > 0 ? selectedQuiz.studentRoster : []);

  // Filter out any mock students just in case (e.g. Alex Smith, Marcus Chen, etc.)
  const roster = baseRoster.filter(
    (s) =>
      s.name !== "Alex Smith" &&
      s.name !== "Marcus Chen" &&
      s.name !== "Elena Rostova" &&
      s.name !== "Devin Taylor" &&
      s.name !== "Priya Sharma" &&
      s.name !== "Lucas Vance" &&
      s.name !== "Sophia Miller" &&
      s.name !== "Hassan Ali"
  );

  // Filter roster
  const filteredStudents = roster.filter((std) => {
    const q = searchQuery.toLowerCase();
    const nameMatch = std.name?.toLowerCase().includes(q);
    const emailMatch = std.email?.toLowerCase().includes(q);
    const idMatch = std.studentId?.toLowerCase().includes(q);
    const matchesSearch = nameMatch || emailMatch || idMatch;

    if (!matchesSearch) return false;

    if (attemptFilter === "attempted") return std.attempted === true;
    if (attemptFilter === "not_attempted") return std.attempted === false;
    return true;
  });

  // Calculate stats
  const totalEnrolled = roster.length;
  const attemptedStudents = roster.filter((s) => s.attempted);
  const attemptedCount = attemptedStudents.length;
  const notAttemptedCount = totalEnrolled - attemptedCount;

  const attemptRate = totalEnrolled > 0
    ? Math.round((attemptedCount / totalEnrolled) * 100)
    : 0;

  const avgScore = attemptedCount > 0
    ? Math.round(attemptedStudents.reduce((acc, s) => acc + s.score, 0) / attemptedCount)
    : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#faf9ff" }}>
      <Navbar activeTab="quiz-results" />

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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "30px" }}>
          <div>
            <span style={{ fontSize: "12px", letterSpacing: "1px", textTransform: "uppercase", background: "#ede9fe", color: "#6d28d9", padding: "4px 10px", borderRadius: "8px", fontWeight: "700" }}>
              ASSESSMENT ANALYTICS
            </span>
            <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#1f2937", margin: "8px 0 4px 0" }}>
              Class Quiz Results & Student Submissions
            </h1>
            <p style={{ color: "#6b7280", margin: 0, fontSize: "15px" }}>
              Inspect quiz completion rates, average accuracy, and verify who has attempted versus not attempted.
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <Link
              to="/teacher/documents?tab=quizzes"
              style={{
                padding: "10px 18px",
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#ffffff",
                borderRadius: "12px",
                fontWeight: 700,
                textDecoration: "none",
                fontSize: "13px",
              }}
            >
              + Conduct New Quiz
            </Link>

            <Link
              to="/teacher/dashboard"
              style={{
                padding: "10px 18px",
                background: "#ede9fe",
                color: "#6d28d9",
                borderRadius: "12px",
                fontWeight: 600,
                textDecoration: "none",
                fontSize: "13px",
              }}
            >
              ← Overview
            </Link>
          </div>
        </div>

        {/* 3 UPDATED METRIC CARDS (Requested by User) */}
        {/* Card 1: Quiz Uploaded (Choose the Quiz) */}
        {/* Card 2: Average Class Attempted */}
        {/* Card 3: Average Score */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px", marginBottom: "32px" }}>
          {/* CARD 1: QUIZ UPLOADED (CHOOSE THE QUIZ) */}
          <div
            style={{
              background: "#ffffff",
              padding: "24px",
              borderRadius: "20px",
              border: "2px solid #7c3aed",
              boxShadow: "0 4px 20px rgba(124, 58, 237, 0.08)",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontSize: "28px" }}>📋</span>
              <span style={{ fontSize: "11px", fontWeight: "700", background: "#ede9fe", color: "#6d28d9", padding: "3px 8px", borderRadius: "6px" }}>
                CHOOSE QUIZ
              </span>
            </div>

            <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: "700", textTransform: "uppercase" }}>
              QUIZ UPLOADED
            </div>

            {/* Quiz Selector Dropdown */}
            <select
              value={selectedQuizId}
              onChange={(e) => handleSelectQuiz(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                marginTop: "8px",
                borderRadius: "10px",
                border: "1.5px solid #d8b4fe",
                background: "#faf5ff",
                color: "#1e293b",
                fontWeight: "700",
                fontSize: "14px",
                outline: "none",
                cursor: "pointer",
              }}
            >
              {quizzes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title} ({q.subject})
                </option>
              ))}
            </select>

            <div style={{ display: "flex", gap: "10px", marginTop: "10px", fontSize: "12px", color: "#6d28d9", fontWeight: "600" }}>
              <span>❓ {selectedQuiz?.questionCount || 10} Questions</span>
              <span>•</span>
              <span>Pass: {selectedQuiz?.passingScore || 60}%</span>
            </div>
          </div>

          {/* CARD 2: AVERAGE CLASS ATTEMPTED */}
          <div
            style={{
              background: "#ffffff",
              padding: "24px",
              borderRadius: "20px",
              border: "1px solid #f3e8ff",
              boxShadow: "0 4px 15px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontSize: "28px" }}>👥</span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "700",
                  padding: "3px 8px",
                  borderRadius: "6px",
                  background: attemptRate >= 70 ? "#dcfce7" : "#fef3c7",
                  color: attemptRate >= 70 ? "#15803d" : "#92400e",
                }}
              >
                {attemptRate}% Turnout
              </span>
            </div>

            <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: "700", textTransform: "uppercase" }}>
              AVERAGE CLASS ATTEMPTED
            </div>

            <div style={{ fontSize: "32px", fontWeight: "800", color: "#1f2937", marginTop: "6px" }}>
              {attemptedCount} / {totalEnrolled} Students
            </div>

            <small style={{ color: "#059669", fontWeight: "600", display: "block", marginTop: "4px" }}>
              {notAttemptedCount === 0
                ? "🎉 100% of enrolled students have completed this quiz!"
                : `${notAttemptedCount} student${notAttemptedCount > 1 ? "s" : ""} pending submission`}
            </small>
          </div>

          {/* CARD 3: AVERAGE SCORE */}
          <div
            style={{
              background: "#ffffff",
              padding: "24px",
              borderRadius: "20px",
              border: "1px solid #f3e8ff",
              boxShadow: "0 4px 15px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontSize: "28px" }}>🎯</span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "700",
                  padding: "3px 8px",
                  borderRadius: "6px",
                  background: avgScore >= 70 ? "#dcfce7" : avgScore >= 50 ? "#fef3c7" : "#fee2e2",
                  color: avgScore >= 70 ? "#15803d" : avgScore >= 50 ? "#92400e" : "#b91c1c",
                }}
              >
                Benchmark: {selectedQuiz?.passingScore || 60}%
              </span>
            </div>

            <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: "700", textTransform: "uppercase" }}>
              AVERAGE SCORE
            </div>

            <div
              style={{
                fontSize: "32px",
                fontWeight: "800",
                color: avgScore >= 70 ? "#059669" : avgScore >= 50 ? "#d97706" : "#dc2626",
                marginTop: "6px",
              }}
            >
              {attemptedCount > 0 ? `${avgScore}%` : "No attempts yet"}
            </div>

            <small style={{ color: "#6b7280", display: "block", marginTop: "4px" }}>
              Based on {attemptedCount} evaluated submission{attemptedCount !== 1 ? "s" : ""}
            </small>
          </div>
        </div>

        {/* SEARCH AND FILTER BAR (Who has attempted vs not attempted) */}
        <div style={{ background: "#ffffff", borderRadius: "20px", padding: "28px", border: "1px solid #f3e8ff", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "20px" }}>
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#1f2937", margin: 0 }}>
                Student Participation & Attempt Roster
              </h2>
              <p style={{ color: "#6b7280", fontSize: "13px", marginTop: "2px" }}>
                Filter and search to see which students have submitted their quiz and who has yet to attempt.
              </p>
            </div>

            {/* Filter Tabs: All, Attempted, Not Attempted */}
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setAttemptFilter("all")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "10px",
                  border: "none",
                  fontSize: "13px",
                  fontWeight: "700",
                  cursor: "pointer",
                  background: attemptFilter === "all" ? "#6d28d9" : "#f1f5f9",
                  color: attemptFilter === "all" ? "#ffffff" : "#475569",
                }}
              >
                All Students ({totalEnrolled})
              </button>

              <button
                onClick={() => setAttemptFilter("attempted")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "10px",
                  border: "none",
                  fontSize: "13px",
                  fontWeight: "700",
                  cursor: "pointer",
                  background: attemptFilter === "attempted" ? "#059669" : "#f1f5f9",
                  color: attemptFilter === "attempted" ? "#ffffff" : "#475569",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>✅ Attempted</span>
                <span>({attemptedCount})</span>
              </button>

              <button
                onClick={() => setAttemptFilter("not_attempted")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "10px",
                  border: "none",
                  fontSize: "13px",
                  fontWeight: "700",
                  cursor: "pointer",
                  background: attemptFilter === "not_attempted" ? "#d97706" : "#f1f5f9",
                  color: attemptFilter === "not_attempted" ? "#ffffff" : "#475569",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>⏳ Not Attempted</span>
                <span>({notAttemptedCount})</span>
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div style={{ marginBottom: "20px" }}>
            <input
              type="text"
              placeholder="🔍 Search student by name, email, or student ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 18px",
                borderRadius: "12px",
                border: "1.5px solid #e2e8f0",
                fontSize: "14px",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          {/* Table */}
          {filteredStudents.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
              <span style={{ fontSize: "32px", display: "block", marginBottom: "8px" }}>🔍</span>
              No students found matching your search or attempt filter.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #f3f4f6", color: "#6b7280", fontSize: "12px", textTransform: "uppercase" }}>
                    <th style={{ padding: "12px 16px" }}>Student</th>
                    <th style={{ padding: "12px 16px" }}>Status</th>
                    <th style={{ padding: "12px 16px" }}>Score</th>
                    <th style={{ padding: "12px 16px" }}>Percentage</th>
                    <th style={{ padding: "12px 16px" }}>Submission Timestamp</th>
                    <th style={{ padding: "12px 16px" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((std) => (
                    <tr key={std.studentId} style={{ borderBottom: "1px solid #f9fafb" }}>
                      <td style={{ padding: "16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "50%",
                              background: std.attempted ? "#ede9fe" : "#f1f5f9",
                              color: std.attempted ? "#6d28d9" : "#64748b",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: "700",
                              fontSize: "14px",
                            }}
                          >
                            {std.name.charAt(0)}
                          </div>
                          <div>
                            <strong style={{ color: "#1e293b", fontSize: "14px" }}>{std.name}</strong>
                            <div style={{ fontSize: "12px", color: "#64748b" }}>{std.email}</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: "16px" }}>
                        {std.attempted ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "4px 10px",
                              borderRadius: "8px",
                              fontSize: "12px",
                              fontWeight: "700",
                              background: "#dcfce7",
                              color: "#15803d",
                            }}
                          >
                            <span>✓</span>
                            <span>Attempted</span>
                          </span>
                        ) : (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "4px 10px",
                              borderRadius: "8px",
                              fontSize: "12px",
                              fontWeight: "700",
                              background: "#fef3c7",
                              color: "#b45309",
                            }}
                          >
                            <span>⏳</span>
                            <span>Not Attempted</span>
                          </span>
                        )}
                      </td>

                      <td style={{ padding: "16px" }}>
                        {std.attempted ? (
                          <div>
                            <span style={{ fontWeight: "800", color: "#1e293b", fontSize: "15px" }}>
                              {std.marks !== undefined ? std.marks : Math.round((std.score / 100) * std.totalQuestions)} / {std.totalMarks || std.totalQuestions}
                            </span>
                            {std.correctCount !== undefined && (
                              <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                                <span style={{ color: "#16a34a", fontWeight: "700" }}>✓ {std.correctCount}</span> •{" "}
                                <span style={{ color: "#dc2626", fontWeight: "700" }}>✗ {std.wrongCount}</span> •{" "}
                                <span style={{ color: "#64748b" }}>⚪ {std.unattemptedCount}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: "13px" }}>—</span>
                        )}
                      </td>

                      <td style={{ padding: "16px" }}>
                        {std.attempted ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span
                              style={{
                                fontWeight: "700",
                                fontSize: "13px",
                                color: std.score >= 70 ? "#059669" : std.score >= 50 ? "#d97706" : "#dc2626",
                              }}
                            >
                              {std.score}%
                            </span>
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: "800",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                background: std.passed ? "#dcfce7" : "#fee2e2",
                                color: std.passed ? "#166534" : "#991b1b",
                              }}
                            >
                              {std.passed ? "PASSED" : "FAILED"}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: "13px" }}>Pending</span>
                        )}
                      </td>

                      <td style={{ padding: "16px", color: "#64748b", fontSize: "13px" }}>
                        {std.attempted && std.completedAt ? (
                          std.completedAt
                        ) : (
                          <span style={{ color: "#94a3b8", fontStyle: "italic" }}>Not submitted yet</span>
                        )}
                      </td>

                      <td style={{ padding: "16px" }}>
                        {std.attempted ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <button
                              onClick={() => setReviewModalStudent(std)}
                              style={{
                                padding: "6px 12px",
                                background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                                color: "#ffffff",
                                border: "none",
                                borderRadius: "8px",
                                fontSize: "12px",
                                fontWeight: "700",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                boxShadow: "0 2px 8px rgba(124, 58, 237, 0.25)",
                              }}
                            >
                              <span>👁️</span>
                              <span>Review Answers</span>
                            </button>

                            <Link
                              to={`/teacher/students/${std.studentId}`}
                              style={{
                                color: "#7c3aed",
                                fontWeight: "700",
                                fontSize: "12px",
                                textDecoration: "none",
                              }}
                            >
                              Profile →
                            </Link>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleSendReminderToStudent(std)}
                            style={{
                              padding: "6px 12px",
                              background: "#fffbeb",
                              color: "#b45309",
                              border: "1px solid #fde68a",
                              borderRadius: "8px",
                              fontSize: "12px",
                              fontWeight: "700",
                              cursor: "pointer",
                            }}
                          >
                            📢 Send Reminder
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ================= REVIEW STUDENT SUBMISSION MODAL ================= */}
        {reviewModalStudent && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(15, 23, 42, 0.75)",
              backdropFilter: "blur(5px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 99999,
              padding: "20px",
            }}
            onClick={() => setReviewModalStudent(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#ffffff",
                borderRadius: "24px",
                width: "100%",
                maxWidth: "880px",
                maxHeight: "92vh",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
                overflow: "hidden",
              }}
            >
              {/* Modal Header */}
              <div
                style={{
                  background: "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)",
                  color: "#ffffff",
                  padding: "22px 28px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: "700",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      background: "rgba(255,255,255,0.2)",
                      padding: "3px 8px",
                      borderRadius: "6px",
                    }}
                  >
                    Student Quiz Review
                  </span>
                  <h2 style={{ fontSize: "20px", fontWeight: "800", margin: "6px 0 0 0" }}>
                    {reviewModalStudent.name} ({reviewModalStudent.email})
                  </h2>
                  <div style={{ fontSize: "13px", opacity: 0.9, marginTop: "2px" }}>
                    Assessment: <strong>{selectedQuiz?.title}</strong>
                  </div>
                </div>

                <button
                  onClick={() => setReviewModalStudent(null)}
                  style={{
                    background: "rgba(255,255,255,0.2)",
                    border: "none",
                    borderRadius: "50%",
                    width: "36px",
                    height: "36px",
                    color: "#ffffff",
                    fontSize: "16px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Score Summary Strip */}
              <div
                style={{
                  padding: "16px 28px",
                  background: "#f8fafc",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "24px",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: "700" }}>Total Marks</div>
                    <div style={{ fontSize: "22px", fontWeight: "800", color: "#1e293b" }}>
                      {reviewModalStudent.marks !== undefined ? reviewModalStudent.marks : Math.round((reviewModalStudent.score / 100) * reviewModalStudent.totalQuestions)} / {reviewModalStudent.totalMarks || reviewModalStudent.totalQuestions}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: "700" }}>Percentage</div>
                    <div
                      style={{
                        fontSize: "22px",
                        fontWeight: "800",
                        color: reviewModalStudent.score >= 70 ? "#059669" : reviewModalStudent.score >= 50 ? "#d97706" : "#dc2626",
                      }}
                    >
                      {reviewModalStudent.score}%
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase", fontWeight: "700" }}>Outcome</div>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: "800",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        background: reviewModalStudent.passed ? "#dcfce7" : "#fee2e2",
                        color: reviewModalStudent.passed ? "#166534" : "#991b1b",
                        display: "inline-block",
                        marginTop: "4px",
                      }}
                    >
                      {reviewModalStudent.passed ? "PASSED" : "FAILED"}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: "13px", color: "#64748b" }}>
                  <div>✓ Correct: <strong style={{ color: "#16a34a" }}>{reviewModalStudent.correctCount !== undefined ? reviewModalStudent.correctCount : reviewModalStudent.marks}</strong></div>
                  <div>✗ Wrong: <strong style={{ color: "#dc2626" }}>{reviewModalStudent.wrongCount !== undefined ? reviewModalStudent.wrongCount : ((reviewModalStudent.totalQuestions || 0) - (reviewModalStudent.marks || 0))}</strong></div>
                  <div>Submitted: <strong>{reviewModalStudent.completedAt || "Recent"}</strong></div>
                </div>
              </div>

              {/* Questions Breakdown List */}
              <div style={{ padding: "24px 28px", overflowY: "auto", flex: 1 }}>
                <h3 style={{ fontSize: "16px", fontWeight: "800", color: "#1e293b", marginBottom: "16px" }}>
                  Detailed Question Breakdown & Student Answer Evaluation
                </h3>

                {(!reviewModalStudent.answers || reviewModalStudent.answers.length === 0) ? (
                  <div style={{ padding: "28px", textAlign: "center", color: "#64748b" }}>
                    Detailed answer breakdown not recorded for this historical attempt.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                    {reviewModalStudent.answers.map((ans, idx) => {
                      const isCorrect = ans.isCorrect === true || ans.status === "Correct";
                      const isNotAttempted = ans.status === "Not Attempted" || ans.selectedAnswer === -1;

                      return (
                        <div
                          key={idx}
                          style={{
                            borderRadius: "14px",
                            border: isCorrect ? "1.5px solid #86efac" : isNotAttempted ? "1.5px solid #cbd5e1" : "1.5px solid #fca5a5",
                            background: isCorrect ? "#f0fdf4" : isNotAttempted ? "#f8fafc" : "#fef2f2",
                            padding: "16px 20px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                            <span style={{ fontSize: "13px", fontWeight: "800", color: "#334155" }}>
                              Question {idx + 1}
                            </span>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: "800",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                background: isCorrect ? "#dcfce7" : isNotAttempted ? "#e2e8f0" : "#fee2e2",
                                color: isCorrect ? "#15803d" : isNotAttempted ? "#475569" : "#b91c1c",
                              }}
                            >
                              {isCorrect ? "✓ Correct" : isNotAttempted ? "⚪ Not Attempted" : "✗ Wrong"}
                            </span>
                          </div>

                          <p style={{ fontWeight: "700", color: "#1e293b", margin: "0 0 12px 0", fontSize: "14px" }}>
                            {ans.question || ans.questionText || `Question ${idx + 1}`}
                          </p>

                          {/* Options */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px", marginBottom: "10px" }}>
                            {(ans.options || ["Option A", "Option B", "Option C", "Option D"]).map((opt, optIdx) => {
                              const isSelected = ans.selectedAnswer === optIdx;
                              const isAnswer = (ans.correctAnswer !== undefined ? ans.correctAnswer : ans.correctOption) === optIdx;

                              let optBg = "#ffffff";
                              let optBorder = "#e2e8f0";
                              let optColor = "#334155";
                              let badge = null;

                              if (isSelected && isAnswer) {
                                optBg = "#dcfce7";
                                optBorder = "#22c55e";
                                optColor = "#15803d";
                                badge = "✓ Student Answer (Correct)";
                              } else if (isSelected && !isAnswer) {
                                optBg = "#fee2e2";
                                optBorder = "#ef4444";
                                optColor = "#b91c1c";
                                badge = "✗ Student Selected (Wrong)";
                              } else if (isAnswer) {
                                optBg = "#dcfce7";
                                optBorder = "#86efac";
                                optColor = "#15803d";
                                badge = "✓ Correct Answer";
                              }

                              return (
                                <div
                                  key={optIdx}
                                  style={{
                                    padding: "9px 14px",
                                    borderRadius: "8px",
                                    border: `1.5px solid ${optBorder}`,
                                    background: optBg,
                                    color: optColor,
                                    fontSize: "13px",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    fontWeight: isSelected || isAnswer ? "700" : "500",
                                  }}
                                >
                                  <span>{String.fromCharCode(65 + optIdx)}. {opt}</span>
                                  {badge && (
                                    <span style={{ fontSize: "11px", fontWeight: "800" }}>{badge}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {ans.explanation && (
                            <div
                              style={{
                                marginTop: "8px",
                                padding: "10px 14px",
                                borderRadius: "8px",
                                background: "#ffffff",
                                border: "1px solid #e2e8f0",
                                fontSize: "12px",
                                color: "#475569",
                              }}
                            >
                              <strong style={{ color: "#7c3aed" }}>💡 Explanation: </strong>
                              {ans.explanation}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: "16px 28px",
                  borderTop: "1px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "flex-end",
                  background: "#f8fafc",
                }}
              >
                <button
                  onClick={() => setReviewModalStudent(null)}
                  style={{
                    padding: "10px 22px",
                    borderRadius: "10px",
                    background: "#7c3aed",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: "700",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Close Review
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default TeacherQuizResults;
