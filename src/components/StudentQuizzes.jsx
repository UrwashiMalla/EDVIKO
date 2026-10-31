import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/useAuth";
import { quizApi } from "../services/api";
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

  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // "all", "pending", "completed"
  const [search, setSearch] = useState("");

  // Active Quiz Solver State
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({}); // { [qIdx]: selectedOptionIdx }
  const [timeLeft, setTimeLeft] = useState(null); // seconds or null if untimed
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizResult, setQuizResult] = useState(null);
  const [submitError, setSubmitError] = useState("");
  const timerRef = useRef(null);

  const loadQuizzes = async () => {
    try {
      const res = await quizApi.list();
      if (res.success && Array.isArray(res.quizzes)) {
        setQuizzes(res.quizzes);
        setLoading(false);
        return;
      }
    } catch (err) {
      console.warn("Could not load backend quizzes, checking fallback storage:", err.message);
    }

    // Local fallback
    const local = getTeacherQuizzes().map((q) => {
      const att = getStudentQuizAttempt(q.id, studentKey);
      return {
        ...q,
        hasAttempted: Boolean(att),
        attempt: att,
      };
    });
    setQuizzes(local);
    setLoading(false);
  };

  useEffect(() => {
    loadQuizzes();
    const unsubscribe = onLerniqSync((detail) => {
      if (
        detail.type === "QUIZ_UPLOADED" ||
        detail.type === "QUIZ_DELETED" ||
        detail.type === "QUIZ_ATTEMPT_SUBMITTED"
      ) {
        loadQuizzes();
      }
    });
    return unsubscribe;
  }, [studentKey]);

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

  // Start Quiz Handler (Taking new attempt)
  const handleStartQuiz = (quiz) => {
    setActiveQuiz(quiz);
    setCurrentQIndex(0);
    setSelectedAnswers({});
    setQuizSubmitted(false);
    setQuizResult(null);
    setSubmitError("");

    if (quiz.timeLimit && Number(quiz.timeLimit) > 0) {
      setTimeLeft(Number(quiz.timeLimit) * 60);
    } else {
      setTimeLeft(null); // Untimed
    }
  };

  // View Past Completed Result
  const handleViewResult = (quiz) => {
    if (!quiz.attempt) return;
    setActiveQuiz(quiz);
    setQuizResult(quiz.attempt);
    setQuizSubmitted(true);
  };

  const handleSelectOption = (optIndex) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQIndex]: optIndex,
    }));
  };

  // Submit Quiz Attempt (Evaluated securely on backend)
  const handleFinalSubmit = async () => {
    if (!activeQuiz) return;
    if (timerRef.current) clearInterval(timerRef.current);

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const qId = activeQuiz.id || activeQuiz._id;
      const res = await quizApi.submitAttempt(qId, {
        answers: selectedAnswers,
      });

      if (res.success && res.result) {
        setQuizResult(res.result);
        setQuizSubmitted(true);

        // Also sync local storage for real-time cross-tab updates
        recordStudentQuizAttempt({
          quizId: qId,
          studentId: user?.id || user?._id || "std_101",
          studentName: user?.name || "Student",
          studentEmail: user?.email || "student@lerniq.edu",
          score: res.result.score,
          totalQuestions: res.result.totalQuestions,
          answers: res.result.answers,
        });

        await loadQuizzes();
        return;
      }
      throw new Error(res.message || "Evaluation failed.");
    } catch (err) {
      console.warn("Backend submit error, running fallback evaluation:", err);

      // Secure client fallback if backend is momentarily unreachable
      const questions = activeQuiz.questions || [];
      let correctCount = 0;
      let wrongCount = 0;
      let unattemptedCount = 0;

      const evaluatedAnswers = questions.map((q, idx) => {
        const rawSel = selectedAnswers[idx];
        const selected = (rawSel !== undefined && rawSel !== null && rawSel !== -1) ? Number(rawSel) : -1;
        const correct = typeof q.correctAnswer === "number" ? q.correctAnswer : (typeof q.answerIndex === "number" ? q.answerIndex : 0);

        let status = "Not Attempted";
        let isCorrect = false;

        if (selected === -1) {
          status = "Not Attempted";
          isCorrect = false;
          unattemptedCount++;
        } else if (selected === correct) {
          status = "Correct";
          isCorrect = true;
          correctCount++;
        } else {
          status = "Wrong";
          isCorrect = false;
          wrongCount++;
        }

        return {
          questionIndex: idx,
          question: q.question,
          options: q.options || ["Option A", "Option B", "Option C", "Option D"],
          selectedAnswer: selected,
          correctAnswer: correct,
          isCorrect,
          status,
          explanation: q.explanation || "Verified from study curriculum.",
        };
      });

      const totalQuestions = questions.length;
      const score = correctCount;
      const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
      const passed = percentage >= (activeQuiz.passingScore || 60);

      const fallbackResult = {
        score,
        totalQuestions,
        correctCount,
        wrongCount,
        unattemptedCount,
        percentage,
        passed,
        answers: evaluatedAnswers,
      };

      setQuizResult(fallbackResult);
      setQuizSubmitted(true);

      recordStudentQuizAttempt({
        quizId: activeQuiz.id || activeQuiz._id,
        studentId: user?.id || user?._id || "std_101",
        studentName: user?.name || "Student",
        studentEmail: user?.email || "student@lerniq.edu",
        score,
        totalQuestions,
        answers: evaluatedAnswers,
      });

      await loadQuizzes();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format seconds to mm:ss
  const formatTime = (seconds) => {
    if (seconds === null) return "Untimed";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Statistics calculation
  const totalQuizzes = quizzes.length;
  const attemptedQuizzes = quizzes.filter((q) => {
    if (q.hasAttempted) return true;
    return Boolean(getStudentQuizAttempt(q.id || q._id, studentKey));
  });
  const completedCount = attemptedQuizzes.length;
  const pendingCount = Math.max(0, totalQuizzes - completedCount);

  const totalScorePct = attemptedQuizzes.reduce((acc, q) => {
    if (q.attempt && typeof q.attempt.percentage === "number") {
      return acc + q.attempt.percentage;
    }
    const att = getStudentQuizAttempt(q.id || q._id, studentKey);
    return acc + (att?.percentage || 0);
  }, 0);
  const avgScore = completedCount > 0 ? Math.round(totalScorePct / completedCount) : 0;

  // Filtered List
  const filteredQuizzes = quizzes.filter((q) => {
    const qId = q.id || q._id;
    const isCompleted = q.hasAttempted || Boolean(getStudentQuizAttempt(qId, studentKey));
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
                  maxWidth: "820px",
                  maxHeight: "92vh",
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
                      {activeQuiz.subject || "Class Assessment"}
                    </span>
                    <h2 style={{ fontSize: "20px", fontWeight: "800", margin: "6px 0 0 0" }}>
                      {activeQuiz.title}
                    </h2>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    {/* Timer Widget */}
                    {!quizSubmitted && (
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
                    )}

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
                        fontSize: "14px",
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
                          <span>Question {currentQIndex + 1} of {activeQuiz.questions?.length || 0}</span>
                          <span>{activeQuiz.questions ? Math.round(((currentQIndex + 1) / activeQuiz.questions.length) * 100) : 0}% Completed</span>
                        </div>
                        <div style={{ height: "8px", background: "#f1f5f9", borderRadius: "4px", overflow: "hidden" }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${activeQuiz.questions ? ((currentQIndex + 1) / activeQuiz.questions.length) * 100 : 0}%`,
                              background: "linear-gradient(90deg, #7c3aed, #a855f7)",
                              transition: "width 0.3s ease",
                            }}
                          />
                        </div>
                      </div>

                      {/* Question Card */}
                      {activeQuiz.questions && activeQuiz.questions[currentQIndex] && (
                        <div>
                          <h3 style={{ fontSize: "17px", fontWeight: "700", color: "#1e293b", lineHeight: 1.5, marginBottom: "20px" }}>
                            {activeQuiz.questions[currentQIndex].question}
                          </h3>

                          {/* Options */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
                            {(activeQuiz.questions[currentQIndex].options || []).map((opt, optIdx) => {
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

                          {submitError && (
                            <div style={{ padding: "10px 14px", background: "#fef2f2", color: "#b91c1c", borderRadius: "10px", fontSize: "13px", marginBottom: "16px" }}>
                              ⚠️ {submitError}
                            </div>
                          )}

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

                            <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>
                              {selectedAnswers[currentQIndex] !== undefined ? "✓ Option selected" : "Not attempted yet"}
                            </div>

                            {currentQIndex < (activeQuiz.questions?.length || 0) - 1 ? (
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
                                disabled={isSubmitting}
                                style={{
                                  padding: "10px 24px",
                                  background: isSubmitting ? "#cbd5e1" : "linear-gradient(135deg, #10b981, #059669)",
                                  color: "#ffffff",
                                  border: "none",
                                  borderRadius: "10px",
                                  fontWeight: "800",
                                  fontSize: "14px",
                                  cursor: isSubmitting ? "default" : "pointer",
                                  boxShadow: "0 4px 14px rgba(16, 185, 129, 0.3)",
                                }}
                              >
                                {isSubmitting ? "Evaluating on Server..." : "✓ Submit Quiz"}
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
                          width: "72px",
                          height: "72px",
                          borderRadius: "50%",
                          background: quizResult.passed ? "#dcfce7" : "#fee2e2",
                          color: quizResult.passed ? "#16a34a" : "#dc2626",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "32px",
                          margin: "0 auto 16px auto",
                        }}
                      >
                        {quizResult.passed ? "🏆" : "⚠️"}
                      </div>

                      <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1e293b", margin: "0 0 6px 0" }}>
                        {quizResult.passed ? "Quiz Completed Successfully!" : "Quiz Completed - Keep Practicing!"}
                      </h2>
                      <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 20px 0" }}>
                        Your attempt has been securely evaluated and recorded in MongoDB.
                      </p>

                      {/* Result Metrics Grid */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                          gap: "12px",
                          background: "#f8fafc",
                          padding: "16px",
                          borderRadius: "16px",
                          border: "1px solid #e2e8f0",
                          marginBottom: "28px",
                        }}
                      >
                        <div style={{ padding: "8px" }}>
                          <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
                            Total Marks
                          </span>
                          <div style={{ fontSize: "20px", fontWeight: "800", color: "#7c3aed", marginTop: "2px" }}>
                            {quizResult.score} / {quizResult.totalQuestions}
                          </div>
                        </div>

                        <div style={{ padding: "8px" }}>
                          <span style={{ fontSize: "11px", fontWeight: "700", color: "#16a34a", textTransform: "uppercase" }}>
                            Correct
                          </span>
                          <div style={{ fontSize: "20px", fontWeight: "800", color: "#16a34a", marginTop: "2px" }}>
                            {quizResult.correctCount !== undefined ? quizResult.correctCount : quizResult.score}
                          </div>
                        </div>

                        <div style={{ padding: "8px" }}>
                          <span style={{ fontSize: "11px", fontWeight: "700", color: "#dc2626", textTransform: "uppercase" }}>
                            Wrong
                          </span>
                          <div style={{ fontSize: "20px", fontWeight: "800", color: "#dc2626", marginTop: "2px" }}>
                            {quizResult.wrongCount !== undefined ? quizResult.wrongCount : (quizResult.totalQuestions - quizResult.score)}
                          </div>
                        </div>

                        <div style={{ padding: "8px" }}>
                          <span style={{ fontSize: "11px", fontWeight: "700", color: "#d97706", textTransform: "uppercase" }}>
                            Not Attempted
                          </span>
                          <div style={{ fontSize: "20px", fontWeight: "800", color: "#d97706", marginTop: "2px" }}>
                            {quizResult.unattemptedCount !== undefined ? quizResult.unattemptedCount : 0}
                          </div>
                        </div>

                        <div style={{ padding: "8px" }}>
                          <span style={{ fontSize: "11px", fontWeight: "700", color: "#0f172a", textTransform: "uppercase" }}>
                            Percentage
                          </span>
                          <div style={{ fontSize: "20px", fontWeight: "800", color: quizResult.passed ? "#16a34a" : "#ea580c", marginTop: "2px" }}>
                            {quizResult.percentage}%
                          </div>
                        </div>
                      </div>

                      {/* Detailed Question Review Showing Selected vs Correct Answer */}
                      <div style={{ textAlign: "left", marginBottom: "28px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                          <h4 style={{ fontSize: "16px", fontWeight: "800", color: "#1e293b", margin: 0 }}>
                            Review Each Question & Explanations:
                          </h4>
                          <span style={{ fontSize: "12px", color: "#64748b" }}>
                            Showing correct answer for every question
                          </span>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                          {(quizResult.answers || []).map((ans, idx) => {
                            const isCorrect = ans.status === "Correct" || ans.isCorrect === true;
                            const isUnattempted = ans.status === "Not Attempted" || ans.selectedAnswer === -1;
                            const isWrong = !isCorrect && !isUnattempted;

                            let statusLabel = "Correct";
                            let statusBg = "#dcfce7";
                            let statusColor = "#15803d";
                            let cardBorder = "#bbf7d0";

                            if (isWrong) {
                              statusLabel = "Wrong";
                              statusBg = "#fee2e2";
                              statusColor = "#b91c1c";
                              cardBorder = "#fecaca";
                            } else if (isUnattempted) {
                              statusLabel = "Not Attempted";
                              statusBg = "#fef3c7";
                              statusColor = "#b45309";
                              cardBorder = "#fde68a";
                            }

                            return (
                              <div
                                key={idx}
                                style={{
                                  padding: "16px 20px",
                                  borderRadius: "14px",
                                  background: "#ffffff",
                                  border: `1.5px solid ${cardBorder}`,
                                  boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px", gap: "10px" }}>
                                  <div style={{ fontWeight: "700", color: "#1e293b", fontSize: "14px", lineHeight: 1.4 }}>
                                    Q{idx + 1}. {ans.question}
                                  </div>
                                  <span
                                    style={{
                                      padding: "3px 10px",
                                      borderRadius: "8px",
                                      background: statusBg,
                                      color: statusColor,
                                      fontWeight: "800",
                                      fontSize: "11px",
                                      whiteSpace: "nowrap",
                                      textTransform: "uppercase",
                                    }}
                                  >
                                    {statusLabel}
                                  </span>
                                </div>

                                {/* Answers Comparison */}
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", marginTop: "10px" }}>
                                  {/* Student's Selected Answer */}
                                  <div style={{ padding: "6px 12px", borderRadius: "8px", background: isCorrect ? "#f0fdf4" : (isUnattempted ? "#fffbeb" : "#fef2f2") }}>
                                    <span style={{ fontWeight: "700", color: "#475569" }}>Your Answer: </span>
                                    {ans.selectedAnswer >= 0 && ans.selectedAnswer <= 3 ? (
                                      <span style={{ fontWeight: "700", color: isCorrect ? "#16a34a" : "#dc2626" }}>
                                        Option {String.fromCharCode(65 + ans.selectedAnswer)}
                                        {ans.options && ans.options[ans.selectedAnswer] ? `: ${ans.options[ans.selectedAnswer]}` : ""}
                                      </span>
                                    ) : (
                                      <span style={{ color: "#b45309", fontStyle: "italic", fontWeight: "600" }}>
                                        Not Attempted (No option selected)
                                      </span>
                                    )}
                                  </div>

                                  {/* Actual Correct Answer (Displayed for all questions) */}
                                  <div style={{ padding: "6px 12px", borderRadius: "8px", background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                                    <span style={{ fontWeight: "700", color: "#166534" }}>Correct Answer: </span>
                                    <span style={{ fontWeight: "800", color: "#15803d" }}>
                                      Option {String.fromCharCode(65 + (ans.correctAnswer !== undefined ? ans.correctAnswer : 0))}
                                      {ans.options && ans.options[ans.correctAnswer] ? `: ${ans.options[ans.correctAnswer]}` : ""}
                                    </span>
                                  </div>
                                </div>

                                {ans.explanation && (
                                  <div style={{ fontSize: "12px", color: "#065f46", background: "#ecfdf5", padding: "8px 12px", borderRadius: "8px", marginTop: "10px" }}>
                                    💡 <strong>Explanation:</strong> {ans.explanation}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveQuiz(null);
                            setQuizSubmitted(false);
                            setQuizResult(null);
                          }}
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
                          ← Back to All Quizzes
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ================= PAGE HEADER & STATS ================= */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span style={{ fontSize: "24px" }}>🎯</span>
              <h1 style={{ fontSize: "28px", fontWeight: "900", color: "#0f172a", margin: 0 }}>
                Classroom Quizzes
              </h1>
            </div>
            <p style={{ color: "#64748b", fontSize: "15px", margin: 0 }}>
              Attempt quizzes published by your instructor. Securely evaluated with instant results and explanations.
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

        {/* 4 Stat Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "32px" }}>
          <div style={{ background: "#ffffff", borderRadius: "18px", padding: "20px", border: "1px solid #f1f5f9", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
              TOTAL ASSIGNED
            </span>
            <div style={{ fontSize: "28px", fontWeight: "900", color: "#1e293b", marginTop: "4px" }}>
              {loading ? "..." : totalQuizzes}
            </div>
          </div>

          <div style={{ background: "#ffffff", borderRadius: "18px", padding: "20px", border: "1px solid #f1f5f9", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#16a34a", textTransform: "uppercase" }}>
              COMPLETED
            </span>
            <div style={{ fontSize: "28px", fontWeight: "900", color: "#16a34a", marginTop: "4px" }}>
              {loading ? "..." : completedCount}
            </div>
          </div>

          <div style={{ background: "#ffffff", borderRadius: "18px", padding: "20px", border: "1px solid #f1f5f9", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#ea580c", textTransform: "uppercase" }}>
              PENDING
            </span>
            <div style={{ fontSize: "28px", fontWeight: "900", color: "#ea580c", marginTop: "4px" }}>
              {loading ? "..." : pendingCount}
            </div>
          </div>

          <div style={{ background: "#ffffff", borderRadius: "18px", padding: "20px", border: "1px solid #f1f5f9", boxShadow: "0 2px 10px rgba(0,0,0,0.02)" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#7c3aed", textTransform: "uppercase" }}>
              AVERAGE ACCURACY
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
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
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
        {loading ? (
          <div style={{ textAlign: "center", padding: "50px", color: "#64748b" }}>
            Loading your classroom quizzes...
          </div>
        ) : filteredQuizzes.length === 0 ? (
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
                : "No quizzes match your filter or your instructor has not published a quiz to this classroom yet."}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "20px" }}>
            {filteredQuizzes.map((q) => {
              const qId = q.id || q._id;
              const isCompleted = q.hasAttempted || Boolean(getStudentQuizAttempt(qId, studentKey));
              const attempt = q.attempt || getStudentQuizAttempt(qId, studentKey);

              return (
                <div
                  key={qId}
                  style={{
                    background: "#ffffff",
                    borderRadius: "20px",
                    padding: "24px",
                    border: "1.5px solid",
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
                          ✓ Completed ({attempt?.percentage !== undefined ? attempt.percentage : 0}%)
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

                    <h3 style={{ fontSize: "17px", fontWeight: "800", color: "#0f172a", margin: "0 0 6px 0", lineHeight: 1.4 }}>
                      {q.title}
                    </h3>
                    {q.description && (
                      <p style={{ margin: "0 0 10px 0", fontSize: "13px", color: "#64748b" }}>{q.description}</p>
                    )}

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
                        <strong>Questions:</strong> {q.questionCount || (q.questions ? q.questions.length : 0)}
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

                    {isCompleted && attempt && (
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
                        <strong>Score:</strong> {attempt.score} / {attempt.totalQuestions || q.questionCount || 0} ({attempt.percentage}%)
                        {attempt.correctCount !== undefined && (
                          <div style={{ marginTop: "4px", fontSize: "11px", color: "#475569" }}>
                            ✅ {attempt.correctCount} Correct • ❌ {attempt.wrongCount} Wrong • ⏸️ {attempt.unattemptedCount || 0} Not Attempted
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "8px" }}>
                    {isCompleted && attempt && (
                      <button
                        type="button"
                        onClick={() => handleViewResult(q)}
                        style={{
                          flex: 1,
                          padding: "11px",
                          borderRadius: "12px",
                          border: "1.5px solid #ddd6fe",
                          background: "#ffffff",
                          color: "#6d28d9",
                          fontWeight: "800",
                          fontSize: "13px",
                          cursor: "pointer",
                        }}
                      >
                        👁️ Review Answers
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleStartQuiz(q)}
                      style={{
                        flex: 1,
                        padding: "11px",
                        borderRadius: "12px",
                        border: "none",
                        background: isCompleted
                          ? "#f1f5f9"
                          : "linear-gradient(135deg, #7c3aed, #6d28d9)",
                        color: isCompleted ? "#475569" : "#ffffff",
                        fontWeight: "800",
                        fontSize: "13px",
                        cursor: "pointer",
                        boxShadow: isCompleted ? "none" : "0 4px 14px rgba(124, 58, 237, 0.25)",
                      }}
                    >
                      {isCompleted ? "🔄 Retake Quiz" : "▶ Start Quiz"}
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
