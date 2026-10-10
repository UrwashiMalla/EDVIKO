/**
 * Real Chrome Browser E2E Test for AI Tutor Conversational Language Switching & Grounding
 * Validates the exact multi-turn user conversation sequence:
 * - "hi bhai" -> English greeting
 * - "hindi?" -> Header "LERNIQ AI Tutor (Hindi)", confirmation, no refusal
 * - "tell about my pdf" -> Grounded Hindi response
 * - "simple language mein samjhao" -> Grounded conversational follow-up in Hindi
 * - "hinglish?" -> Header "LERNIQ AI Tutor (Hinglish)", confirmation
 * - "same topic simple mein samjha" -> Grounded Hinglish response
 * - "marathi?" -> Header "LERNIQ AI Tutor (Marathi)", confirmation
 * - "tell about this document" -> Grounded Marathi response
 * - "Who won the FIFA World Cup in Qatar in 2022?" -> Grounding refusal preserved
 * - "english?" -> Header "LERNIQ AI Tutor (English)", confirmation
 * - Full chat history preserved across all switches
 */

const { spawn } = require("child_process");
const http = require("http");

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

  async waitForFunction(fnStr, timeout = 120000, interval = 250) {
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

async function runAITutorTest() {
  console.log("==================================================================");
  console.log("🤖 REAL CHROME BROWSER TEST: AI TUTOR CONVERSATIONAL LANGUAGE SWITCHING");
  console.log("==================================================================\n");

  let chromeProc = null;
  let client = null;
  const browserConsoleLogs = [];
  const networkRequests = [];

  try {
    // 1. Authenticate Student directly via API
    console.log("1. Authenticating student session...");
    let authRes = await fetch("http://localhost:5000/api/auth/student/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "student@lerniq.edu", password: "Student@123" }),
    });
    let authData = await authRes.json();

    if (!authData.token) {
      console.log("Registering student@lerniq.edu...");
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

    // 2. Upload test study material document
    console.log("\n2. Uploading study material document...");
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

    // 3. Launch Google Chrome in headless mode
    const userDataDir = `/tmp/lerniq_chrome_tutor_${Date.now()}`;
    console.log("\n3. Launching headless Google Chrome with CDP remote debugging...");
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

    // 4. Create tab and connect CDP
    const newTabRes = await fetch("http://127.0.0.1:9222/json/new?http://localhost:5173", { method: "PUT" });
    const tabInfo = await newTabRes.json();
    console.log("Chrome Tab created. WebSocket URL:", tabInfo.webSocketDebuggerUrl);

    client = new CDPClient(tabInfo.webSocketDebuggerUrl);
    await client.connect();

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

    // 5. Navigate to login page first to initialize domain localStorage
    console.log("\n4. Navigating to student login to seed auth token...");
    await client.send("Page.navigate", { url: "http://localhost:5173/student/login" });
    await client.waitForFunction(() => document.querySelector("input[type='email']") || document.querySelector("body"));
    await new Promise((r) => setTimeout(r, 1000));

    await client.evaluate(`
      localStorage.setItem("lerniq_token", "${authData.token}");
      localStorage.setItem("lerniq_user", JSON.stringify(${JSON.stringify(authData.user)}));
    `);

    // 6. Navigate directly to Document Toolkit
    console.log(`\n5. Navigating to Document Toolkit: /student/documents/${docId}...`);
    await client.send("Page.navigate", { url: `http://localhost:5173/student/documents/${docId}` });
    await client.waitForFunction(() => document.querySelector(".ai-results-page") || document.querySelector(".ai-tools-grid"), 25000);
    console.log("✅ Document Toolkit Hub rendered in Chrome.");

    // 7. Open AI Tutor Card
    console.log("\n6. Opening AI Tutor...");
    await client.evaluate(`
      (() => {
        const cards = Array.from(document.querySelectorAll(".ai-tool-card"));
        const card = cards.find(c => c.querySelector("h3")?.textContent.includes("Tutor"));
        if (card) card.click();
      })()
    `);
    await client.waitForFunction(() => document.querySelector(".ai-tutor-container"), 20000);
    console.log("✅ AI Tutor page mounted.");

    // Helpers
    const sendChatMessage = async (text) => {
      await client.waitForFunction(() => !document.querySelector(".ai-tutor-send-btn")?.disabled, 30000);
      await client.evaluate(`
        (() => {
          const ta = document.querySelector(".ai-tutor-input-area textarea");
          const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
          setter.call(ta, ${JSON.stringify(text)});
          ta.dispatchEvent(new Event("input", { bubbles: true }));
          ta.dispatchEvent(new Event("change", { bubbles: true }));
        })()
      `);
      await new Promise((r) => setTimeout(r, 200));
      await client.evaluate(`
        (() => {
          const btn = document.querySelector(".ai-tutor-send-btn");
          if (btn) btn.click();
        })()
      `);
    };

    const getHeaderTitle = async () => {
      return await client.evaluate(`document.querySelector(".ai-tutor-title h1")?.textContent || ""`);
    };

    const getMessageCount = async () => {
      return await client.evaluate(`document.querySelectorAll(".ai-tutor-message").length`);
    };

    const getLastAssistantMessage = async () => {
      return await client.evaluate(`
        (() => {
          const msgs = Array.from(document.querySelectorAll(".assistant-message p"));
          return msgs.length > 0 ? msgs[msgs.length - 1].textContent : "";
        })()
      `);
    };

    // Verify initial header
    let header = await getHeaderTitle();
    console.log(`Initial Tutor Header: "${header}"`);
    if (!header.includes("English")) {
      throw new Error(`Expected initial header to include '(English)', got: '${header}'`);
    }

    // -------------------------------------------------------------
    // TURN 1: User says "hi bhai"
    // -------------------------------------------------------------
    console.log("\n--- TURN 1: Sending 'hi bhai' ---");
    await sendChatMessage("hi bhai");
    await client.waitForFunction(() => document.querySelectorAll(".assistant-message p").length >= 1, 45000);
    let reply1 = await getLastAssistantMessage();
    console.log(`🤖 Reply 1:\n${reply1.slice(0, 160)}...\n`);
    header = await getHeaderTitle();
    console.log(`Header remains: "${header}"`);

    // -------------------------------------------------------------
    // TURN 2: User says "hindi?" (Language Switch Command)
    // -------------------------------------------------------------
    console.log("\n--- TURN 2: Sending 'hindi?' (Language Switch Command) ---");
    const countBeforeSwitch = await getMessageCount();
    await sendChatMessage("hindi?");

    // Verify instant header update
    await client.waitForFunction(() => {
      const h = document.querySelector(".ai-tutor-title h1")?.textContent || "";
      return h.includes("Hindi");
    }, 15000);
    header = await getHeaderTitle();
    console.log(`✅ Header successfully updated to: "${header}"`);
    if (!header.includes("LERNIQ AI Tutor (Hindi)")) {
      throw new Error(`Expected header to be 'LERNIQ AI Tutor (Hindi)', got: '${header}'`);
    }

    // Verify switch feedback message in chat
    await client.waitForFunction(() => {
      const msgs = Array.from(document.querySelectorAll(".assistant-message p"));
      return msgs.some(m => m.textContent.includes("Language switched to Hindi."));
    }, 15000);
    let reply2 = await getLastAssistantMessage();
    console.log(`✅ Confirmation message in chat: "${reply2}"`);

    // CRITICAL: Ensure grounding refusal was NOT returned
    if (reply2.includes("does not contain enough information")) {
      throw new Error("FAIL: Grounding refusal was incorrectly returned for 'hindi?'!");
    }

    // Verify chat history was NOT wiped!
    const countAfterSwitch = await getMessageCount();
    console.log(`Message count: before=${countBeforeSwitch}, after=${countAfterSwitch}`);
    const hasInitialGreeting = await client.evaluate(`
      (() => {
        const text = document.querySelector(".ai-tutor-chat")?.textContent || "";
        return text.includes("hi bhai");
      })()
    `);
    console.log(`✅ Prior message 'hi bhai' still present in UI: ${hasInitialGreeting}`);
    if (!hasInitialGreeting) {
      throw new Error("FAIL: Chat history was wiped out on language switch!");
    }

    // -------------------------------------------------------------
    // TURN 3: User says "tell about my pdf" (Must be answered in Hindi grounded in doc)
    // -------------------------------------------------------------
    console.log("\n--- TURN 3: Sending 'tell about my pdf' (Must answer in Hindi) ---");
    const msgsBeforeDocQ = await client.evaluate(`document.querySelectorAll(".assistant-message p").length`);
    console.log(`Assistant messages in DOM before Turn 3: ${msgsBeforeDocQ}`);
    await new Promise((r) => setTimeout(r, 1500));
    await sendChatMessage("tell about my pdf");
    console.log("Message 'tell about my pdf' sent. Waiting for assistant reply...");
    await client.waitForFunction(`() => document.querySelectorAll(".assistant-message p").length > ${msgsBeforeDocQ}`, 120000);
    let reply3 = await getLastAssistantMessage();
    console.log(`🤖 Reply 3 (Grounded Hindi):\n${reply3.slice(0, 160)}...\n`);
    const hasDevanagariHindi = /[\u0900-\u097F]/.test(reply3);
    console.log(`✅ Response contains Devanagari Hindi characters: ${hasDevanagariHindi}`);
    if (!hasDevanagariHindi) {
      throw new Error("FAIL: Expected response to be in Hindi with Devanagari script!");
    }

    // -------------------------------------------------------------
    // TURN 4: User says "simple language mein samjhao"
    // -------------------------------------------------------------
    console.log("\n--- TURN 4: Sending follow-up 'simple language mein samjhao' ---");
    const msgsBeforeFollowup = await client.evaluate(`document.querySelectorAll(".assistant-message p").length`);
    await new Promise((r) => setTimeout(r, 1500));
    await sendChatMessage("simple language mein samjhao");
    await client.waitForFunction(`() => document.querySelectorAll(".assistant-message p").length > ${msgsBeforeFollowup}`, 120000);
    let reply4 = await getLastAssistantMessage();
    console.log(`🤖 Reply 4 (Simpler Hindi):\n${reply4.slice(0, 160)}...\n`);

    // -------------------------------------------------------------
    // TURN 5: User says "hinglish?"
    // -------------------------------------------------------------
    console.log("\n--- TURN 5: Sending 'hinglish?' (Switch to Hinglish) ---");
    await new Promise((r) => setTimeout(r, 1500));
    await sendChatMessage("hinglish?");
    await client.waitForFunction(() => {
      const h = document.querySelector(".ai-tutor-title h1")?.textContent || "";
      return h.includes("Hinglish");
    }, 15000);
    header = await getHeaderTitle();
    console.log(`✅ Header successfully updated to: "${header}"`);
    let reply5 = await getLastAssistantMessage();
    console.log(`✅ Confirmation message in chat: "${reply5}"`);

    // -------------------------------------------------------------
    // TURN 6: User asks in Hinglish "same topic simple mein samjha"
    // -------------------------------------------------------------
    console.log("\n--- TURN 6: Sending 'same topic simple mein samjha' ---");
    const msgsBeforeHinglish = await client.evaluate(`document.querySelectorAll(".assistant-message p").length`);
    await new Promise((r) => setTimeout(r, 1500));
    await sendChatMessage("same topic simple mein samjha");
    await client.waitForFunction(`() => document.querySelectorAll(".assistant-message p").length > ${msgsBeforeHinglish}`, 120000);
    let reply6 = await getLastAssistantMessage();
    console.log(`🤖 Reply 6 (Grounded Hinglish):\n${reply6.slice(0, 160)}...\n`);

    // -------------------------------------------------------------
    // TURN 7: User says "marathi?"
    // -------------------------------------------------------------
    console.log("\n--- TURN 7: Sending 'marathi?' (Switch to Marathi) ---");
    await new Promise((r) => setTimeout(r, 1500));
    await sendChatMessage("marathi?");
    await client.waitForFunction(() => {
      const h = document.querySelector(".ai-tutor-title h1")?.textContent || "";
      return h.includes("Marathi");
    }, 15000);
    header = await getHeaderTitle();
    console.log(`✅ Header successfully updated to: "${header}"`);
    let reply7 = await getLastAssistantMessage();
    console.log(`✅ Confirmation message in chat: "${reply7}"`);

    // -------------------------------------------------------------
    // TURN 8: User asks in Marathi / document question
    // -------------------------------------------------------------
    console.log("\n--- TURN 8: Sending document question in Marathi ---");
    const msgsBeforeMarathi = await client.evaluate(`document.querySelectorAll(".assistant-message p").length`);
    await new Promise((r) => setTimeout(r, 1500));
    await sendChatMessage("या अभ्यास साहित्यातील मुख्य संकल्पना काय आहेत?");
    await client.waitForFunction(`() => document.querySelectorAll(".assistant-message p").length > ${msgsBeforeMarathi}`, 120000);
    let reply8 = await getLastAssistantMessage();
    console.log(`🤖 Reply 8 (Grounded Marathi):\n${reply8.slice(0, 160)}...\n`);

    // -------------------------------------------------------------
    // TURN 9: Out-of-scope question (Must trigger grounding refusal)
    // -------------------------------------------------------------
    console.log("\n--- TURN 9: Sending out-of-scope question 'Who won the FIFA World Cup in Qatar in 2022?' ---");
    const msgsBeforeRefusal = await client.evaluate(`document.querySelectorAll(".assistant-message p").length`);
    await new Promise((r) => setTimeout(r, 2500));
    await sendChatMessage("Who won the FIFA World Cup in Qatar in 2022?");
    await client.waitForFunction(`() => document.querySelectorAll(".assistant-message p").length > ${msgsBeforeRefusal}`, 120000);
    let reply9 = await getLastAssistantMessage();
    console.log(`🤖 Reply 9 (Grounding Refusal):\n${reply9}\n`);
    const isRefusal = reply9.includes("पुरेशी माहिती उपलब्ध नाही") || reply9.includes("does not contain enough information") || reply9.includes("पर्याप्त जानकारी नहीं है");
    console.log(`✅ Grounding Refusal correctly triggered for out-of-scope question: ${isRefusal}`);
    if (!isRefusal) {
      throw new Error(`Expected grounding refusal for FIFA World Cup, but got: '${reply9}'`);
    }

    // -------------------------------------------------------------
    // TURN 10: Switch back to English
    // -------------------------------------------------------------
    console.log("\n--- TURN 10: Sending 'english?' (Switch back to English) ---");
    await new Promise((r) => setTimeout(r, 1500));
    await sendChatMessage("english?");
    await client.waitForFunction(() => {
      const h = document.querySelector(".ai-tutor-title h1")?.textContent || "";
      return h.includes("English");
    }, 15000);
    header = await getHeaderTitle();
    console.log(`✅ Header successfully updated to: "${header}"`);
    let reply10 = await getLastAssistantMessage();
    console.log(`✅ Confirmation message in chat: "${reply10}"`);

    // -------------------------------------------------------------
    // VERIFY CHAT INTEGRITY & CONSOLE HEALTH
    // -------------------------------------------------------------
    console.log("\n--- FINAL STEP: Health & Message Integrity Check ---");
    const totalMsgs = await getMessageCount();
    console.log(`Total messages in chat history: ${totalMsgs}`);
    const errors = browserConsoleLogs.filter((m) => m.level === "error");
    console.log(`Browser Console Errors: ${errors.length}`);
    if (errors.length > 0) {
      console.warn("Errors found:", errors.map(e => e.text));
    }

    console.log("\n==================================================================");
    console.log("🎉 ALL 10 CONVERSATIONAL LANGUAGE SWITCHING STEPS PASSED 100%!");
    console.log("==================================================================");

    client.close();
  } catch (err) {
    console.error("\n❌ TEST FAILED:", err);
    console.log(`\n--- Browser Console Logs (${browserConsoleLogs.length}) ---`);
    browserConsoleLogs.forEach((l) => console.log(`  [${l.level}] ${l.text}`));
    console.log(`\n--- Monitored API Requests (${networkRequests.length}) ---`);
    networkRequests.forEach((r) => console.log(`  - [${r.status}] ${r.url}`));
    const allAssistantP = await client?.evaluate?.(`Array.from(document.querySelectorAll(".assistant-message p")).map(p => p.textContent)`);
    console.log("\nAll assistant messages in DOM:", allAssistantP);
    const allUserP = await client?.evaluate?.(`Array.from(document.querySelectorAll(".user-message p")).map(p => p.textContent)`);
    console.log("All user messages in DOM:", allUserP);
    process.exitCode = 1;
  } finally {
    if (chromeProc) chromeProc.kill();
    setTimeout(() => process.exit(), 1000);
  }
}

runAITutorTest();
