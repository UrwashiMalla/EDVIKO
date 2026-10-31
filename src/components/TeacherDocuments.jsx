import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { extractTextFromFile } from "../utils/documentExtractor";
import { quizApi } from "../services/api";
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
  notifyLerniqSync,
  onLerniqSync,
} from "../services/frontendStorage";
import { documentApi } from "../services/api";
import Navbar from "./Navbar";
import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth/mammoth.browser";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const extractFileContent = async (file) => {
  if (!file) return "";
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let completeText = "";
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(" ");
      completeText += `\n\n--- Page ${pageNumber} ---\n\n` + pageText;
    }
    return completeText.trim();
  } else if (name.endsWith(".docx") || file.type.includes("wordprocessingml")) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value.trim();
  } else {
    return await file.text();
  }
};

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
  const [quizDescription, setQuizDescription] = useState("");
  const [quizSubject, setQuizSubject] = useState("Artificial Intelligence");
  const [quizTimeLimit, setQuizTimeLimit] = useState(15);
  const [quizHasTimer, setQuizHasTimer] = useState(true);
  const [quizPassingScore, setQuizPassingScore] = useState(60);
  const [quizCreationMode, setQuizCreationMode] = useState("ai"); // "ai" or "manual"
  const [aiNotesText, setAiNotesText] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [uploadedFileSize, setUploadedFileSize] = useState("");
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [fileError, setFileError] = useState("");

  // Question Count: Dropdown options + custom manual input (1 to 30)
  const [aiQuestionCountSelect, setAiQuestionCountSelect] = useState("5");
  const [aiQuestionCount, setAiQuestionCount] = useState(5);
  const [aiDifficulty, setAiDifficulty] = useState("Medium"); // "Easy", "Medium", "Difficult"
  const [isGeneratingAiQuiz, setIsGeneratingAiQuiz] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [previewQuizModal, setPreviewQuizModal] = useState(false);

  const [questionsList, setQuestionsList] = useState([
    {
      question: "",
      options: ["", "", "", ""],
      answerIndex: 0,
      explanation: "",
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

  const fetchQuizzes = async () => {
    try {
      const res = await quizApi.list();
      if (res.success && res.quizzes) {
        setQuizzes(res.quizzes);
        return;
      }
    } catch (err) {
      console.warn("Could not fetch remote quizzes, using local fallback:", err.message);
    }
    setQuizzes(getTeacherQuizzes());
  };

  useEffect(() => {
    fetchQuizzes();
    setNotes(getUploadedNotes());
    setLectures(getUploadedLectures());

    const unsubscribe = onLerniqSync((detail) => {
      if (
        detail.type === "QUIZ_UPLOADED" ||
        detail.type === "QUIZ_DELETED" ||
        detail.type === "QUIZ_ATTEMPT_SUBMITTED"
      ) {
        fetchQuizzes();
      }
    });
    return unsubscribe;
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
        explanation: "",
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

  const handleExplanationChange = (qIdx, text) => {
    const updated = [...questionsList];
    updated[qIdx].explanation = text;
    setQuestionsList(updated);
  };

  // Document File Upload (PDF, TXT, DOC, DOCX)
  const handleNotesFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingFile(true);
    setFileError("");

    try {
      const extracted = await extractTextFromFile(file);
      if (!extracted || extracted.length < 20) {
        throw new Error("Could not extract readable text from this file. Please make sure it is not empty.");
      }
      setAiNotesText(extracted);
      setUploadedFileName(file.name);
      setUploadedFileSize(`${(file.size / 1024).toFixed(1)} KB`);
      showToast(`✓ Extracted text from "${file.name}" successfully!`);
    } catch (err) {
      console.error("Document read error:", err);
      setFileError(err.message || "Failed to read document.");
      showToast(err.message || "Failed to read document.");
    } finally {
      setIsUploadingFile(false);
    }
  };

  // Dropdown count change
  const handleDropdownCountChange = (e) => {
    const val = e.target.value;
    setAiQuestionCountSelect(val);
    if (val !== "custom") {
      setAiQuestionCount(Number(val));
    }
  };

  // Custom question count manual input
  const handleCustomCountChange = (e) => {
    const raw = e.target.value;
    if (raw === "") {
      setAiQuestionCount("");
      setAiQuestionCountSelect("custom");
      return;
    }
    const num = parseInt(raw, 10);
    setAiQuestionCount(isNaN(num) ? "" : num);
    setAiQuestionCountSelect("custom");
  };

  // AI Quiz Generation from Uploaded Document / Notes via Backend Groq API
  const handleGenerateQuizFromNotes = async () => {
    if (!aiNotesText.trim()) {
      showToast("Please upload a document (PDF, TXT, DOC, DOCX) or paste study text first.");
      return;
    }

    const count = parseInt(aiQuestionCount, 10);
    if (isNaN(count) || count < 1 || count > 30) {
      showToast("Question count must be between 1 and 30.");
      return;
    }

    setIsGeneratingAiQuiz(true);
    try {
      const res = await quizApi.generatePreview({
        text: aiNotesText.trim(),
        questionCount: count,
        difficulty: aiDifficulty,
        language: "English",
      });

      if (!res.success || !Array.isArray(res.questions) || res.questions.length === 0) {
        throw new Error(res.message || "AI failed to generate quiz questions.");
      }

      const formatted = res.questions.map((q) => ({
        question: q.question,
        options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ["A", "B", "C", "D"],
        answerIndex: typeof q.correctAnswer === "number" ? q.correctAnswer : 0,
        explanation: q.explanation || "",
      }));

      setQuestionsList(formatted);
      if (!quizTitle.trim()) {
        const docBaseName = uploadedFileName ? uploadedFileName.replace(/\.[^/.]+$/, "") : quizSubject;
        setQuizTitle(`${docBaseName} Quiz (${aiDifficulty} - ${formatted.length} Questions)`);
      }
      showToast(`✨ Generated ${formatted.length} diverse, non-repetitive ${aiDifficulty} questions!`);
    } catch (err) {
      console.error("AI Generation Error:", err);
      showToast("Failed to generate AI quiz: " + (err.message || "Check API connection."));
    } finally {
      setIsGeneratingAiQuiz(false);
    }
  };

  const handleNoteFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setNoteFileName(file.name);
    if (!noteTitle.trim()) {
      setNoteTitle(file.name.replace(/\.[^/.]+$/, ""));
    }
    showToast(`Extracting text from "${file.name}"...`);
    try {
      const text = await extractFileContent(file);
      if (text) {
        setNoteContent(text);
        showToast(`Extracted ${text.length} characters from "${file.name}"!`);
      }
    } catch (err) {
      console.warn("PDF extraction error:", err);
      showToast(`Extraction warning: ${err.message}`);
    }
  };

  // Publish Quiz to Classroom & MongoDB
  const handlePublishQuiz = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!quizTitle.trim()) {
      showToast("Please enter a quiz title.");
      return;
    }

    // Validate questions
    const validQuestions = questionsList.filter((q) => q.question.trim().length > 0);
    if (validQuestions.length === 0) {
      showToast("Please add at least one question before publishing.");
      return;
    }

    for (let i = 0; i < validQuestions.length; i++) {
      const q = validQuestions[i];
      for (let j = 0; j < 4; j++) {
        if (!q.options[j] || !q.options[j].trim()) {
          showToast(`Question #${i + 1} has an empty Option ${String.fromCharCode(65 + j)}.`);
          return;
        }
      }
      if (typeof q.answerIndex !== "number" || q.answerIndex < 0 || q.answerIndex > 3) {
        showToast(`Please select a correct answer option for Question #${i + 1}.`);
        return;
      }
    }

    setIsPublishing(true);

    const questionsPayload = validQuestions.map((q) => ({
      question: q.question.trim(),
      options: q.options.map((opt) => opt.trim()),
      correctAnswer: q.answerIndex,
      explanation: q.explanation ? q.explanation.trim() : "",
    }));

    try {
      const payload = {
        title: quizTitle.trim(),
        description: quizDescription.trim(),
        subject: quizSubject,
        timeLimit: quizHasTimer ? Math.max(1, Number(quizTimeLimit) || 1) : null,
        passingScore: Number(quizPassingScore) || 60,
        difficulty: aiDifficulty,
        questions: questionsPayload,
      };

      const res = await quizApi.publish(payload);

      // Also sync to frontendStorage for instant cross-tab live updates
      uploadQuiz({
        id: res.quiz?.id || `quiz-${Date.now()}`,
        title: payload.title,
        subject: payload.subject,
        timeLimit: payload.timeLimit,
        passingScore: payload.passingScore,
        difficulty: payload.difficulty,
        questions: questionsPayload,
      });

      notifyLerniqSync("QUIZ_UPLOADED", res.quiz || payload);

      setPreviewQuizModal(false);
      setQuizTitle("");
      setQuizDescription("");
      setQuestionsList([{ question: "", options: ["", "", "", ""], answerIndex: 0, explanation: "" }]);
      setAiNotesText("");
      setUploadedFileName("");
      await fetchQuizzes();
      showToast("🎯 Quiz published to MongoDB! All classroom students have been notified.");
    } catch (err) {
      console.error("Quiz Publish Error:", err);
      showToast("Failed to publish quiz: " + (err.message || "Server error."));
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDeleteQuiz = async (id) => {
    if (!window.confirm("Are you sure you want to delete this quiz and all student submissions?")) {
      return;
    }

    try {
      await quizApi.delete(id);
    } catch (err) {
      console.warn("Backend quiz delete error:", err.message);
    }

    deleteQuiz(id);
    notifyLerniqSync("QUIZ_DELETED", { id });
    await fetchQuizzes();
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

    // Also persist as an official backend Document in MongoDB so it syncs to student documents & AI Tutor
    const textToSave = noteContent.trim() || noteDescription.trim() || "Course study notes prepared by faculty.";
    if (textToSave.length > 5) {
      documentApi.create({
        title: noteTitle.trim(),
        extractedText: textToSave,
        fileType: "pdf",
        originalFileName: noteFileName ? noteFileName.replace(/^.*[\\\/]/, "") : "Faculty_Handout.pdf",
      }).catch((err) => console.warn("Backend document sync note:", err.message));
    }

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

              
              {/* Quiz Generation Mode Switcher */}
              <div style={{ display: "flex", gap: "10px", marginBottom: "24px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setQuizCreationMode("ai")}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "12px",
                    border: "none",
                    background: quizCreationMode === "ai" ? "linear-gradient(135deg, #7c3aed, #6d28d9)" : "#f1f5f9",
                    color: quizCreationMode === "ai" ? "#ffffff" : "#475569",
                    fontWeight: "800",
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>🤖</span>
                  <span>Option 1: Upload Document & Generate with AI</span>
                </button>
                <button
                  type="button"
                  onClick={() => setQuizCreationMode("manual")}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "12px",
                    border: "none",
                    background: quizCreationMode === "manual" ? "linear-gradient(135deg, #7c3aed, #6d28d9)" : "#f1f5f9",
                    color: quizCreationMode === "manual" ? "#ffffff" : "#475569",
                    fontWeight: "800",
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>✏️</span>
                  <span>Option 2: Create Questions Manually</span>
                </button>
              </div>

              {/* AI GENERATION PANEL (OPTION 1) */}
              {quizCreationMode === "ai" && (
                <div
                  style={{
                    background: "#fbfaff",
                    border: "1.5px dashed #c4b5fd",
                    borderRadius: "16px",
                    padding: "24px",
                    marginBottom: "28px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
                    <div>
                      <h3 style={{ fontSize: "16px", fontWeight: "800", color: "#5b21b6", margin: 0 }}>
                        Upload Document for AI Quiz Generation (PDF, TXT, DOC, DOCX)
                      </h3>
                      <p style={{ color: "#64748b", fontSize: "13px", margin: "4px 0 0 0" }}>
                        Groq AI analyzes the document across topics to generate diverse, non-repetitive multiple-choice questions.
                      </p>
                    </div>

                    <label
                      style={{
                        padding: "9px 16px",
                        background: isUploadingFile ? "#cbd5e1" : "#ede9fe",
                        color: "#6d28d9",
                        borderRadius: "10px",
                        fontSize: "13px",
                        fontWeight: "700",
                        cursor: isUploadingFile ? "default" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span>{isUploadingFile ? "⏳ Reading Document..." : "📁 Upload Document"}</span>
                      <input
                        type="file"
                        accept=".pdf,.docx,.doc,.txt,.text"
                        onChange={handleNotesFileUpload}
                        disabled={isUploadingFile}
                        style={{ display: "none" }}
                      />
                    </label>
                  </div>

                  {uploadedFileName && (
                    <div style={{ marginBottom: "14px", padding: "8px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#166534" }}>
                      <span>📄 Document: <strong>{uploadedFileName}</strong> ({uploadedFileSize})</span>
                      <span>• {aiNotesText.split(/\s+/).filter(Boolean).length} words extracted</span>
                    </div>
                  )}

                  {fileError && (
                    <div style={{ marginBottom: "14px", padding: "8px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", fontSize: "13px", color: "#b91c1c" }}>
                      ⚠️ {fileError}
                    </div>
                  )}

                  <textarea
                    rows={4}
                    placeholder="Or paste study text directly here (lecture notes, chapter excerpts, syllabus concepts, formulas)..."
                    value={aiNotesText}
                    onChange={(e) => setAiNotesText(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: "10px",
                      border: "1.5px solid #cbd5e1",
                      fontSize: "13px",
                      boxSizing: "border-box",
                      marginBottom: "16px",
                      fontFamily: "inherit",
                    }}
                  />

                  {/* AI Generation Settings: Question Count (Dropdown + Custom Input) & Difficulty */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "16px", alignItems: "flex-end" }}>
                    {/* Dropdown containing question-count options */}
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "4px" }}>
                        Questions Count (Dropdown):
                      </label>
                      <select
                        value={aiQuestionCountSelect}
                        onChange={handleDropdownCountChange}
                        style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "13px", fontWeight: "700", background: "#fff" }}
                      >
                        <option value="5">5 Questions (Quick Check)</option>
                        <option value="10">10 Questions (Standard)</option>
                        <option value="15">15 Questions (Midterm)</option>
                        <option value="20">20 Questions (Comprehensive)</option>
                        <option value="25">25 Questions (In-depth)</option>
                        <option value="30">30 Questions (Maximum)</option>
                        <option value="custom">Custom Count (1 - 30)...</option>
                      </select>
                    </div>

                    {/* Custom input field where teachers can manually enter the number of questions */}
                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "4px" }}>
                        Manual / Custom Count (1 - 30):
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        placeholder="e.g. 7"
                        value={aiQuestionCount}
                        onChange={handleCustomCountChange}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          border: (aiQuestionCount < 1 || aiQuestionCount > 30) ? "1.5px solid #ef4444" : "1.5px solid #cbd5e1",
                          fontSize: "13px",
                          fontWeight: "700",
                          boxSizing: "border-box",
                          background: "#fff",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#334155", marginBottom: "4px" }}>
                        Difficulty Level:
                      </label>
                      <select
                        value={aiDifficulty}
                        onChange={(e) => setAiDifficulty(e.target.value)}
                        style={{ width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "13px", fontWeight: "700", background: "#fff" }}
                      >
                        <option value="Easy">Easy (Definitions & Fundamentals)</option>
                        <option value="Medium">Medium (Conceptual & Application)</option>
                        <option value="Difficult">Difficult (Advanced Synthesis & Analysis)</option>
                      </select>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={handleGenerateQuizFromNotes}
                        disabled={isGeneratingAiQuiz || aiQuestionCount < 1 || aiQuestionCount > 30}
                        style={{
                          width: "100%",
                          padding: "10px 20px",
                          background: (isGeneratingAiQuiz || aiQuestionCount < 1 || aiQuestionCount > 30) ? "#cbd5e1" : "linear-gradient(135deg, #7c3aed, #6d28d9)",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "10px",
                          fontWeight: "800",
                          fontSize: "13px",
                          cursor: (isGeneratingAiQuiz || aiQuestionCount < 1 || aiQuestionCount > 30) ? "not-allowed" : "pointer",
                          boxShadow: "0 4px 12px rgba(124, 58, 237, 0.3)",
                        }}
                      >
                        {isGeneratingAiQuiz ? "⚡ Generating Questions..." : `✨ Generate ${aiQuestionCount || 0} Questions`}
                      </button>
                    </div>
                  </div>

                  {(aiQuestionCount < 1 || aiQuestionCount > 30) && (
                    <small style={{ color: "#dc2626", fontWeight: "700", display: "block", marginTop: "6px" }}>
                      ⚠️ Please specify a question count between 1 and 30.
                    </small>
                  )}
                </div>
              )}

              {/* QUIZ CONFIGURATION & BUILDER FORM */}
              <form onSubmit={handlePublishQuiz}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "18px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                      Quiz Title *
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
                      <option value="General">General Academics</option>
                    </select>
                  </div>

                  {/* TIMER: MINIMUM 1 MIN + OPTION FOR UNLIMITED TIME */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <label style={{ fontSize: "13px", fontWeight: "700", color: "#334155" }}>
                        Time Limit
                      </label>
                      <label style={{ fontSize: "11px", color: "#6d28d9", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                        <input
                          type="checkbox"
                          checked={!quizHasTimer}
                          onChange={(e) => setQuizHasTimer(!e.target.checked)}
                        />
                        Unlimited Time
                      </label>
                    </div>
                    {quizHasTimer ? (
                      <input
                        type="number"
                        min="1"
                        max="180"
                        placeholder="Minutes"
                        value={quizTimeLimit}
                        onChange={(e) => setQuizTimeLimit(Math.max(1, Number(e.target.value)))}
                        style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box" }}
                        required={quizHasTimer}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          padding: "12px 14px",
                          borderRadius: "10px",
                          background: "#f1f5f9",
                          color: "#64748b",
                          fontSize: "13px",
                          fontWeight: "700",
                          boxSizing: "border-box",
                        }}
                      >
                        ⏱️ Unlimited Time (No countdown)
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                      Passing Score (%)
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

                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                    Description / Instructions (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Read Chapter 3 before attempting. Each question carries equal marks."
                    value={quizDescription}
                    onChange={(e) => setQuizDescription(e.target.value)}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: "10px", border: "1.5px solid #cbd5e1", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>

                {/* Question Builder */}
                <div style={{ marginBottom: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <label style={{ fontSize: "15px", fontWeight: "800", color: "#4c1d95" }}>
                      Questions List ({questionsList.length} {questionsList.length === 1 ? "Question" : "Questions"})
                    </label>
                    <button
                      type="button"
                      onClick={addQuestionField}
                      style={{ padding: "8px 16px", background: "#ede9fe", color: "#6d28d9", border: "none", borderRadius: "10px", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}
                    >
                      + Add Question
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
                        <span style={{ fontWeight: "800", fontSize: "14px", color: "#6d28d9" }}>
                          Question #{qIdx + 1}
                        </span>
                        {questionsList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeQuestionField(qIdx)}
                            style={{ background: "#fee2e2", border: "none", color: "#b91c1c", padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}
                          >
                            ✕ Remove
                          </button>
                        )}
                      </div>

                      <input
                        type="text"
                        placeholder="Write the question prompt here..."
                        value={q.question}
                        onChange={(e) => handleQuestionChange(qIdx, e.target.value)}
                        style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", boxSizing: "border-box", marginBottom: "12px", fontWeight: "600" }}
                        required
                      />

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px", marginBottom: "10px" }}>
                        {q.options.map((opt, optIdx) => (
                          <div
                            key={optIdx}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              padding: "6px 10px",
                              borderRadius: "8px",
                              background: q.answerIndex === optIdx ? "#f0fdf4" : "#ffffff",
                              border: q.answerIndex === optIdx ? "1.5px solid #10b981" : "1px solid #cbd5e1",
                            }}
                          >
                            <input
                              type="radio"
                              name={`correct_${qIdx}`}
                              checked={q.answerIndex === optIdx}
                              onChange={() => handleCorrectOptionChange(qIdx, optIdx)}
                              style={{ cursor: "pointer" }}
                              title="Mark as correct answer"
                            />
                            <span style={{ fontSize: "12px", fontWeight: "800", color: q.answerIndex === optIdx ? "#059669" : "#64748b" }}>
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <input
                              type="text"
                              placeholder={`Option ${String.fromCharCode(65 + optIdx)} text...`}
                              value={opt}
                              onChange={(e) => handleOptionChange(qIdx, optIdx, e.target.value)}
                              style={{ flex: 1, padding: "6px 8px", border: "none", background: "transparent", fontSize: "13px", outline: "none" }}
                              required
                            />
                          </div>
                        ))}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
                        <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "700" }}>Explanation:</span>
                        <input
                          type="text"
                          placeholder="Brief explanation for why the selected answer is correct (optional)"
                          value={q.explanation || ""}
                          onChange={(e) => handleExplanationChange(qIdx, e.target.value)}
                          style={{ flex: 1, padding: "6px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Form Buttons: Preview & Publish */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                  <button
                    type="button"
                    onClick={() => setPreviewQuizModal(true)}
                    style={{
                      padding: "12px 24px",
                      background: "#ede9fe",
                      color: "#6d28d9",
                      border: "none",
                      borderRadius: "12px",
                      fontWeight: "700",
                      fontSize: "14px",
                      cursor: "pointer",
                    }}
                  >
                    👁️ Preview Quiz
                  </button>

                  <button
                    type="submit"
                    disabled={isPublishing}
                    style={{
                      padding: "12px 28px",
                      background: isPublishing ? "#cbd5e1" : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "12px",
                      fontWeight: "800",
                      fontSize: "15px",
                      cursor: isPublishing ? "default" : "pointer",
                      boxShadow: "0 4px 14px rgba(16, 185, 129, 0.3)",
                    }}
                  >
                    {isPublishing ? "Publishing to Classroom..." : "Publish Quiz to Classroom →"}
                  </button>
                </div>
              </form>
            </div>

            {/* PREVIEW MODAL */}
            {previewQuizModal && (
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "rgba(0,0,0,0.6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 99999,
                  padding: "20px",
                }}
              >
                <div
                  style={{
                    background: "#fff",
                    borderRadius: "20px",
                    maxWidth: "800px",
                    width: "100%",
                    maxHeight: "85vh",
                    overflowY: "auto",
                    padding: "32px",
                    boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                    <div>
                      <span style={{ fontSize: "11px", fontWeight: "800", background: "#ede9fe", color: "#6d28d9", padding: "3px 8px", borderRadius: "6px", textTransform: "uppercase" }}>
                        QUIZ PREVIEW
                      </span>
                      <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1e293b", margin: "6px 0 2px 0" }}>
                        {quizTitle || "Untitled Quiz"}
                      </h2>
                      {quizDescription && (
                        <p style={{ color: "#64748b", fontSize: "13px", margin: "0 0 6px 0" }}>{quizDescription}</p>
                      )}
                      <div style={{ display: "flex", gap: "12px", fontSize: "12px", color: "#64748b", marginTop: "6px" }}>
                        <span>📚 {quizSubject}</span>
                        <span>⏱️ {quizHasTimer ? `${quizTimeLimit} mins` : "Unlimited Time"}</span>
                        <span>🎯 Pass: {quizPassingScore}%</span>
                        <span>❓ {questionsList.length} Questions</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setPreviewQuizModal(false)}
                      style={{ background: "#f1f5f9", border: "none", borderRadius: "50%", width: "32px", height: "32px", cursor: "pointer", fontSize: "14px" }}
                    >
                      ✕
                    </button>
                  </div>

                  <hr style={{ border: "none", borderTop: "1px solid #f1f5f9", margin: "16px 0" }} />

                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {questionsList.map((q, idx) => (
                      <div key={idx} style={{ padding: "16px", borderRadius: "12px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                        <div style={{ fontWeight: "700", fontSize: "14px", color: "#1e293b", marginBottom: "10px" }}>
                          Q{idx + 1}. {q.question || "No question prompt entered."}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "10px" }}>
                          {q.options.map((opt, optIdx) => (
                            <div
                              key={optIdx}
                              style={{
                                padding: "8px 12px",
                                borderRadius: "8px",
                                background: q.answerIndex === optIdx ? "#dcfce7" : "#ffffff",
                                border: q.answerIndex === optIdx ? "1.5px solid #16a34a" : "1px solid #cbd5e1",
                                fontSize: "13px",
                                color: q.answerIndex === optIdx ? "#15803d" : "#334155",
                                fontWeight: q.answerIndex === optIdx ? "700" : "500",
                              }}
                            >
                              <strong>{String.fromCharCode(65 + optIdx)}.</strong> {opt || "(Empty option)"}
                              {q.answerIndex === optIdx && <span style={{ marginLeft: "8px" }}>✓ Correct</span>}
                            </div>
                          ))}
                        </div>
                        {q.explanation && (
                          <div style={{ fontSize: "12px", color: "#065f46", background: "#ecfdf5", padding: "6px 10px", borderRadius: "6px" }}>
                            💡 Explanation: {q.explanation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
                    <button
                      type="button"
                      onClick={() => setPreviewQuizModal(false)}
                      style={{ padding: "10px 20px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: "10px", fontWeight: "700", cursor: "pointer" }}
                    >
                      Back to Editing
                    </button>
                    <button
                      type="button"
                      onClick={handlePublishQuiz}
                      disabled={isPublishing}
                      style={{ padding: "10px 24px", background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "#fff", border: "none", borderRadius: "10px", fontWeight: "800", cursor: "pointer" }}
                    >
                      {isPublishing ? "Publishing..." : "Publish Quiz to Classroom →"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* History of Conducted Quizzes */}
            <div style={{ background: "#ffffff", borderRadius: "20px", padding: "32px", border: "1px solid #f3e8ff", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
              <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#1e293b", margin: "0 0 4px 0" }}>
                Classroom Quizzes History
              </h2>
              <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 20px 0" }}>
                All quizzes active in your class, saved in MongoDB and visible to students registered in your classroom.
              </p>

              {quizzes.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                  No quizzes published yet. Create your first quiz using the form above.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {quizzes.map((q) => {
                    const qId = q.id || q._id;
                    const attemptedCount = q.studentRoster ? q.studentRoster.filter((s) => s.attempted).length : (q.totalAttempts || 0);
                    const totalRosterCount = q.studentRoster ? q.studentRoster.length : 0;

                    return (
                      <div
                        key={qId}
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
                              {q.subject || "Academics"}
                            </span>
                            {q.classroomCode && (
                              <span style={{ fontSize: "11px", fontWeight: "700", background: "#ede9fe", color: "#6d28d9", padding: "3px 8px", borderRadius: "6px" }}>
                                🏫 {q.classroomCode}
                              </span>
                            )}
                            <strong style={{ fontSize: "16px", color: "#1e293b" }}>{q.title}</strong>
                          </div>
                          {q.description && (
                            <p style={{ margin: "2px 0 6px 0", fontSize: "13px", color: "#64748b" }}>{q.description}</p>
                          )}
                          <div style={{ fontSize: "13px", color: "#64748b", display: "flex", gap: "14px", marginTop: "4px", flexWrap: "wrap" }}>
                            <span>❓ {q.questionCount || (q.questions ? q.questions.length : 0)} Questions</span>
                            <span>⏱️ {q.timeLimit ? `${q.timeLimit} Mins Limit` : "Untimed"}</span>
                            <span>🎯 Pass: {q.passingScore}%</span>
                            <span>👥 Attempts: <strong>{attemptedCount}{totalRosterCount > 0 ? ` / ${totalRosterCount}` : ""}</strong></span>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <Link
                            to={`/teacher/quiz-results?quizId=${qId}`}
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
                            View Results ({attemptedCount}) →
                          </Link>

                          <button
                            onClick={() => handleDeleteQuiz(qId)}
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
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
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
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "20px" }}>
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
                        onChange={handleNoteFileChange}
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
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "20px" }}>
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
