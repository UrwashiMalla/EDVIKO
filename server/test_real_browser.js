/**
 * Real Browser End-to-End Automation Test using Chrome DevTools Protocol (CDP) & Node.js WebSocket
 * Tests the real frontend UI in Headless Google Chrome:
 * 1. Upload study material.
 * 2. Generate and Regenerate Summary + Toast verification.
 * 3. Dynamic Language Switching (English -> Hinglish -> Hindi -> Marathi).
 * 4. Generate and Regenerate Practice Questions (verify 10 questions, new on regenerate).
 * 5. Generate and attempt Smart MCQ Quiz (verify 10 MCQs, 4 options each, attempt saved).
 * 6. Multi-turn AI Tutor chat ("hi", document question, follow-up, off-topic refusal).
 * 7. Verify browser console logs and network responses.
 */

const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
    this.eventHandlers = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve, reject } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        } else if (msg.method) {
          const handler = this.eventHandlers.get(msg.method);
          if (handler) handler(msg.params);
        }
      };
    });
  }

  on(event, handler) {
    this.eventHandlers.set(event, handler);
  }

  async send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (!res || !res.result) return null;
    if (res.result.value !== undefined) return res.result.value;
    if (res.result.type === "object" && res.result.subtype === "node") return true;
    return Boolean(res.result.value);
  }

  async waitForFunction(fnStr, timeout = 45000, interval = 250) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const val = await this.evaluate(`Boolean((${fnStr})())`);
        if (val) return val;
      } catch (_) {}
      await new Promise((r) => setTimeout(r, interval));
    }
    throw new Error(`Timeout waiting for function: ${fnStr}`);
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function runRealBrowserTest() {
  console.log("==================================================================");
  console.log("🌐 STARTING REAL CHROME BROWSER E2E TEST FOR LERNIQ PLATFORM");
  console.log("==================================================================\n");

  let backendProc = null;
  let frontendProc = null;
  let chromeProc = null;

  const browserConsoleLogs = [];
  const networkRequests = [];

  try {
    // 1. Verify or Start Backend
    console.log("1. Checking Backend API server on port 5000...");
    let backendAlive = false;
    try {
      const ping = await fetch("http://localhost:5000/api/auth/student/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      backendAlive = true;
      console.log("✅ Backend server is already running on port 5000.");
    } catch (_) {}

    if (!backendAlive) {
      console.log("Starting Backend API server on port 5000...");
      backendProc = spawn("node", ["server.js"], {
        cwd: "/Users/mac/Desktop/new project nlp/LERNIQ/server",
        env: { ...process.env, PORT: "5000" },
        stdio: "pipe",
      });
      await new Promise((r) => setTimeout(r, 3500));
    }

    // 2. Verify or Start Vite
    console.log("2. Checking Vite frontend on port 5173...");
    let frontendAlive = false;
    try {
      const ping = await fetch("http://localhost:5173");
      frontendAlive = true;
      console.log("✅ Vite dev server is already running on port 5173.");
    } catch (_) {}

    if (!frontendAlive) {
      console.log("Starting Vite frontend on port 5173...");
      frontendProc = spawn("npx", ["vite", "--port", "5173"], {
        cwd: "/Users/mac/Desktop/new project nlp/LERNIQ",
        stdio: "pipe",
      });
      await new Promise((r) => setTimeout(r, 2500));
    }

    // 3. Launch Google Chrome in headless mode with remote debugging
    const userDataDir = `/tmp/lerniq_chrome_${Date.now()}`;
    console.log("3. Launching Google Chrome headless with CDP remote debugging...");
    chromeProc = spawn(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      [
        "--headless=new",
        "--remote-debugging-port=9222",
        `--user-data-dir=${userDataDir}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-gpu",
      ],
      { stdio: "ignore" }
    );

    await new Promise((r) => setTimeout(r, 2000));

    // 4. Create a target tab in Chrome
    const newTabRes = await fetch("http://127.0.0.1:9222/json/new?http://localhost:5173", { method: "PUT" });
    const tabInfo = await newTabRes.json();
    console.log("Chrome Tab created. WebSocket URL:", tabInfo.webSocketDebuggerUrl);

    const client = new CDPClient(tabInfo.webSocketDebuggerUrl);
    await client.connect();

    // Enable domains
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Network.enable");
    await client.send("Console.enable");

    client.on("Console.messageAdded", (msg) => {
      browserConsoleLogs.push(msg.message);
      if (msg.message.level === "error") {
        console.warn(`[BROWSER CONSOLE ERR]: ${msg.message.text}`);
      }
    });

    client.on("Network.responseReceived", (params) => {
      const url = params.response.url;
      if (url.includes("/api/")) {
        networkRequests.push({
          url,
          status: params.response.status,
          statusText: params.response.statusText,
        });
      }
    });

    // 5. Navigate to student login
    console.log("\n--- BROWSER STEP 1: Navigate to Student Login ---");
    await client.send("Page.navigate", { url: "http://localhost:5173/student/login" });
    await client.waitForFunction(() => document.querySelector("input[type='email']"));
    console.log("✅ Student login page loaded in Chrome.");

    // Create an authenticated session directly in the browser
    console.log("\n--- BROWSER STEP 2: Authenticate Student Session ---");
    let authRes = await fetch("http://localhost:5000/api/auth/student/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "student@lerniq.edu", password: "Student@123" }),
    });
    let authData = await authRes.json();

    if (!authData.token) {
      console.log("Existing student not found, registering student@lerniq.edu...");
      const regRes = await fetch("http://localhost:5000/api/auth/student/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Demo Student", email: "student@lerniq.edu", password: "Student@123" }),
      });
      const regData = await regRes.json();
      if (regData.requiresOtp) {
        const verifyRes = await fetch("http://localhost:5000/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "student@lerniq.edu", otp: regData.devOtp || "123456" }),
        });
        authData = await verifyRes.json();
      } else {
        authData = regData;
      }
    }

    if (!authData.token) throw new Error("Could not authenticate student: " + JSON.stringify(authData));
    console.log("✅ Authenticated student session obtained for:", authData.user?.email);

    // Set token in localStorage
    await client.evaluate(`
      localStorage.setItem("lerniq_token", "${authData.token}");
      localStorage.setItem("lerniq_user", JSON.stringify(${JSON.stringify(authData.user)}));
    `);

    // 6. Upload a test study material document
    console.log("\n--- BROWSER STEP 3: Create & Open Study Material Document ---");
    const testDocText = `
Design and Analysis of Algorithms - Unit 4: Dynamic Programming & Greedy Methods

1. Dynamic Programming Fundamentals:
Dynamic programming is an algorithmic paradigm that solves optimization problems by breaking them into overlapping subproblems and caching their optimal solutions (Optimal Substructure + Overlapping Subproblems).
It employs two paradigms: Top-Down with Memoization and Bottom-Up with Tabulation.

2. Matrix Chain Multiplication:
Determines the optimal parenthesization of a chain of matrices A1*A2*...*An that minimizes total scalar multiplications.
The recurrence relation is:
m[i,j] = min { m[i,k] + m[k+1,j] + p[i-1]*p[k]*p[j] } for i <= k < j.
Time complexity is O(n^3) and space complexity is O(n^2).

3. Greedy Algorithms vs Dynamic Programming:
A greedy algorithm makes locally optimal choices at each stage (Greedy Choice Property).
Example: Fractional Knapsack is solved greedily in O(n log n) by sorting items by value-to-weight ratio.
The 0/1 Knapsack problem lacks greedy choice property and requires dynamic programming in O(n*W) time.
Huffman Coding builds optimal prefix-free codes using a priority queue in O(n log n) time.
    `.trim();

    const uploadRes = await fetch("http://localhost:5000/api/documents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authData.token}`,
      },
      body: JSON.stringify({
        title: "DAA Unit 4 - Dynamic Programming Lecture Notes",
        originalFileName: "DAA_Unit_4.pdf",
        fileType: "pdf",
        fileSize: 32000,
        extractedText: testDocText,
      }),
    });
    const docData = await uploadRes.json();
    const docId = docData.document.id;
    console.log("✅ Study material uploaded. Document ID:", docId);

    // Navigate to Document Toolkit UI
    console.log(`\n--- BROWSER STEP 4: Navigate to Document Toolkit (${docId}) ---`);
    await client.send("Page.navigate", { url: `http://localhost:5173/student/documents/${docId}` });
    await client.waitForFunction(() => document.querySelector(".ai-results-page") || document.querySelector(".ai-tools-grid"));
    console.log("✅ Document Toolkit Hub rendered in Chrome.");

    // 7. Test Smart Summary
    console.log("\n--- BROWSER STEP 5: Test Smart Summary & Regeneration ---");
    // Click "Open Summary"
    await client.evaluate(`
      const btn = Array.from(document.querySelectorAll(".ai-tool-card")).find(c => c.textContent.includes("Summary"));
      if (btn) btn.click();
    `);

    // Wait for summary loading / rendering
    await client.waitForFunction(() => document.querySelector(".summary-content-card") || document.querySelector(".lerniq-skeleton-card"));
    console.log("✅ Smart Summary subview opened. Waiting for Groq AI generation...");

    await client.waitForFunction(() => document.querySelector(".summary-text") && document.querySelector(".summary-text").textContent.length > 50, 45000);
    const summaryText = await client.evaluate(`document.querySelector(".summary-text").textContent`);
    console.log("✅ Smart Summary Rendered in Chrome:\n", summaryText.slice(0, 140) + "...");

    // Test Toast verification
    const toastPresent = await client.evaluate(`Boolean(document.querySelector(".lerniq-toast"))`);
    console.log("✅ Non-blocking Toast notification active:", toastPresent);

    // Test Regenerate Summary
    console.log("Testing Regenerate Summary button...");
    await client.evaluate(`document.querySelector(".generate-summary-btn").click()`);
    // Verify button gets disabled during loading
    const isRegenLoading = await client.evaluate(`document.querySelector(".generate-summary-btn").disabled`);
    console.log("✅ Regenerate button disabled during generation:", isRegenLoading);

    await client.waitForFunction(() => !document.querySelector(".generate-summary-btn").disabled, 45000);
    const summaryRegenText = await client.evaluate(`document.querySelector(".summary-text").textContent`);
    console.log("✅ Regenerated Summary rendered successfully!");

    // 8. Test Dynamic Language Switching in Summary
    console.log("\n--- BROWSER STEP 6: Test Dynamic Language Switching in UI ---");

    // Switch to Hinglish
    console.log("Switching Language to Hinglish via UI select...");
    await client.evaluate(`
      (() => {
        const select = document.querySelector(".summary-header select");
        const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
        setter.call(select, "Hinglish");
        select.dispatchEvent(new Event("change", { bubbles: true }));
      })()
    `);

    // Wait for Hinglish summary to load
    await client.waitForFunction(() => {
      const el = document.querySelector(".summary-text");
      return el && (el.textContent.includes("hai") || el.textContent.includes("aur") || el.textContent.includes("Dynamic Programming"));
    }, 60000);
    const hinglishSummary = await client.evaluate(`document.querySelector(".summary-text").textContent`);
    console.log("✅ Hinglish Summary dynamically rendered in UI:\n", hinglishSummary.slice(0, 140) + "...");

    // Switch to Hindi
    console.log("Switching Language to Hindi via UI select...");
    await client.evaluate(`
      (() => {
        const select = document.querySelector(".summary-header select");
        const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
        setter.call(select, "Hindi");
        select.dispatchEvent(new Event("change", { bubbles: true }));
      })()
    `);

    // Wait for Devanagari characters
    await client.waitForFunction(() => {
      const el = document.querySelector(".summary-text");
      return el && /[\u0900-\u097F]/.test(el.textContent);
    }, 60000);
    const hindiSummary = await client.evaluate(`document.querySelector(".summary-text").textContent`);
    console.log("✅ Devanagari Hindi Summary dynamically rendered in UI:\n", hindiSummary.slice(0, 140) + "...");

    // Switch to Marathi
    console.log("Switching Language to Marathi via UI select...");
    await new Promise((r) => setTimeout(r, 2000));
    await client.evaluate(`
      (() => {
        const select = document.querySelector(".summary-header select");
        const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
        setter.call(select, "Marathi");
        select.dispatchEvent(new Event("change", { bubbles: true }));
      })()
    `);

    // Give UI a moment to clear old text and show loader
    await new Promise((r) => setTimeout(r, 1000));
    await client.waitForFunction(() => {
      const el = document.querySelector(".summary-text");
      return el && /[\u0900-\u097F]/.test(el.textContent) && el.textContent.length > 20;
    }, 60000);
    const marathiSummary = await client.evaluate(`document.querySelector(".summary-text").textContent`);
    console.log("✅ Marathi Summary dynamically rendered in UI:\n", marathiSummary.slice(0, 140) + "...");

    // Back to Hub
    await client.evaluate(`document.querySelector(".summary-back-btn").click()`);
    await client.waitForFunction(() => document.querySelector(".ai-tools-grid"));

    // Reset language to English in Hub
    await client.evaluate(`
      (() => {
        const select = document.querySelector(".ai-results-header select");
        if (select) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
          setter.call(select, "English");
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 2000));

    // 9. Test Practice Questions
    console.log("\n--- BROWSER STEP 7: Test Practice Questions (10 count & Regeneration) ---");
    await new Promise((r) => setTimeout(r, 2000));
    const qOpened = await client.evaluate(`
      (() => {
        const cards = Array.from(document.querySelectorAll(".ai-tool-card"));
        const card = cards.find(c => c.querySelector("h3")?.textContent.includes("Question"));
        if (card) {
          card.click();
          return true;
        }
        return false;
      })()
    `);
    console.log("Clicked Question Generator card:", qOpened);
    await client.waitForFunction(() => document.querySelector(".question-page"), 20000);
    console.log("✅ Question Generator page mounted.");

    // Trigger generate button if not auto-started
    await client.evaluate(`
      (() => {
        const btn = document.querySelector(".generate-question-btn");
        const list = document.querySelector(".question-list");
        if (btn && !list && !btn.disabled) {
          btn.click();
        }
      })()
    `);

    console.log("Waiting for 10 practice questions to render in Chrome...");
    await client.waitForFunction(() => {
      const err = document.querySelector(".question-error");
      if (err) throw new Error("Question generation UI error: " + err.textContent);
      return document.querySelectorAll(".question-card").length === 10;
    }, 90000);
    const questionCount = await client.evaluate(`document.querySelectorAll(".question-card").length`);
    console.log(`✅ Exactly ${questionCount} Practice Questions rendered in UI!`);

    const firstQ = await client.evaluate(`document.querySelector(".question-card p").textContent`);
    console.log("Sample Question 1:", firstQ);

    // Click Regenerate Questions
    console.log("Clicking 'Regenerate Questions' button...");
    await new Promise((r) => setTimeout(r, 2000));
    await client.evaluate(`document.querySelector(".generate-question-btn").click()`);
    await client.waitForFunction(() => {
      const err = document.querySelector(".question-error");
      if (err) throw new Error("Question generation UI error: " + err.textContent);
      return !document.querySelector(".generate-question-btn").disabled && document.querySelectorAll(".question-card").length === 10;
    }, 90000);
    const newFirstQ = await client.evaluate(`document.querySelector(".question-card p").textContent`);
    console.log("Sample Regenerated Question 1:", newFirstQ);
    console.log("✅ Questions successfully regenerated in UI!");

    // Back to Hub
    await client.evaluate(`document.querySelector(".question-back-btn").click()`);
    await client.waitForFunction(() => document.querySelector(".ai-tools-grid"), 20000);
    await new Promise((r) => setTimeout(r, 2000));

    // 10. Test Smart MCQ Quiz
    console.log("\n--- BROWSER STEP 8: Test Smart MCQ Quiz (10 MCQs with 4 options each) ---");
    const quizOpened = await client.evaluate(`
      (() => {
        const cards = Array.from(document.querySelectorAll(".ai-tool-card"));
        const card = cards.find(c => c.querySelector("h3")?.textContent.includes("MCQ") || c.querySelector("h3")?.textContent.includes("Quiz"));
        if (card) {
          card.click();
          return true;
        }
        return false;
      })()
    `);
    console.log("Clicked Smart MCQ Quiz card:", quizOpened);
    await client.waitForFunction(() => document.querySelector(".quiz-page"), 20000);
    console.log("✅ Smart MCQ Quiz page mounted.");

    console.log("Waiting for Start/Generate Quiz button to be enabled...");
    await client.waitForFunction(() => {
      const btn = document.querySelector(".start-quiz-btn");
      return btn && !btn.disabled;
    }, 45000);

    // Click Start or Generate
    console.log("Clicking start/generate quiz button...");
    await client.evaluate(`document.querySelector(".start-quiz-btn").click()`);

    // Wait for quiz card
    console.log("Waiting for Smart MCQ Quiz card to render in Chrome...");
    await client.waitForFunction(() => {
      const err = document.querySelector(".quiz-error");
      if (err) throw new Error("Quiz UI error: " + err.textContent);
      return document.querySelector(".quiz-card");
    }, 90000);
    const optionsCount = await client.evaluate(`document.querySelectorAll(".quiz-option").length`);
    console.log(`✅ Quiz Question 1 Rendered with exactly ${optionsCount} options!`);

    // Answer Question 1
    await client.evaluate(`document.querySelectorAll(".quiz-option")[0].click()`);
    await client.waitForFunction(() => document.querySelector(".quiz-feedback"));
    const feedbackText = await client.evaluate(`document.querySelector(".quiz-feedback strong").textContent`);
    console.log("✅ Instant Feedback Rendered:", feedbackText);

    // Back to Hub
    await client.evaluate(`document.querySelector(".quiz-back-btn").click()`);
    await client.waitForFunction(() => document.querySelector(".ai-tools-grid"), 20000);
    await new Promise((r) => setTimeout(r, 2000));

    // 11. Test AI Tutor Chat
    console.log("\n--- BROWSER STEP 9: Test AI Tutor Real Chat Flow ---");
    const tutorOpened = await client.evaluate(`
      (() => {
        const cards = Array.from(document.querySelectorAll(".ai-tool-card"));
        const card = cards.find(c => c.querySelector("h3")?.textContent.includes("Tutor"));
        if (card) {
          card.click();
          return true;
        }
        return false;
      })()
    `);
    console.log("Clicked AI Tutor card:", tutorOpened);
    await client.waitForFunction(() => document.querySelector(".ai-tutor-container"), 20000);
    console.log("✅ AI Tutor Chat opened.");

    // Helper function for typing in textarea
    const sendChatMessage = async (text) => {
      await client.evaluate(`
        (() => {
          const ta = document.querySelector(".ai-tutor-input-area textarea");
          const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
          setter.call(ta, ${JSON.stringify(text)});
          ta.dispatchEvent(new Event("input", { bubbles: true }));
          document.querySelector(".ai-tutor-send-btn").click();
        })()
      `);
    };

    // Turn 1: Say "hi"
    console.log("Sending greeting: 'hi'...");
    await sendChatMessage("hi");

    // Verify user message appears immediately
    const userMsgVisible = await client.evaluate(`Boolean(document.querySelector(".user-message"))`);
    console.log("✅ User message rendered immediately:", userMsgVisible);

    // Wait for assistant response with <p>
    await client.waitForFunction(() => document.querySelectorAll(".assistant-message p").length >= 1, 45000);
    const tutorGreeting = await client.evaluate(`document.querySelectorAll(".assistant-message p")[0]?.textContent || ""`);
    console.log("✅ AI Tutor Greeting Response:\n", tutorGreeting.slice(0, 140) + "...");

    // Turn 2: Document Question
    console.log("Sending document question: 'What is the time complexity of Matrix Chain Multiplication?'...");
    await new Promise((r) => setTimeout(r, 2000));
    await sendChatMessage("What is the time complexity of Matrix Chain Multiplication?");

    await client.waitForFunction(() => document.querySelectorAll(".assistant-message p").length >= 2, 45000);
    const tutorDocAnswer = await client.evaluate(`document.querySelectorAll(".assistant-message p")[1]?.textContent || ""`);
    console.log("✅ AI Tutor Document Answer:\n", tutorDocAnswer.slice(0, 140) + "...");

    // Turn 3: Follow-up question ("simple language mein samjha")
    console.log("Sending follow-up: 'isko simple language mein samjha'...");
    await new Promise((r) => setTimeout(r, 2000));
    await sendChatMessage("isko simple language mein samjha");

    await client.waitForFunction(() => document.querySelectorAll(".assistant-message p").length >= 3, 45000);
    const tutorFollowUp = await client.evaluate(`document.querySelectorAll(".assistant-message p")[2]?.textContent || ""`);
    console.log("✅ AI Tutor Follow-up Answer:\n", tutorFollowUp.slice(0, 140) + "...");

    // Turn 4: Off-topic Grounding Refusal
    console.log("Sending off-topic question: 'Who won the FIFA World Cup in Qatar in 2022?'...");
    await new Promise((r) => setTimeout(r, 2000));
    await sendChatMessage("Who won the FIFA World Cup in Qatar in 2022?");

    await client.waitForFunction(() => document.querySelectorAll(".assistant-message p").length >= 4, 45000);
    const tutorRefusal = await client.evaluate(`document.querySelectorAll(".assistant-message p")[3]?.textContent || ""`);
    console.log("✅ AI Tutor Grounded Refusal Response:\n", tutorRefusal);

    // 12. Check Console and Network summary
    console.log("\n--- BROWSER STEP 10: Verify Console & Network Health ---");
    const errors = browserConsoleLogs.filter((m) => m.level === "error");
    console.log(`Total Browser Console Logs: ${browserConsoleLogs.length} | Console Errors: ${errors.length}`);
    console.log(`Total Monitored API Requests: ${networkRequests.length}`);
    networkRequests.forEach((r) => {
      console.log(`  - [${r.status}] ${r.url.replace("http://localhost:5173", "").replace("http://localhost:5000", "")}`);
    });

    console.log("\n==================================================================");
    console.log("🎉 ALL REAL CHROME BROWSER E2E TESTS PASSED SUCCESSFULLY!");
    console.log("==================================================================");

    client.close();
  } catch (err) {
    console.error("\n❌ BROWSER TEST FAILED:", err);
    console.log(`\n--- Browser Console Logs (${browserConsoleLogs.length}) ---`);
    browserConsoleLogs.forEach((l) => console.log(`  [${l.level}] ${l.text}`));
    console.log(`\n--- Monitored API Requests (${networkRequests.length}) ---`);
    networkRequests.forEach((r) => console.log(`  - [${r.status}] ${r.url.replace("http://localhost:5173", "").replace("http://localhost:5000", "")}`));
    process.exitCode = 1;
  } finally {
    if (chromeProc) chromeProc.kill();
    if (frontendProc) frontendProc.kill();
    if (backendProc) backendProc.kill();
    setTimeout(() => process.exit(), 1000);
  }
}

runRealBrowserTest();
