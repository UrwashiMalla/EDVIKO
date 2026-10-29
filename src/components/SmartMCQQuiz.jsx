import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { aiApi, quizApi, documentApi } from "../services/api";
import { useToast } from "../context/useToast";
import "./SmartMCQQuiz.css";

function SmartMCQQuiz({ onBack, language = "English", onLanguageChange, text = "", documentId = null, initialQuiz = null }) {
  const { showToast } = useToast();
  const { id: paramId } = useParams();
  const navigate = useNavigate();
  const effectiveDocId = documentId || paramId;

  const [studyText, setStudyText] = useState(text);
  const [quiz, setQuiz] = useState(initialQuiz?.questions || []);
  const [quizId, setQuizId] = useState(initialQuiz?.id || initialQuiz?._id || null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [score, setScore] = useState(0);

  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [attemptSaved, setAttemptSaved] = useState(false);
  const [error, setError] = useState("");

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(effectiveDocId ? `/student/documents/${effectiveDocId}` : "/student/documents");
    }
  };

  // Preload quiz when docId or language changes
  useEffect(() => {
    let ignore = false;
    if (effectiveDocId) {
      setLoading(true);
      setLoadingMessage(`Checking Smart MCQ Quiz in ${language}...`);
      setError("");
      // Reset state for new language
      setStarted(false);
      setFinished(false);
      setQuiz([]);
      setQuizId(null);

      documentApi.getById(effectiveDocId, language)
        .then((res) => {
          if (!ignore && res.document) {
            setStudyText(res.document.extractedText || "");
            if (res.quiz?.questions?.length > 0) {
              setQuiz(res.quiz.questions);
              setQuizId(res.quiz.id || res.quiz._id);
              showToast(`✓ Smart MCQ Quiz ready in ${language}`, "success");
            } else {
              setQuiz([]);
              setQuizId(null);
            }
          }
        })
        .catch((err) => {
          if (!ignore) {
            console.warn("Could not preload document for quiz:", err);
          }
        })
        .finally(() => {
          if (!ignore) setLoading(false);
        });

      return () => {
        ignore = true;
      };
    }
  }, [effectiveDocId, language, showToast]);

  // ==========================================
  // GENERATE / REGENERATE QUIZ
  // ==========================================
  const generateQuiz = useCallback(async (force = false) => {
    if (!studyText && !effectiveDocId) {
      setError("Please provide study material first.");
      showToast("Please provide study material first.", "warning");
      return;
    }

    setLoading(true);
    setLoadingMessage(force ? "Regenerating 10 fresh MCQs with Groq AI..." : `Generating 10 Smart MCQs in ${language}...`);
    setError("");

    try {
      const data = await aiApi.getQuiz({
        documentId: effectiveDocId,
        text: studyText,
        language,
        forceRegenerate: force,
      });

      if (!data.success) {
        throw new Error(data.message || "Failed to generate quiz.");
      }

      setQuiz(data.quiz);
      setQuizId(data.quizId);

      setCurrentQuestion(0);
      setSelectedAnswer(null);
      setAnswers([]);
      setScore(0);
      setFinished(false);
      setAttemptSaved(false);
      setStarted(true);
      showToast(force ? "✓ 10 new MCQs regenerated successfully" : `✓ 10 Smart MCQs generated in ${language}`, "success");
    } catch (err) {
      console.error("Quiz Generation Error:", err);
      const errMsg = err.message || "Unable to generate quiz. Please check backend connection.";
      setError(errMsg);
      showToast(errMsg, "error");
    } finally {
      setLoading(false);
    }
  }, [effectiveDocId, language, studyText, showToast]);

  // ==========================================
  // SELECT ANSWER
  // ==========================================
  const selectAnswer = (index) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(index);
  };

  const saveQuizAttempt = useCallback(async (evaluatedAnswers) => {
    if (!quizId) return;

    setSubmitting(true);
    try {
      await quizApi.submitAttempt(quizId, {
        answers: evaluatedAnswers,
      });
      setAttemptSaved(true);
      showToast("✓ Quiz attempt recorded successfully", "success");
    } catch (err) {
      console.warn("Failed to persist quiz attempt:", err.message);
      showToast("⚠️ Attempt calculated, saving to profile...", "info");
    } finally {
      setSubmitting(false);
    }
  }, [quizId, showToast]);

  // ==========================================
  // NEXT QUESTION & SUBMIT ATTEMPT
  // ==========================================
  const nextQuestion = async () => {
    if (selectedAnswer === null) return;

    const currentQ = quiz[currentQuestion];
    const isCorrect = selectedAnswer === currentQ.correctAnswer;

    const updatedAnswers = [
      ...answers,
      {
        questionIndex: currentQuestion,
        selectedAnswer: selectedAnswer,
        correctAnswer: currentQ.correctAnswer,
        isCorrect: isCorrect,
      },
    ];

    setAnswers(updatedAnswers);

    if (isCorrect) {
      setScore((prev) => prev + 1);
    }

    if (currentQuestion < quiz.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
      setSelectedAnswer(null);
    } else {
      // Quiz Finished - Save to MongoDB
      setFinished(true);
      await saveQuizAttempt(updatedAnswers);
    }
  };

  // ==========================================
  // RESTART QUIZ
  // ==========================================
  const restartQuiz = () => {
    setStarted(false);
    setFinished(false);
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setAnswers([]);
    setScore(0);
    setAttemptSaved(false);
    setError("");
  };

  const handleLanguageSelect = (newLang) => {
    if (newLang === language) return;
    showToast(`Switching language to ${newLang}...`, "info", 2000);
    if (onLanguageChange) {
      onLanguageChange(newLang);
    }
  };

  // ==========================================
  // START SCREEN
  // ==========================================
  if (!started) {
    return (
      <div className="quiz-page">
        <div className="quiz-header">
          <button className="quiz-back-btn" onClick={handleBack} disabled={loading}>
            ← Back
          </button>

          <div className="quiz-header-title">
            <span className="quiz-header-icon">🧠</span>
            <div>
              <h1>Smart MCQ Quiz</h1>
              <p>Test your understanding with Groq AI</p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <select
              value={language}
              onChange={(e) => handleLanguageSelect(e.target.value)}
              disabled={loading}
              style={{
                padding: "6px 12px",
                borderRadius: "10px",
                border: "1px solid #d8b4fe",
                background: "#fff",
                color: "#6b21a8",
                fontSize: "13px",
                fontWeight: "600",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              <option value="English">🇬🇧 English</option>
              <option value="Hindi">🇮🇳 Hindi</option>
              <option value="Marathi">🇮🇳 Marathi</option>
              <option value="Hinglish">💬 Hinglish</option>
            </select>
          </div>
        </div>

        <motion.div
          className="quiz-start-card"
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="quiz-start-icon">🧠</div>

          <h2>Ready to test your knowledge?</h2>
          <p>
            EDVIKO will generate 10 multiple-choice questions based strictly on your uploaded document, calculate your score, and record your performance.
          </p>

          <div className="quiz-info-grid">
            <div>
              <span>📚</span>
              <strong>10 Questions</strong>
            </div>

            <div>
              <span>🎯</span>
              <strong>Instant Feedback</strong>
            </div>

            <div>
              <span>🤖</span>
              <strong>Groq AI ({language})</strong>
            </div>
          </div>

          {loading && (
            <div style={{ margin: "20px 0", padding: "16px", background: "#f5f3ff", borderRadius: "12px", border: "1px solid #ddd6fe" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", color: "#6b21a8", fontWeight: "600" }}>
                <span style={{ animation: "spin 2s linear infinite" }}>🤖</span>
                <span>{loadingMessage || "Generating quiz questions..."}</span>
              </div>
            </div>
          )}

          {error && !loading && <div className="quiz-error">⚠️ {error}</div>}

          {quiz.length > 0 ? (
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap", marginTop: "16px" }}>
              <button
                className="start-quiz-btn"
                onClick={() => setStarted(true)}
                disabled={loading}
                style={{ opacity: loading ? 0.75 : 1, cursor: loading ? "not-allowed" : "pointer" }}
              >
                🧠 Start Smart Quiz ({quiz.length} MCQs)
              </button>
              <button
                className="start-quiz-btn"
                onClick={() => generateQuiz(true)}
                disabled={loading}
                style={{ background: "#4f46e5", opacity: loading ? 0.75 : 1, cursor: loading ? "not-allowed" : "pointer" }}
              >
                {loading ? "⏳ Generating..." : "🔄 Regenerate New 10 MCQs"}
              </button>
            </div>
          ) : (
            <button
              className="start-quiz-btn"
              onClick={() => generateQuiz(false)}
              disabled={loading}
              style={{ opacity: loading ? 0.75 : 1, cursor: loading ? "not-allowed" : "pointer" }}
            >
              {loading ? "⏳ Creating Quiz..." : `🧠 Generate Smart Quiz (10 MCQs in ${language})`}
            </button>
          )}
        </motion.div>
      </div>
    );
  }

  // ==========================================
  // RESULT SCREEN
  // ==========================================
  if (finished) {
    const totalQ = quiz.length || 10;
    const percentage = Math.round((score / totalQ) * 100);

    return (
      <div className="quiz-page">
        <div className="quiz-header">
          <button className="quiz-back-btn" onClick={handleBack} disabled={loading}>
            ← Exit
          </button>

          <div className="quiz-header-title">
            <span className="quiz-header-icon">🏆</span>
            <div>
              <h1>Quiz Completed</h1>
              <p>Your performance has been recorded</p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <select
              value={language}
              onChange={(e) => handleLanguageSelect(e.target.value)}
              disabled={loading}
              style={{
                padding: "6px 12px",
                borderRadius: "10px",
                border: "1px solid #d8b4fe",
                background: "#fff",
                color: "#6b21a8",
                fontSize: "13px",
                fontWeight: "600",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              <option value="English">🇬🇧 English</option>
              <option value="Hindi">🇮🇳 Hindi</option>
              <option value="Marathi">🇮🇳 Marathi</option>
              <option value="Hinglish">💬 Hinglish</option>
            </select>
          </div>
        </div>

        <motion.div
          className="quiz-result-card"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="result-icon">
            {percentage >= 70 ? "🏆" : percentage >= 40 ? "👍" : "📖"}
          </div>

          <span className="result-label">YOUR SCORE</span>

          <h2>
            {score} / {totalQ}
          </h2>

          <div className="result-percentage">{percentage}%</div>

          <p>
            {percentage >= 70
              ? "Outstanding performance! You have thoroughly mastered these concepts."
              : percentage >= 40
              ? "Good attempt! Review the notes and try the questions again to strengthen weak areas."
              : "Keep practicing! Review your study summary and attempt this quiz again."}
          </p>

          <div style={{ margin: "16px 0", fontSize: "14px", color: "#059669", fontWeight: 600 }}>
            {submitting ? "⏳ Saving attempt to database..." : attemptSaved ? "✅ Attempt recorded in database & student profile" : "Quiz attempt calculated"}
          </div>

          <div className="result-actions">
            <button className="retry-quiz-btn" onClick={restartQuiz} disabled={loading}>
              🔄 Try Again
            </button>

            <button
              className="retry-quiz-btn"
              onClick={() => generateQuiz(true)}
              disabled={loading}
              style={{ background: "#4f46e5", color: "#fff", opacity: loading ? 0.75 : 1 }}
            >
              {loading ? "⏳ Generating..." : "✨ Generate New Quiz"}
            </button>

            <button className="result-back-btn" onClick={handleBack}>
              ← Back to Toolkit
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ==========================================
  // QUIZ QUESTION SCREEN
  // ==========================================
  const currentQ = quiz[currentQuestion];
  const progress = ((currentQuestion + 1) / quiz.length) * 100;

  return (
    <div className="quiz-page">
      <div className="quiz-header">
        <button className="quiz-back-btn" onClick={handleBack}>
          ← Exit
        </button>

        <div className="quiz-header-title">
          <span className="quiz-header-icon">🧠</span>
          <div>
            <h1>Smart MCQ Quiz</h1>
            <p>
              Question {currentQuestion + 1} of {quiz.length}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <select
            value={language}
            onChange={(e) => handleLanguageSelect(e.target.value)}
            disabled={loading}
            style={{
              padding: "6px 12px",
              borderRadius: "10px",
              border: "1px solid #d8b4fe",
              background: "#fff",
              color: "#6b21a8",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            <option value="English">🇬🇧 English</option>
            <option value="Hindi">🇮🇳 Hindi</option>
            <option value="Marathi">🇮🇳 Marathi</option>
            <option value="Hinglish">💬 Hinglish</option>
          </select>
        </div>
      </div>

      {/* Progress */}
      <div className="quiz-progress-container">
        <div className="quiz-progress-info">
          <span>
            Question {currentQuestion + 1} / {quiz.length}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>

        <div className="quiz-progress-bar">
          <div
            className="quiz-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      {currentQ && (
        <motion.div
          key={currentQuestion}
          className="quiz-card"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="quiz-question-header">
            <span className="question-tag">QUESTION {currentQuestion + 1}</span>
            <span className="question-lang-tag">{language}</span>
          </div>

          <h2 className="quiz-question-text">{currentQ.question}</h2>

          <div className="quiz-options-list">
            {currentQ.options?.map((option, index) => {
              let optionClass = "quiz-option";

              if (selectedAnswer !== null) {
                if (index === currentQ.correctAnswer) {
                  optionClass += " correct";
                } else if (index === selectedAnswer) {
                  optionClass += " incorrect";
                } else {
                  optionClass += " disabled";
                }
              }

              return (
                <button
                  key={index}
                  className={optionClass}
                  onClick={() => selectAnswer(index)}
                  disabled={selectedAnswer !== null}
                >
                  <span className="option-letter">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="option-text">{option}</span>
                </button>
              );
            })}
          </div>

          {/* Explanation if answered */}
          {selectedAnswer !== null && (
            <motion.div
              className={`quiz-feedback ${
                selectedAnswer === currentQ.correctAnswer ? "correct" : "incorrect"
              }`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <strong>
                {selectedAnswer === currentQ.correctAnswer
                  ? "✓ Correct!"
                  : "✗ Incorrect"}
              </strong>
              <p>{currentQ.explanation}</p>

              <button className="next-question-btn" onClick={nextQuestion}>
                {currentQuestion < quiz.length - 1
                  ? "Next Question →"
                  : "Finish Quiz 🏆"}
              </button>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}

export default SmartMCQQuiz;