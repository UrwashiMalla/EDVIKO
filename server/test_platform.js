/**
 * Complete End-to-End Acceptance Test for LERNIQ Platform
 */

const { spawn } = require("child_process");
const http = require("http");

async function runTests() {
  console.log("=== STARTING LERNIQ PLATFORM END-TO-END ACCEPTANCE TEST ===");

  // 1. Boot server in background process
  const serverProcess = spawn("node", ["server.js"], {
    cwd: "/Users/mac/Desktop/new project nlp/LERNIQ/server",
    env: { ...process.env, PORT: "5001" }, // run test on port 5001 to avoid any port conflicts
    stdio: "pipe",
  });

  serverProcess.stdout.on("data", (d) => console.log(`[SERVER]: ${d.toString().trim()}`));
  serverProcess.stderr.on("data", (d) => console.error(`[SERVER ERR]: ${d.toString().trim()}`));

  // Wait 3 seconds for server boot and MongoDB connection
  await new Promise((r) => setTimeout(r, 3000));

  const BASE = "http://localhost:5001";

  async function request(endpoint, method = "GET", body = null, token = null) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${BASE}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });
    const json = await res.json();
    return { status: res.status, ok: res.ok, data: json };
  }

  try {
    // TEST 1: Health check
    console.log("\n[TEST 1] Testing Health Check GET /");
    const health = await request("/");
    console.log("Health Check Result:", health.data.status, "| Success:", health.data.success);
    if (!health.ok) throw new Error("Health check failed");

    // TEST 2: Teacher Login
    console.log("\n[TEST 2] Testing Faculty Login POST /api/auth/teacher/login");
    const teacherLogin = await request("/api/auth/teacher/login", "POST", {
      email: "teacher@lerniq.edu",
      password: "Teacher@123",
    });
    console.log("Teacher Login:", teacherLogin.data.message, "| Role:", teacherLogin.data.user?.role);
    if (!teacherLogin.ok || !teacherLogin.data.token) throw new Error("Teacher login failed");
    const teacherToken = teacherLogin.data.token;

    // TEST 3: Student Registration
    const testEmail = `student_${Date.now()}@lerniq.edu`;
    console.log(`\n[TEST 3] Testing Student Registration POST /api/auth/student/register (${testEmail})`);
    const studentReg = await request("/api/auth/student/register", "POST", {
      name: "Aarav Sharma",
      email: testEmail,
      password: "Password@123",
      teacherCode: "TEACH-101",
    });
    console.log("Student Registration:", studentReg.data.message, "| Requires OTP:", studentReg.data.requiresOtp);
    if (!studentReg.ok) throw new Error("Student registration failed: " + JSON.stringify(studentReg.data));

    // TEST 4: Student OTP Verification
    console.log("\n[TEST 4] Testing Student OTP Verification POST /api/auth/verify-otp");
    const studentOtp = await request("/api/auth/verify-otp", "POST", {
      email: testEmail,
      otp: "123456",
    });
    console.log("Student OTP:", studentOtp.data.message, "| Verified:", studentOtp.data.user?.isVerified);
    if (!studentOtp.ok || !studentOtp.data.token) throw new Error("Student OTP verification failed");
    const studentToken = studentOtp.data.token;
    const studentId = studentOtp.data.user.id;

    // TEST 5: Student Profile & Dashboard
    console.log("\n[TEST 5] Testing Student Dashboard GET /api/students/me/dashboard");
    const studentDash = await request("/api/students/me/dashboard", "GET", null, studentToken);
    console.log("Student Dashboard:", studentDash.data.stats);
    if (!studentDash.ok) throw new Error("Student dashboard failed");

    // TEST 6: Document Persistence
    console.log("\n[TEST 6] Testing Document Upload & Persistence POST /api/documents");
    const sampleText = `
      Artificial Intelligence and Neural Networks:
      Artificial Intelligence (AI) is the simulation of human intelligence processes by computer systems.
      Deep learning is a subset of machine learning based on artificial neural networks with representation learning.
      A neural network consists of interconnected nodes called artificial neurons, organized into layers:
      an input layer, one or more hidden layers, and an output layer.
      Activation functions such as ReLU, Sigmoid, and Tanh introduce non-linearity into the network,
      allowing it to learn complex mappings between inputs and target outputs.
      Backpropagation is the primary algorithm used to train neural networks by computing the gradient of the loss function
      with respect to each weight via the chain rule of calculus.
      Optimization algorithms like Stochastic Gradient Descent (SGD) and Adam iteratively update the weights
      to minimize loss and maximize accuracy.
    `.trim();

    const docRes = await request("/api/documents", "POST", {
      title: "Introduction to Artificial Intelligence & Neural Networks",
      originalFileName: "ai-lecture-1.pdf",
      fileType: "pdf",
      fileSize: 10240,
      extractedText: sampleText,
    }, studentToken);
    console.log("Document Created:", docRes.data.message, "| Doc ID:", docRes.data.document?.id);
    if (!docRes.ok || !docRes.data.document?.id) throw new Error("Document creation failed");
    const documentId = docRes.data.document.id;

    // TEST 7: AI Summary
    console.log("\n[TEST 7] Testing AI Summary POST /api/ai/summary");
    const summaryRes = await request("/api/ai/summary", "POST", {
      documentId,
      language: "English",
    }, studentToken);
    console.log("Summary Generated Length:", (summaryRes.data.summary || "").length, "characters");
    if (!summaryRes.ok || !summaryRes.data.summary) throw new Error("Summary generation failed");

    // TEST 8: AI Quick Notes & Important Notes
    console.log("\n[TEST 8] Testing AI Quick Notes POST /api/ai/quick-notes & Important Notes");
    const quickNotesRes = await request("/api/ai/quick-notes", "POST", {
      documentId,
      language: "English",
    }, studentToken);
    console.log("Quick Notes Length:", (quickNotesRes.data.quickNotes || "").length);

    const importantNotesRes = await request("/api/ai/important-notes", "POST", {
      documentId,
      language: "English",
    }, studentToken);
    console.log("Important Notes Length:", (importantNotesRes.data.notes || "").length);
    if (!importantNotesRes.ok || !importantNotesRes.data.notes) throw new Error("Notes generation failed");

    // TEST 9: AI Exactly 10 Practice Questions
    console.log("\n[TEST 9] Testing Exactly 10 Questions POST /api/ai/questions");
    const questionsRes = await request("/api/ai/questions", "POST", {
      documentId,
      language: "English",
    }, studentToken);
    console.log("Questions Generated Count:", questionsRes.data.questions?.length);
    if (!questionsRes.ok || questionsRes.data.questions?.length !== 10) throw new Error("Expected 10 questions");

    // TEST 10: AI Exactly 10 MCQ Quiz Questions
    console.log("\n[TEST 10] Testing Exactly 10 MCQ Quiz POST /api/ai/quiz");
    const quizRes = await request("/api/ai/quiz", "POST", {
      documentId,
      language: "English",
    }, studentToken);
    console.log("MCQ Quiz Questions Count:", quizRes.data.quiz?.length, "| Quiz ID:", quizRes.data.quizId);
    if (!quizRes.ok || quizRes.data.quiz?.length !== 10) throw new Error("Expected 10 MCQs");
    const quizId = quizRes.data.quizId;

    // TEST 11: Attempting Quiz & Persisting Score
    console.log("\n[TEST 11] Testing Quiz Attempt & Scoring POST /api/quizzes/:id/attempt");
    // Simulate 8 correct answers and 2 incorrect answers
    const answers = quizRes.data.quiz.map((q, idx) => ({
      questionIndex: idx,
      selectedAnswer: idx < 8 ? q.correctAnswer : (q.correctAnswer === 0 ? 1 : 0),
    }));

    const attemptRes = await request(`/api/quizzes/${quizId}/attempt`, "POST", {
      answers,
    }, studentToken);
    console.log("Quiz Attempt Result:", attemptRes.data.result.score, "/ 10 (", attemptRes.data.result.percentage, "% ) | Saved:", attemptRes.data.success);
    if (!attemptRes.ok || attemptRes.data.result.score !== 8) throw new Error("Quiz scoring failed");

    // TEST 12: AI Tutor with Multi-turn Memory
    console.log("\n[TEST 12] Testing AI Tutor Multi-turn Chat POST /api/ai/tutor");
    const tutor1 = await request("/api/ai/tutor", "POST", {
      documentId,
      question: "What is backpropagation and how does it work?",
      language: "English",
    }, studentToken);
    console.log("Tutor Turn 1 Response:", tutor1.data.answer?.slice(0, 100), "...");

    const tutor2 = await request("/api/ai/tutor", "POST", {
      documentId,
      question: "Can you summarize that in one sentence?",
      language: "English",
    }, studentToken);
    console.log("Tutor Turn 2 Response (History length:", tutor2.data.history?.length, "):", tutor2.data.answer?.slice(0, 100), "...");
    if (!tutor2.ok || tutor2.data.history?.length < 4) throw new Error("Tutor multi-turn chat failed");

    // TEST 13: Student Document History
    console.log("\n[TEST 13] Testing Student Document History GET /api/documents");
    const docsHistory = await request("/api/documents", "GET", null, studentToken);
    console.log("Student Documents Count:", docsHistory.data.count, "| Latest Score:", docsHistory.data.documents[0]?.latestScore);
    if (!docsHistory.ok || docsHistory.data.count < 1) throw new Error("Document history failed");

    // TEST 14: Teacher Dashboard (Monitoring Enrolled Student)
    console.log("\n[TEST 14] Testing Faculty Dashboard GET /api/teachers/dashboard");
    const teacherDash = await request("/api/teachers/dashboard", "GET", null, teacherToken);
    console.log("Teacher Stats:", teacherDash.data.stats, "| Recent Activity Count:", teacherDash.data.recentActivity?.length);
    if (!teacherDash.ok || teacherDash.data.stats.totalStudents < 1) throw new Error("Teacher stats failed to reflect student");

    // TEST 15: Teacher Inspecting Student Detail
    console.log(`\n[TEST 15] Testing Teacher Student Inspection GET /api/teachers/students/${studentId}`);
    const studentDetail = await request(`/api/teachers/students/${studentId}`, "GET", null, teacherToken);
    console.log("Inspected Student:", studentDetail.data.student.name, "| Docs:", studentDetail.data.documents.length, "| Quizzes:", studentDetail.data.quizResults.length);
    if (!studentDetail.ok || studentDetail.data.quizResults.length < 1) throw new Error("Teacher student inspection failed");

    // TEST 16: Teacher Documents Feed GET /api/teachers/documents
    console.log("\n[TEST 16] Testing Teacher Documents Feed GET /api/teachers/documents");
    const teacherDocs = await request("/api/teachers/documents", "GET", null, teacherToken);
    console.log("Teacher Documents Total:", teacherDocs.data.count, "| First Doc Title:", teacherDocs.data.documents[0]?.title);
    if (!teacherDocs.ok || teacherDocs.data.count < 1) throw new Error("Teacher documents feed failed");

    // TEST 17: Teacher Quiz Results Feed GET /api/teachers/quiz-results
    console.log("\n[TEST 17] Testing Teacher Quiz Results Feed GET /api/teachers/quiz-results");
    const teacherQuizResults = await request("/api/teachers/quiz-results", "GET", null, teacherToken);
    console.log("Teacher Quiz Submissions:", teacherQuizResults.data.count, "| Score:", teacherQuizResults.data.quizResults[0]?.score);
    if (!teacherQuizResults.ok || teacherQuizResults.data.count < 1) throw new Error("Teacher quiz results feed failed");

    console.log("\n=======================================================");
    console.log("🎉 ALL 17 END-TO-END ACCEPTANCE TESTS PASSED PERFECTLY!");
    console.log("=======================================================\n");
  } finally {
    serverProcess.kill();
  }
}

runTests().catch((err) => {
  console.error("\n❌ TEST SUITE FAILED:", err);
  process.exit(1);
});
