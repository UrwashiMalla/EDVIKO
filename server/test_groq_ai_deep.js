/**
 * Deep End-to-End Test for LERNIQ Groq AI Integration & Multi-language Support
 */

const { spawn } = require("child_process");

async function runDeepAITests() {
  console.log("===============================================================");
  console.log("🚀 STARTING DEEP GROQ AI MULTI-LANGUAGE & QUALITY VALIDATION TEST");
  console.log("===============================================================\n");

  const serverProcess = spawn("node", ["server.js"], {
    cwd: "/Users/mac/Desktop/new project nlp/LERNIQ/server",
    env: { ...process.env, PORT: "5002" },
    stdio: "pipe",
  });

  serverProcess.stdout.on("data", (d) => {
    const msg = d.toString().trim();
    if (msg.includes("MongoDB") || msg.includes("Server running")) {
      console.log(`[SERVER]: ${msg}`);
    }
  });

  serverProcess.stderr.on("data", (d) => console.error(`[SERVER ERR]: ${d.toString().trim()}`));

  // Wait 3.5 seconds for boot
  await new Promise((r) => setTimeout(r, 3500));

  const BASE = "http://localhost:5002";

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
    // 1. Get or create a student
    console.log("--- STEP 1: Authenticate Student ---");
    const email = `deep_ai_student_${Date.now()}@lerniq.edu`;
    const regRes = await request("/api/auth/student/register", "POST", {
      name: "Devendra Patil",
      email,
      password: "Student@123",
      gradeLevel: "Undergraduate",
      institution: "Pune Institute of Computer Technology",
    });

    let token;
    if (regRes.ok && regRes.data.requiresOtp) {
      const verifyRes = await request("/api/auth/verify-otp", "POST", {
        email,
        otp: "123456",
      });
      if (verifyRes.ok && verifyRes.data.token) {
        token = verifyRes.data.token;
        console.log("✅ Student registered and verified with OTP:", email);
      }
    }

    if (!token) {
      // Login existing if already present
      const loginRes = await request("/api/auth/student/login", "POST", {
        email: "student@lerniq.edu",
        password: "Student@123",
      });
      token = loginRes.data.token;
      console.log("✅ Logged in existing student");
    }

    if (!token) throw new Error("Could not obtain student auth token");

    // 2. Upload study material
    console.log("\n--- STEP 2: Upload Real Study Material Document ---");
    const sampleText = `
Design and Analysis of Algorithms - Unit IV: Dynamic Programming and Greedy Techniques

1. Dynamic Programming Fundamentals:
Dynamic programming is an algorithmic paradigm that solves problems by breaking them down into simpler subproblems and storing the results of these subproblems to avoid redundant computations. The two key properties required for dynamic programming to be applicable are:
- Optimal Substructure: An optimal solution to the problem contains optimal solutions to subproblems.
- Overlapping Subproblems: The problem can be broken down into subproblems which are reused several times.

There are two primary approaches to dynamic programming:
a) Top-Down with Memoization: The problem is solved recursively, and the results of function calls are cached in a table or dictionary. When a subproblem is encountered again, the cached result is returned directly.
b) Bottom-Up with Tabulation: The problem is solved iteratively, filling up a table starting from the base cases up to the desired target value.

2. Matrix Chain Multiplication:
Given a sequence of matrices A1, A2, ..., An, where matrix Ai has dimensions p[i-1] x p[i], determine the optimal parenthesization of the product A1*A2*...*An that minimizes the total number of scalar multiplications.
Matrix multiplication is associative, but the number of scalar multiplications depends heavily on order. If matrix A is 10x100 and B is 100x5, multiplying (A*B)*C versus A*(B*C) can lead to orders of magnitude difference in operations.
The recurrence relation is:
m[i, j] = 0 if i = j
m[i, j] = min { m[i, k] + m[k+1, j] + p[i-1]*p[k]*p[j] } for i <= k < j.
The time complexity using dynamic programming is O(n^3) and space complexity is O(n^2).

3. Greedy Algorithms vs Dynamic Programming:
A greedy algorithm makes the locally optimal choice at each stage with the hope of finding a global optimum. Unlike dynamic programming, greedy algorithms never reconsider their choices once made.
Example: The 0/1 Knapsack problem cannot be solved using a greedy approach because items cannot be broken into fractions; it requires dynamic programming with time complexity O(n*W). In contrast, the Fractional Knapsack problem exhibits the greedy choice property and can be solved by sorting items by value-to-weight ratio in O(n log n) time.
Another prominent greedy algorithm is Huffman Coding for optimal prefix-free data compression, which builds an optimal tree using a priority queue in O(n log n) time.
    `.trim();

    const uploadRes = await request("/api/documents", "POST", {
      title: "Algorithms Unit IV - Dynamic Programming & Greedy Methods",
      originalFileName: "DAA_Unit_4_Lecture_Notes.pdf",
      fileType: "pdf",
      fileSize: 45200,
      extractedText: sampleText,
    }, token);

    if (!uploadRes.ok || !uploadRes.data.document) {
      throw new Error(`Document upload failed: ${JSON.stringify(uploadRes.data)}`);
    }

    const documentId = uploadRes.data.document.id;
    console.log("✅ Study material uploaded successfully. Document ID:", documentId);

    // 3. Test English AI Generation
    console.log("\n--- STEP 3: Generate AI Toolkit Content (English) ---");

    // 3a. Summary (English)
    console.log("Generating Summary (English)...");
    const summaryEn = await request("/api/ai/summary", "POST", {
      documentId,
      language: "English",
      forceRegenerate: false,
    }, token);
    if (!summaryEn.ok || !summaryEn.data.summary) throw new Error("English summary failed");
    console.log("✅ English Summary Generated:", summaryEn.data.summary.slice(0, 120) + "...");

    // 3b. Notes (English)
    console.log("Generating Important Notes (English)...");
    const notesEn = await request("/api/ai/important-notes", "POST", {
      documentId,
      language: "English",
      forceRegenerate: false,
    }, token);
    if (!notesEn.ok || !notesEn.data.notes) throw new Error("English notes failed");
    console.log("✅ English Notes Generated:", notesEn.data.notes.slice(0, 120) + "...");

    // 3c. Questions (English)
    console.log("Generating 10 Practice Questions (English)...");
    const questionsEn = await request("/api/ai/questions", "POST", {
      documentId,
      language: "English",
      forceRegenerate: false,
    }, token);
    if (!questionsEn.ok || !Array.isArray(questionsEn.data.questions)) throw new Error("English questions failed");
    if (questionsEn.data.questions.length !== 10) {
      throw new Error(`Expected 10 questions, got ${questionsEn.data.questions.length}`);
    }
    console.log(`✅ Exactly ${questionsEn.data.questions.length} Questions Generated in English.`);

    // Quality check: make sure no questions start with broken copy-paste string
    questionsEn.data.questions.forEach((q, idx) => {
      if (q.question.includes("What is the significance of: '")) {
        throw new Error(`Broken question format detected at index ${idx}: ${q.question}`);
      }
    });
    console.log("Sample Question 1:", questionsEn.data.questions[0].question);
    console.log("Sample Question 10:", questionsEn.data.questions[9].question);

    // 3d. Quiz (English)
    console.log("Generating 10 MCQ Quiz Questions (English)...");
    const quizEn = await request("/api/ai/quiz", "POST", {
      documentId,
      language: "English",
      forceRegenerate: false,
    }, token);
    if (!quizEn.ok || !Array.isArray(quizEn.data.quiz)) throw new Error("English quiz failed");
    if (quizEn.data.quiz.length !== 10) {
      throw new Error(`Expected 10 MCQs, got ${quizEn.data.quiz.length}`);
    }
    quizEn.data.quiz.forEach((mcq, idx) => {
      if (!Array.isArray(mcq.options) || mcq.options.length !== 4) {
        throw new Error(`MCQ ${idx + 1} does not have exactly 4 options!`);
      }
      if (typeof mcq.correctAnswer !== "number" || mcq.correctAnswer < 0 || mcq.correctAnswer > 3) {
        throw new Error(`MCQ ${idx + 1} has invalid correctAnswer index: ${mcq.correctAnswer}`);
      }
      if (!mcq.explanation || mcq.explanation.trim().length === 0) {
        throw new Error(`MCQ ${idx + 1} is missing explanation!`);
      }
    });
    console.log(`✅ Exactly ${quizEn.data.quiz.length} MCQs Generated with 4 options each and explanations.`);
    console.log("Sample MCQ 1:", quizEn.data.quiz[0].question);
    console.log("Sample MCQ 1 Options:", quizEn.data.quiz[0].options);
    console.log("Sample MCQ 1 Correct Answer Index:", quizEn.data.quiz[0].correctAnswer);

    // 4. Test Hindi AI Generation
    console.log("\n--- STEP 4: Generate AI Toolkit Content in Hindi (Devanagari) ---");
    console.log("Generating Summary in Hindi...");
    const summaryHi = await request("/api/ai/summary", "POST", {
      documentId,
      language: "Hindi",
      forceRegenerate: false,
    }, token);
    if (!summaryHi.ok || !summaryHi.data.summary) throw new Error("Hindi summary failed");
    // Verify Devanagari characters: Unicode \u0900-\u097F
    const devanagariRegex = /[\u0900-\u097F]/;
    if (!devanagariRegex.test(summaryHi.data.summary)) {
      throw new Error("Hindi summary does not contain Devanagari script!");
    }
    console.log("✅ Hindi Summary Generated in Devanagari:\n", summaryHi.data.summary.slice(0, 160) + "...");

    console.log("Generating 10 Practice Questions in Hindi...");
    const questionsHi = await request("/api/ai/questions", "POST", {
      documentId,
      language: "Hindi",
      forceRegenerate: false,
    }, token);
    if (!questionsHi.ok || questionsHi.data.questions?.length !== 10) throw new Error("Hindi questions failed");
    if (!devanagariRegex.test(questionsHi.data.questions[0].question)) {
      throw new Error("Hindi questions do not contain Devanagari script!");
    }
    console.log("✅ 10 Hindi Questions Generated. Sample Question 1:", questionsHi.data.questions[0].question);

    // 5. Test Marathi AI Generation
    console.log("\n--- STEP 5: Generate AI Summary in Marathi ---");
    const summaryMr = await request("/api/ai/summary", "POST", {
      documentId,
      language: "Marathi",
      forceRegenerate: false,
    }, token);
    if (!summaryMr.ok || !summaryMr.data.summary) throw new Error("Marathi summary failed");
    if (!devanagariRegex.test(summaryMr.data.summary)) {
      throw new Error("Marathi summary does not contain Devanagari script!");
    }
    console.log("✅ Marathi Summary Generated:\n", summaryMr.data.summary.slice(0, 160) + "...");

    // 6. Test Hinglish AI Generation
    console.log("\n--- STEP 6: Generate AI Summary in Hinglish ---");
    const summaryHinglish = await request("/api/ai/summary", "POST", {
      documentId,
      language: "Hinglish",
      forceRegenerate: false,
    }, token);
    if (!summaryHinglish.ok || !summaryHinglish.data.summary) throw new Error("Hinglish summary failed");
    console.log("✅ Hinglish Summary Generated:\n", summaryHinglish.data.summary.slice(0, 160) + "...");

    // 7. Verify MongoDB Cache Separation per Language
    console.log("\n--- STEP 7: Verify Cache Separation in Document API ---");
    const docEn = await request(`/api/documents/${documentId}?lang=English`, "GET", null, token);
    const docHi = await request(`/api/documents/${documentId}?lang=Hindi`, "GET", null, token);

    if (docEn.data.aiResult?.summary === docHi.data.aiResult?.summary) {
      throw new Error("Cache collision! English and Hindi returned the same summary!");
    }
    console.log("✅ Document API correctly returns distinct AI results per language!");
    console.log("Doc En Language:", docEn.data.language, "| Summary starts with:", docEn.data.aiResult?.summary?.slice(0, 40));
    console.log("Doc Hi Language:", docHi.data.language, "| Summary starts with:", docHi.data.aiResult?.summary?.slice(0, 40));

    // 8. Test Question Regeneration with forceRegenerate: true
    console.log("\n--- STEP 8: Test Question Regeneration (forceRegenerate: true) ---");
    const questionsRegen = await request("/api/ai/questions", "POST", {
      documentId,
      language: "English",
      forceRegenerate: true,
    }, token);
    if (!questionsRegen.ok || questionsRegen.data.questions?.length !== 10) throw new Error("Regeneration failed");
    console.log("✅ Regeneration succeeded! Exactly 10 new questions returned.");
    console.log("Regenerated Sample Q1:", questionsRegen.data.questions[0].question);

    // 9. Test AI Tutor Grounding & Language
    console.log("\n--- STEP 9: Test AI Tutor Grounding & Language ---");

    // In-domain English
    console.log("Testing on-topic question in English...");
    const tutorOnTopic = await request("/api/ai/tutor", "POST", {
      documentId,
      question: "What is the time complexity of Matrix Chain Multiplication with dynamic programming?",
      language: "English",
    }, token);
    if (!tutorOnTopic.ok || !tutorOnTopic.data.answer) throw new Error("Tutor on-topic failed");
    console.log("✅ Tutor On-Topic Answer (English):\n", tutorOnTopic.data.answer.slice(0, 160) + "...");
    if (!tutorOnTopic.data.answer.includes("O(n^3)") && !tutorOnTopic.data.answer.toLowerCase().includes("o(n")) {
      console.warn("Notice: check if O(n^3) mentioned:", tutorOnTopic.data.answer);
    }

    // Out-of-domain refusal test
    console.log("Testing off-topic question (grounding refusal)...");
    const tutorOffTopic = await request("/api/ai/tutor", "POST", {
      documentId,
      question: "Who won the FIFA World Cup in Qatar in 2022?",
      language: "English",
    }, token);
    console.log("✅ Tutor Off-Topic Response:\n", tutorOffTopic.data.answer);
    const refusalPatterns = ["not mentioned", "not provided", "study material", "not contain", "document", "unable"];
    const hasRefusal = refusalPatterns.some((p) => tutorOffTopic.data.answer.toLowerCase().includes(p));
    if (!hasRefusal) {
      throw new Error("Tutor did not refuse an out-of-domain question!");
    }
    console.log("✅ Tutor properly grounded: refused off-topic query.");

    // Tutor in Hindi
    console.log("Testing on-topic question in Hindi...");
    const tutorHi = await request("/api/ai/tutor", "POST", {
      documentId,
      question: "Optimal substructure kya hota hai?",
      language: "Hindi",
    }, token);
    if (!tutorHi.ok || !tutorHi.data.answer) throw new Error("Tutor Hindi failed");
    if (!devanagariRegex.test(tutorHi.data.answer)) {
      throw new Error("Tutor answer in Hindi does not contain Devanagari script!");
    }
    console.log("✅ Tutor Hindi Answer:\n", tutorHi.data.answer.slice(0, 160) + "...");

    // 10. Test Quiz Submission & Persistence
    console.log("\n--- STEP 10: Test Quiz Attempt Submission & Score Calculation ---");
    const quizId = quizEn.data.quizId;
    const testAnswers = quizEn.data.quiz.map((q, idx) => ({
      questionIndex: idx,
      selectedAnswer: q.correctAnswer, // all correct
    }));

    const attemptRes = await request(`/api/quizzes/${quizId}/attempt`, "POST", {
      answers: testAnswers,
    }, token);

    if (!attemptRes.ok || !attemptRes.data.result) throw new Error("Quiz submission failed");
    const resObj = attemptRes.data.result;
    console.log(`✅ Quiz Attempt Recorded: Score ${resObj.score}/${resObj.totalQuestions} (${resObj.percentage}%)`);

    console.log("\n===============================================================");
    console.log("🎉 ALL DEEP GROQ AI MULTI-LANGUAGE & QUALITY TESTS PASSED!");
    console.log("===============================================================");
  } catch (err) {
    console.error("\n❌ TEST SUITE FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    serverProcess.kill("SIGINT");
    setTimeout(() => process.exit(), 1000);
  }
}

runDeepAITests();
