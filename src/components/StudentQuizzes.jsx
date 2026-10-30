import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/useAuth";
import {
  getTeacherQuizzes,
  getStudentQuizAttempt,
  recordStudentQuizAttempt,
  onLerniqSync,
} from "../services/frontendStorage";
import Navbar from "./Navbar";

function StudentQuizzes() {
  const { user } = useAuth();
  const studentKey = user?.id || user?._id || user?.email || "default_student";

  const [quizzes, setQuizzes] = useState(() => getTeacherQuizzes());
  const [filter, setFilter] = useState("all"); // "all", "pending", "completed"
  const [search, setSearch] = useState("");

  // Active Quiz Solver State
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({}); // { [qIdx]: selectedOptionIdx }
  const [timeLeft, setTimeLeft] = useState(null); // seconds or null if untimed
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizResult, setQuizResult] = useState(null);
  const timerRef = useRef(null);

  // Load and subscribe to real-time updates (when teacher uploads/deletes a quiz)
  useEffect(() => {
    setQuizzes(getTeacherQuizzes());
    const unsubscribe = onLerniqSync((detail) => {
      if (
        detail.type === "QUIZ_UPLOADED" ||
        detail.type === "QUIZ_DELETED" ||
        detail.type === "QUIZ_ATTEMPT_SUBMITTED"
      ) {
        setQuizzes(getTeacherQuizzes());
      }
    });
    return unsubscribe;
  }, []);

  // Timer countdown logic
  useEffect(() => {
    if (!activeQuiz || quizSubmitted || timeLeft === null) return;

    if (timeLeft <= 0) {
      handleFinalSubmit();
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleFinalSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [activeQuiz, quizSubmitted, timeLeft]);

  // Start Quiz Handler
  const handleStartQuiz = (quiz) => {
    setActiveQuiz(quiz);
    setCurrentQIndex(0);
    setSelectedAnswers({});
    setQuizSubmitted(false);
    setQuizResult(null);

    // Minimum 1 min timer or null if untimed
    if (quiz.timeLimit && quiz.timeLimit > 0) {
      setTimeLeft(quiz.timeLimit * 60);
    } else {
      setTimeLeft(null);
    }
  };

  const handleSelectOption = (optIndex) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQIndex]: optIndex,
    }));
  };

  const handleFinalSubmit = () => {
    if (!activeQuiz) return;
    clearInterval(timerRef.current);

    const questions = activeQuiz.questions || [];
    let score = 0;
    const answerDetails = questions.map((q, idx) => {
      const selected = selectedAnswers[idx] !== undefined ? selectedAnswers[idx] : -1;
      const correct = q.answerIndex !== undefined ? q.answerIndex : (q.correctAnswer || 0);
      const isCorrect = selected === correct;
      if (isCorrect) score++;

      return {
        questionIndex: idx,
        question: q.question,
        selectedAnswer: selected,
        correctAnswer: correct,
        isCorrect,
        explanation: q.explanation || "",
      };
    });

    const res = recordStudentQuizAttempt({
      quizId: activeQuiz.id,
      studentId: user?.id || user?._id || "std_101",
      studentName: user?.name || "Student",
      studentEmail: user?.email || "student@lerniq.edu",
      score,
      totalQuestions: questions.length,
      answers: answerDetails,
    });

    setQuizResult({
      score,
      totalQuestions: questions.length,
      percentage: res.percentage,
      passed: res.percentage >= (activeQuiz.passingScore || 60),
      answers: answerDetails,
    });
    setQuizSubmitted(true);
    setQuizzes(getTeacherQuizzes());
  };

  // Format seconds to mm:ss
  const formatTime = (seconds) => {
    if (seconds === null) return "Untimed";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Compute stats
  const totalQuizzes = quizzes.length;
  const attemptedQuizzes = quizzes.filter((q) => getStudentQuizAttempt(q.id, studentKey));
  const completedCount = attemptedQuizzes.length;
  const pendingCount = totalQuizzes - completedCount;

  const totalScorePct = attemptedQuizzes.reduce((acc, q) => {
    const att = getStudentQuizAttempt(q.id, studentKey);
    return acc + (att?.percentage || 0);
  }, 0);
  const avgScore = completedCount > 0 ? Math.round(totalScorePct / completedCount) : 0;

  // Filtered List
  const filteredQuizzes = quizzes.filter((q) => {
    const isCompleted = Boolean(getStudentQuizAttempt(q.id, studentKey));
    if (filter === "completed" && !isCompleted) return false;
    if (filter === "pending" && isCompleted) return false;
    if (search.trim()) {
      const qText = search.toLowerCase();
      const matchTitle = q.title?.toLowerCase().includes(qText);
      const matchSubject = q.subject?.toLowerCase().includes(qText);
      return matchTitle || matchSubject;
    }
    return true;
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Navbar activeTab="quizzes" />

      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 20px" }}>
        {/* ================= ACTIVE QUIZ MODAL SOLVER ================= */}
        <AnimatePresence>
          {activeQuiz && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(15, 23, 42, 0.75)",
                backdropFilter: "blur(6px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 99999,
                padding: "20px",
              }}
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                style={{
                  background: "#ffffff",
                  borderRadius: "24px",
                  width: "100%",
                  maxWidth: "760px",
                  maxHeight: "90vh",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
                  overflow: "hidden",
                }}
              >
                {/* Header */}
                <div
                  style={{
                    background: "linear-gradient(135deg, #7c3aed, #4c1d95)",
                    padding: "20px 28px",
                    color: "#ffffff",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", background: "rgba(255,255,255,0.2)", padding: "3px 8px", borderRadius: "6px" }}>
                      {activeQuiz.subject}
                    </span>
                    <h2 style={{ fontSize: "20px", fontWeight: "800", margin: "6px 0 0 0" }}>
                      {activeQuiz.title}
                    </h2>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    {/* Timer Widget */}
                    <div
                      style={{
                        background: timeLeft !== null && timeLeft <= 60 ? "#ef4444" : "rgba(255,255,255,0.2)",
                        padding: "8px 14px",
                        borderRadius: "12px",
                        fontWeight: "800",
                        fontSize: "14px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span>⏱️</span>
                      <span>{formatTime(timeLeft)}</span>
                    </div>

                    <button
                      onClick={() => setActiveQuiz(null)}
                      style={{
                        background: "rgba(255, 255, 255, 0.2)",
                        border: "none",
                        borderRadius: "50%",
                        width: "32px",
                        height: "32px",
                        color: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Body Content */}
                <div style={{ padding: "28px", overflowY: "auto", flex: 1 }}>
                  {!quizSubmitted ? (
                    <div>
                      {/* Progress Bar */}
                      <div style={{ marginBottom: "20px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: "700", color: "#64748b", marginBottom: "6px" }}>
                          <span>Question {currentQIndex + 1} of {activeQuiz.questions.length}</span>
                          <span>{Math.round(((currentQIndex + 1) / activeQuiz.questions.length) * 100)}% Completed</span>
                        </div>
                        <div style={{ height: "8px", background: "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${((currentQIndex + 1) / activeQuiz.questions.length) * 100}%`,
                              background: "linear-gradient(90deg, #7c3aed, #a855f7)",
                              transition: "width 0.3s ease",
                            }}
                          />
                        </div>
                      </div>

                      {/* Question Card */}
                      {activeQuiz.questions[currentQIndex] && (
                        <div>
                          <h3 style={{ fontSize: "17px", fontWeight: "700", color: "#1e293b", lineHeight: 1.5, marginBottom: "20px" }}>
                            {activeQuiz.questions[currentQIndex].question}
                          </h3>

                          {/* Options */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
                            {activeQuiz.questions[currentQIndex].options.map((opt, optIdx) => {
                              const isSelected = selectedAnswers[currentQIndex] === optIdx;
                              return (
                                <button
                                  key={optIdx}
                                  type="button"
                                  onClick={() => handleSelectOption(optIdx)}
                                  style={{
                                    textAlign: "left",
                                    padding: "14px 18px",
                                    borderRadius: "12px",
                                    border: isSelected ? "2px solid #7c3aed" : "1.5px solid #e2e8f0",
                                    background: isSelected ? "#f5f3ff" : "#ffffff",
                                    color: isSelected ? "#5b21b6" : "#334155",
                                    fontWeight: isSelected ? "700" : "500",
                                    fontSize: "14px",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "12px",
                                    transition: "all 0.15s ease",
                                  }}
                                >
                                  <span
                                    style={{
                                      width: "28px",
                                      height: "28px",
                                      borderRadius: "50%",
                                      background: isSelected ? "#7c3aed" : "#f1f5f9",
                                      color: isSelected ? "#ffffff" : "#64748b",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontWeight: "800",
                                      fontSize: "12px",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {String.fromCharCode(65 + optIdx)}
                                  </span>
                                  <span>{opt}</span>
                                </button>
                              );
                            })}
                          </div>

                          {/* Navigation Buttons */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "16px", borderTop: "1px solid #f1f5f9" }}>
                            <button
                              type="button"
                              onClick={() => setCurrentQIndex((prev) => Math.max(0, prev - 1))}
                              disabled={currentQIndex === 0}
                              style={{
                                padding: "10px 18px",
                                background: "#f1f5f9",
                                color: currentQIndex === 0 ? "#cbd5e1" : "#475569",
                                border: "none",
                                borderRadius: "10px",
                                fontWeight: "700",
                                fontSize: "13px",
                                cursor: currentQIndex === 0 ? "default" : "pointer",
                              }}
                            >
                              ← Previous
                            </button>

                            {currentQIndex < activeQuiz.questions.length - 1 ? (
                              <button
                                type="button"
                                onClick={() => setCurrentQIndex((prev) => prev + 1)}
                                style={{
                                  padding: "10px 22px",
                                  background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                                  color: "#ffffff",
                                  border: "none",
                                  borderRadius: "10px",
                                  fontWeight: "700",
                                  fontSize: "13px",
                                  cursor: "pointer",
                                  boxShadow: "0 4px 12px rgba(124, 58, 237, 0.25)",
                                }}
                              >
                                Next Question →
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={handleFinalSubmit}
                                style={{
                                  padding: "10px 24px",
                                  background: "linear-gradient(135deg, #10b981, #059669)",
                                  color: "#ffffff",
                                  border: "none",
                                  borderRadius: "10px",
                                  fontWeight: "800",
                                  fontSize: "14px",
                                  cursor: "pointer",
                                  boxShadow: "0 4px 14px rgba(16, 185, 129, 0.3)",
                                }}
                              >
                                ✓ Submit Quiz
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* ================= RESULT SCREEN ================= */
                    <div style={{ textAlign: "center", padding: "10px 0" }}>
                      <div
                        style={{
                          width: "80px",
                          height: "80px",
                          borderRadius: "50%",
                          background: quizResult.passed ? "#dcfce7" : "#fee2e2",
                          color: quizResult.passed ? "#16a34a" : "#dc2626",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "36px",
                          margin: "0 auto 16px auto",
                        }}
                      >
                        {quizResult.passed ? "🏆" : "⚠️"}
                      </div>

                      <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1e293b", margin: "0 0 6px 0" }}>
                        {quizResult.passed ? "Quiz Completed Successfully!" : "Quiz Completed - Keep Practicing!"}
                      </h2>
                      <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 20px 0" }}>
                        Your results have been securely recorded and synced to your instructor.
                      </p>

                      <div
                        style={{
                          display: "inline-flex",
                          gap: "24px",
                          background: "#f8fafc",
                          padding: "16px 28px",
                          borderRadius: "16px",
                          border: "1px solid #e2e8f0",
                          marginBottom: "28px",
                        }}
                      >
                        <div>
                          <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
                            Your Score
                          </span>
                          <div style={{ fontSize: "22px", fontWeight: "800", color: "#7c3aed" }}>
                            {quizResult.score} / {quizResult.totalQuestions}
                          </div>
                        </div>
                        <div style={{ width: "1px", background: "#e2e8f0" }} />
                        <div>
                          <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
                            Accuracy
                          </span>
                          <div style={{ fontSize: "22px", fontWeight: "800", color: quizResult.passed ? "#16a34a" : "#ea580c" }}>
                            {quizResult.percentage}%
                          </div>
                        </div>
                        <div style={{ width: "1px", background: "#e2e8f0" }} />
                        <div>
                          <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
                            Pass Status
                          </span>
                          <div style={{ fontSize: "15px", fontWeight: "800", marginTop: "4px", color: quizResult.passed ? "#16a34a" : "#dc2626" }}>
                            {quizResult.passed ? "PASSED" : "NEEDS WORK"}
                          </div>
                        </div>
                      </div>

                      {/* Detailed Question Review */}
                      <div style={{ textAlign: "left", marginBottom: "24px" }}>
                        <h4 style={{ fontSize: "15px", fontWeight: "800", color: "#334155", marginBottom: "12px" }}>
                          Review Answers & Explanations:
                        </h4>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {quizResult.answers.map((ans, idx) => (
                            <div
                              key={idx}
                              style={{
                                padding: "12px 16px",
                                borderRadius: "12px",
                                background: ans.isCorrect ? "#f0fdf4" : "#fef2f2",
                                border: "1px solid",
                                borderColor: ans.isCorrect ? "#bbf7d0" : "#fecaca",
                                fontSize: "13px",
                              }}
                            >
                              <div style={{ fontWeight: "700", color: ans.isCorrect ? "#166534" : "#991b1b" }}>
                                {ans.isCorrect ? "✓" : "✗"} Q{idx + 1}: {ans.question}
                              </div>
                              {ans.explanation && (
                                <div style={{ fontSize: "12px", color: "#475569", marginTop: "4px", fontStyle: "italic" }}>
                                  💡 {ans.explanation}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveQuiz(null)}
                        style={{
                          padding: "12px 28px",
                          background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "12px",
                          fontWeight: "800",
                          fontSize: "14px",
                          cursor: "pointer",
                        }}
                      >
                        ← Back to Quizzes
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ================= PAGE HEADER & STATS ================= */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span style={{ fontSize: "24px" }}>🎯</span>
              <h1 style={{ fontSize: "28px", fontWeight: "900", color: "#0f172a", margin: 0 }}>
                Assigned Class Quizzes
              </h1>
            </div>
            <p style={{ color: "#64748b", fontSize: "15px", margin: 0 }}>
              Solve quizzes uploaded and conducted by your instructor. Test your mastery and track results.
            </p>
          </div>

          <Link
            to="/student/dashboard"
            style={{
              padding: "10px 18px",
              background: "#ffffff",
              color: "#6d28d9",
              border: "1px solid #ddd6fe",
              borderRadius: "12px",
              fontSize: "13px",
              fontWeight: "700",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            ← Back to Dashboard
          </Link>
        </div>

        {/* 4 Quick Stat Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "32px" }}>
          <div style={{ background: "#ffffff", borderRadius: "18px", padding: "20px", border: "1px solid #f1f5f9", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
              TOTAL ASSIGNED
            </span>
            <div style={{ fontSize: "28px", fontWeight: "900", color: "#1e293b", marginTop: "4px" }}>
              {totalQuizzes}
            </div>
          </div>

          <div style={{ background: "#ffffff", borderRadius: "18px", padding: "20px", border: "1px solid #f1f5f9", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#16a34a", textTransform: "uppercase" }}>
              COMPLETED
            </span>
            <div style={{ fontSize: "28px", fontWeight: "900", color: "#16a34a", marginTop: "4px" }}>
              {completedCount}
            </div>
          </div>

          <div style={{ background: "#ffffff", borderRadius: "18px", padding: "20px", border: "1px solid #f1f5f9", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#ea580c", textTransform: "uppercase" }}>
              PENDING
            </span>
            <div style={{ fontSize: "28px", fontWeight: "900", color: "#ea580c", marginTop: "4px" }}>
              {pendingCount}
            </div>
          </div>

          <div style={{ background: "#ffffff", borderRadius: "18px", padding: "20px", border: "1px solid #f1f5f9", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#7c3aed", textTransform: "uppercase" }}>
              AVERAGE SCORE
            </span>
            <div style={{ fontSize: "28px", fontWeight: "900", color: "#7c3aed", marginTop: "4px" }}>
              {completedCount > 0 ? `${avgScore}%` : "—"}
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div
          style={{
            background: "#ffffff",
            padding: "16px 20px",
            borderRadius: "16px",
            border: "1px solid #f1f5f9",
            marginBottom: "24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          <div style={{ display: "flex", gap: "8px" }}>
            {[
              { id: "all", label: `All Quizzes (${totalQuizzes})` },
              { id: "pending", label: `Pending (${pendingCount})` },
              { id: "completed", label: `Completed (${completedCount})` },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilter(t.id)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "10px",
                  border: "none",
                  background: filter === t.id ? "linear-gradient(135deg, #7c3aed, #6d28d9)" : "#f1f5f9",
                  color: filter === t.id ? "#ffffff" : "#475569",
                  fontWeight: "700",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="Search quizzes by title or subject..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "10px 16px",
              borderRadius: "10px",
              border: "1.5px solid #e2e8f0",
              fontSize: "13px",
              width: "280px",
            }}
          />
        </div>

        {/* ================= QUIZ CARDS GRID ================= */}
        {filteredQuizzes.length === 0 ? (
          <div
            style={{
              background: "#ffffff",
              borderRadius: "20px",
              padding: "48px 20px",
              textAlign: "center",
              border: "1px solid #f1f5f9",
            }}
          >
            <span style={{ fontSize: "40px", display: "block", marginBottom: "12px" }}>🎯</span>
            <h3 style={{ fontSize: "18px", fontWeight: "800", color: "#1e293b", margin: "0 0 6px 0" }}>
              No Quizzes Found
            </h3>
            <p style={{ color: "#64748b", fontSize: "14px" }}>
              {filter === "completed"
                ? "You haven't completed any quizzes yet. Switch to 'Pending' to start solving."
                : "No quizzes match your search criteria or none have been assigned by your teacher yet."}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "20px" }}>
            {filteredQuizzes.map((q) => {
              const attempt = getStudentQuizAttempt(q.id, studentKey);
              const isCompleted = Boolean(attempt);

              return (
                <div
                  key={q.id}
                  style={{
                    background: "#ffffff",
                    borderRadius: "20px",
                    padding: "24px",
                    border: "1px solid",
                    borderColor: isCompleted ? "#dcfce7" : "#ede9fe",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.03)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    {/* Tags */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: "800",
                          textTransform: "uppercase",
                          padding: "4px 10px",
                          borderRadius: "8px",
                          background: "#f3e8ff",
                          color: "#6d28d9",
                        }}
                      >
                        {q.subject || "General"}
                      </span>

                      {isCompleted ? (
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: "800",
                            background: "#dcfce7",
                            color: "#15803d",
                            padding: "4px 10px",
                            borderRadius: "8px",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          ✓ Completed ({attempt.percentage}%)
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: "700",
                            background: "#ffedd5",
                            color: "#c2410c",
                            padding: "4px 10px",
                            borderRadius: "8px",
                          }}
                        >
                          ⏳ Pending
                        </span>
                      )}
                    </div>

                    <h3 style={{ fontSize: "17px", fontWeight: "800", color: "#0f172a", margin: "0 0 10px 0", lineHeight: 1.4 }}>
                      {q.title}
                    </h3>

                    {/* Metadata Grid */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "8px",
                        background: "#f8fafc",
                        padding: "12px 14px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        color: "#475569",
                        marginBottom: "16px",
                      }}
                    >
                      <div>
                        <strong>Questions:</strong> {q.questions?.length || q.questionCount || 5}
                      </div>
                      <div>
                        <strong>Time Limit:</strong> {q.timeLimit ? `${q.timeLimit} Mins` : "Untimed"}
                      </div>
                      <div>
                        <strong>Pass Score:</strong> {q.passingScore || 60}%
                      </div>
                      <div>
                        <strong>Difficulty:</strong> {q.difficulty || "Medium"}
                      </div>
                    </div>

                    {isCompleted && (
                      <div
                        style={{
                          padding: "10px 14px",
                          background: attempt.percentage >= (q.passingScore || 60) ? "#f0fdf4" : "#fef2f2",
                          border: "1px solid",
                          borderColor: attempt.percentage >= (q.passingScore || 60) ? "#bbf7d0" : "#fecaca",
                          borderRadius: "10px",
                          fontSize: "12px",
                          marginBottom: "16px",
                        }}
                      >
                        <strong>Your Score:</strong> {attempt.score} / {attempt.totalQuestions || q.questions?.length} ({attempt.percentage}%) • {attempt.completedAt || "Completed"}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div>
                    <button
                      type="button"
                      onClick={() => handleStartQuiz(q)}
                      style={{
                        width: "100%",
                        padding: "12px",
                        borderRadius: "12px",
                        border: "none",
                        background: isCompleted
                          ? "#f1f5f9"
                          : "linear-gradient(135deg, #7c3aed, #6d28d9)",
                        color: isCompleted ? "#475569" : "#ffffff",
                        fontWeight: "800",
                        fontSize: "14px",
                        cursor: "pointer",
                        boxShadow: isCompleted ? "none" : "0 4px 14px rgba(124, 58, 237, 0.25)",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {isCompleted ? "🔄 Retake / Review Quiz" : "▶ Start Quiz"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default StudentQuizzes;
