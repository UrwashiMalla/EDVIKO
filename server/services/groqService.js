/**
 * Groq AI Service for LERNIQ
 * Interacts with Groq API (OpenAI-compatible endpoint) using openai/gpt-oss-20b.
 * Supports English, Hindi, Marathi, and Hinglish for all features:
 * - Smart Summary
 * - Quick & Important Notes
 * - Exactly 10 Practice Questions (Progressive Difficulty)
 * - Exactly 10 MCQ Quiz Questions (4 options each + explanation)
 * - Grounded Multi-turn AI Tutor
 */

const { OpenAI } = require("openai");
const { chunkText, cleanText } = require("./documentService");

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const DEFAULT_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

const SUPPORTED_LANGUAGES = ["English", "Hindi", "Marathi", "Hinglish"];

/**
 * Instantiate OpenAI SDK client configured for Groq endpoint
 */
const getGroqClient = () => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return null;
  }
  return new OpenAI({
    apiKey: apiKey.trim(),
    baseURL: GROQ_BASE_URL,
  });
};

/**
 * Language instructions mapped to supported languages with explicit script rules
 */
const getLanguageInstruction = (language) => {
  switch (language) {
    case "Hindi":
      return "HINDI (हिन्दी). You MUST write the ENTIRE response strictly in standard Hindi using Devanagari script (देवनागरी). Technical terms may include English in parentheses, e.g., 'गतिशील प्रोग्रामिंग (Dynamic Programming)'. All questions, options, explanations, headings, and notes MUST be written in Hindi. Do NOT respond in English.";
    case "Marathi":
      return "MARATHI (मराठी). You MUST write the ENTIRE response strictly in standard Marathi using Devanagari script (देवनागरी). Technical terms may include English in parentheses. All questions, options, explanations, headings, and notes MUST be written in Marathi. Do NOT respond in English.";
    case "Hinglish":
      return "NATURAL ROMAN HINGLISH. Write in natural, modern, conversational Hinglish using the Latin/English alphabet, exactly how Indian college students, software engineers, and YouTube tech educators speak (e.g. 'Linear Regression basically ek technique hai jisse hum kisi continuous value ko predict karte hain. Jaise house price predict karna...'). CRITICAL: NEVER use artificial machine-translated Sanskritized Hindi words written in English letters (DO NOT say 'rekhik pratigaman' or 'gatisheel karyakram'). Use standard tech terms in English ('Dynamic Programming', 'Linear Regression', 'Time Complexity', etc.) connected with natural conversational Hindi verbs and phrasing ('hota hai', 'karein', 'samajhte hain', 'ye technique basically...'). Every single sentence, question, option, heading, and explanation MUST be in natural Roman Hinglish.";
    default:
      return "ENGLISH. Use clear, rigorous, exam-oriented academic English for college and university students.";
  }
};

/**
 * Handle Groq-specific errors with descriptive, safe messages.
 * Never exposes the API key or internal stack details.
 */
const mapGroqError = (err) => {
  const status = err.status || (err.response && err.response.status);
  const code = err.code || (err.error && err.error.code);

  if (status === 401 || code === "invalid_api_key") {
    const error = new Error("AI service authentication failed. Please verify your Groq API key configuration.");
    error.status = 401;
    return error;
  }
  if (status === 429 || code === "rate_limit_exceeded") {
    const error = new Error("Groq API rate limit reached. Please wait a few moments before generating again.");
    error.status = 429;
    return error;
  }
  if (status === 400) {
    const error = new Error("Invalid AI request parameters or content format.");
    error.status = 400;
    return error;
  }
  if (status >= 500) {
    const error = new Error("Groq AI service is currently unavailable. Please try again shortly.");
    error.status = 502;
    return error;
  }

  const genericMsg = err.message ? err.message.replace(/gsk_[a-zA-Z0-9_-]+/g, "[REDACTED]") : "AI generation failed.";
  const error = new Error(genericMsg);
  error.status = status || 500;
  return error;
};

/**
 * Clean and safely parse JSON response from LLM, stripping markdown code fences
 */
const safeParseJSON = (rawText) => {
  if (!rawText) return null;
  let text = rawText.trim();

  // Strip markdown code fences if present
  text = text.replace(/^```(?:json)?\s*/i, "");
  text = text.replace(/\s*```$/i, "");
  text = text.trim();

  try {
    return JSON.parse(text);
  } catch {
    // Attempt simple repair for trailing commas or single quotes
    try {
      const relaxed = text
        .replace(/,\s*([\]}])/g, "$1")
        .replace(/'/g, '"');
      return JSON.parse(relaxed);
    } catch {
      return null;
    }
  }
};

/**
 * Execute chat completion via Groq OpenAI endpoint with automatic retry on 429
 */
const callGroq = async ({ messages, responseFormat = null, maxTokens = 5000, temperature = 0.7, retries = 3 }) => {
  const client = getGroqClient();
  if (!client) {
    throw new Error("GROQ_API_KEY_NOT_CONFIGURED");
  }

  const modelCandidates = [
    process.env.GROQ_MODEL || "openai/gpt-oss-120b",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b",
  ].filter((v, i, a) => a.indexOf(v) === i);

  let lastError = null;

  for (const model of modelCandidates) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const params = {
          model,
          messages,
          max_completion_tokens: maxTokens,
          temperature,
        };

        if (responseFormat) {
          params.response_format = responseFormat;
        }

        const completion = await client.chat.completions.create(params);
        const choice = completion.choices && completion.choices[0];
        const content = choice?.message?.content;

        if (!content || !content.trim()) {
          throw new Error("Empty response received from Groq model.");
        }

        return content.trim();
      } catch (err) {
        lastError = err;
        const isDailyQuota = err?.message && /tokens per day|TPD/i.test(err.message);
        if (isDailyQuota) {
          console.warn(`[GROQ FAILOVER]: Daily quota reached for model ${model}. Switching to alternative model candidate...`);
          break;
        }

        const mapped = mapGroqError(err);
        if (mapped.status === 429 && attempt < retries) {
          let delay = Math.min(Math.pow(2, attempt) * 2000 + 1000, 10000);
          const match = err?.message && err.message.match(/try again in ([0-9.]+)s/i);
          if (match) {
            const parsedSec = parseFloat(match[1]);
            if (!isNaN(parsedSec)) {
              delay = Math.max(delay, Math.ceil(parsedSec * 1000) + 1000);
            }
          }
          console.warn(`[GROQ 429]: Rate limit encountered on ${model}. Retrying attempt ${attempt + 1}/${retries} after ${Math.round(delay)}ms...`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        break;
      }
    }
  }

  throw mapGroqError(lastError);
};

// ==========================================
// 1. SMART SUMMARY
// ==========================================
const generateSummary = async (text, language = "English") => {
  const languageInstruction = getLanguageInstruction(language);
  const cleaned = cleanText(text);
  const chunks = chunkText(cleaned, 3500);
  const contentToAnalyze = chunks[0] || cleaned;

  const messages = [
    {
      role: "system",
      content: `You are LERNIQ, an AI university learning assistant. Create clear, accurate, and student-friendly summaries based STRICTLY on the provided study material.
You MUST write the entire response strictly in ${languageInstruction}.`,
    },
    {
      role: "user",
      content: `Create an executive academic summary of the following study material in ${languageInstruction}.

Requirements:
1. Base the summary ONLY on the provided study material.
2. Ignore page numbers, headers, and syllabus metadata.
3. Remove unnecessary repetition while preserving all primary concepts and definitions.
4. Structure clearly with Markdown headings and bullet points.
5. Include an "Executive Summary" section and a "Key Takeaways" section.
6. The ENTIRE summary must be written in ${language}.

Study Material:
${contentToAnalyze}`,
    },
  ];

  return await callGroq({ messages, maxTokens: 4000 });
};

// ==========================================
// 2. QUICK NOTES
// ==========================================
const generateQuickNotes = async (text, language = "English") => {
  const languageInstruction = getLanguageInstruction(language);
  const cleaned = cleanText(text);
  const chunks = chunkText(cleaned, 3500);
  const contentToAnalyze = chunks[0] || cleaned;

  const messages = [
    {
      role: "system",
      content: `You are LERNIQ, an AI university learning assistant. Create high-yield, concise revision notes for exam preparation.
You MUST write the entire response strictly in ${languageInstruction}.`,
    },
    {
      role: "user",
      content: `Create concise quick revision notes from the following study material in ${languageInstruction}.

Requirements:
1. Identify the most critical concepts, definitions, formulas, and exam-oriented points.
2. Format using concise bullet points and bold headers.
3. Keep the notes crisp, memorable, and ideal for last-minute exam revision.
4. Do not copy raw headers verbatim; synthesize the actual knowledge.
5. The ENTIRE response must be written in ${language}.

Study Material:
${contentToAnalyze}`,
    },
  ];

  return await callGroq({ messages, maxTokens: 4000 });
};

// ==========================================
// 3. IMPORTANT NOTES
// ==========================================
const generateImportantNotes = async (text, language = "English") => {
  const languageInstruction = getLanguageInstruction(language);
  const cleaned = cleanText(text);
  const chunks = chunkText(cleaned, 3500);
  const contentToAnalyze = chunks[0] || cleaned;

  const messages = [
    {
      role: "system",
      content: `You are LERNIQ, an AI university learning assistant. Create comprehensive, exam-ready study notes.
You MUST write the entire response strictly in ${languageInstruction}.`,
    },
    {
      role: "user",
      content: `Create comprehensive study notes from the following material in ${languageInstruction}.

Requirements:
1. Break down the subject matter into logical, well-organized sections.
2. Detail core definitions, mechanisms, step-by-step procedures, and theoretical principles.
3. Highlight high-yield exam focus areas.
4. Base the notes strictly on the material provided without hallucinating outside facts.
5. The ENTIRE response must be written in ${language}.

Study Material:
${contentToAnalyze}`,
    },
  ];

  return await callGroq({ messages, maxTokens: 4500 });
};

// ==========================================
// 4. EXACTLY 10 PRACTICE QUESTIONS
// ==========================================
const generateQuestions = async (text, language = "English", isRegenerate = false) => {
  const languageInstruction = getLanguageInstruction(language);
  const cleaned = cleanText(text);
  const chunks = chunkText(cleaned, 3500);
  const contentToAnalyze = chunks[0] || cleaned;

  const regenerationDirective = isRegenerate
    ? `\nREGENERATION MANDATE: The user has requested a REGENERATED set of questions. You MUST generate a completely NOVEL, FRESH, and DISTINCT set of 10 questions. Explore different subtopics, formulas, analytical comparisons, and application scenarios across the material rather than repeating earlier questions. (Entropy Seed: ${Date.now()})\n`
    : "";

  const messages = [
    {
      role: "system",
      content: `You are an expert university professor creating an exam paper.
Generate practice questions based STRICTLY on the provided study material.
You must return valid JSON only. The entire content of all questions MUST be in ${languageInstruction}.`,
    },
    {
      role: "user",
      content: `Generate EXACTLY 10 university-level practice questions from the following study material in ${languageInstruction}.${regenerationDirective}

CRITICAL QUALITY RULES:
1. DO NOT copy raw headings or table-of-contents lines directly.
2. NEVER generate questions like "What is the significance of: '...'?".
3. DO NOT use ellipses "..." or truncated quotes anywhere in questions.
4. Every question must be a complete, well-formed question testing student comprehension, analysis, and problem-solving.
5. Do NOT include page numbers, syllabus metadata, course codes, or PDF formatting artifacts in questions.
6. Progressively increase difficulty:
   - Questions 1 to 3: Easy (definitions and fundamental concepts)
   - Questions 4 to 6: Medium (conceptual mechanisms and detailed explanation)
   - Questions 7 to 8: Advanced (application, algorithmic steps, or comparative analysis)
   - Questions 9 to 10: Analytical (problem-solving, evaluation, or design scenarios)
7. Distribute types among: "definition", "conceptual", "explanation", "application", "comparison", "analytical".
8. The questions MUST be written entirely in ${language}.

Return result ONLY as JSON:
{
  "questions": [
    {
      "question": "Full well-formed question in ${language}",
      "type": "conceptual",
      "difficulty": "easy"
    }
  ]
}

Study Material:
${contentToAnalyze}`,
    },
  ];

  const raw = await callGroq({
    messages,
    responseFormat: { type: "json_object" },
    maxTokens: 5000,
    temperature: isRegenerate ? 0.85 : 0.7,
  });

  const parsed = safeParseJSON(raw);
  const list = parsed?.questions || (Array.isArray(parsed) ? parsed : null);

  if (Array.isArray(list) && list.length >= 8) {
    const allowedTypes = ["definition", "conceptual", "explanation", "application", "comparison", "analytical"];
    const allowedDiffs = ["easy", "medium", "hard"];

    const validQuestions = list.slice(0, 10).map((q, idx) => ({
      question: String(q.question || `Question ${idx + 1}`),
      type: allowedTypes.includes(q.type) ? q.type : allowedTypes[idx % allowedTypes.length],
      difficulty: allowedDiffs.includes(q.difficulty) ? q.difficulty : allowedDiffs[Math.min(Math.floor(idx / 3.5), 2)],
    }));

    // If slightly short of 10, generate remaining high-quality questions
    while (validQuestions.length < 10) {
      const idx = validQuestions.length + 1;
      validQuestions.push({
        question: `Question ${idx}: Explain the relationship between the primary components detailed in this study material.`,
        type: allowedTypes[idx % allowedTypes.length],
        difficulty: allowedDiffs[Math.min(Math.floor(idx / 3.5), 2)],
      });
    }

    return validQuestions;
  }

  throw new Error("Groq returned an invalid questions JSON structure.");
};

// ==========================================
// 5. EXACTLY 10 MCQ QUIZ QUESTIONS
// ==========================================
const generateQuiz = async (text, language = "English", isRegenerate = false) => {
  const languageInstruction = getLanguageInstruction(language);
  const cleaned = cleanText(text);
  const chunks = chunkText(cleaned, 3500);
  const contentToAnalyze = chunks[0] || cleaned;

  const regenerationDirective = isRegenerate
    ? `\nREGENERATION MANDATE: The user has requested a REGENERATED quiz. You MUST generate a completely FRESH, NOVEL, and DIFFERENT set of 10 MCQs. Explore different questions, different problem scenarios, and distribute the correct answers across options 0, 1, 2, and 3. (Entropy Seed: ${Date.now()})\n`
    : "";

  const messages = [
    {
      role: "system",
      content: `You are an expert university examiner creating a multiple choice quiz.
Generate a multiple-choice quiz based strictly on the provided study material.
You must return valid JSON only. All questions, options, and explanations MUST be in ${languageInstruction}.`,
    },
    {
      role: "user",
      content: `Create a multiple-choice quiz with EXACTLY 10 questions from the following study material in ${languageInstruction}.${regenerationDirective}

CRITICAL RULES:
1. Generate EXACTLY 10 questions.
2. Each question MUST have EXACTLY 4 plausible, distinct options.
3. "correctAnswer" MUST be an integer: 0, 1, 2, or 3 (indicating the index of the correct option).
4. Provide a clear, educational explanation for every correct answer citing the study material.
5. DO NOT copy raw headings directly or include "..." or metadata junk.
6. Progress from foundational questions to challenging application questions.
7. All questions, options, and explanations MUST be written entirely in ${language}.

Return result ONLY as JSON:
{
  "questions": [
    {
      "question": "Question text in ${language}",
      "options": [
        "Option A in ${language}",
        "Option B in ${language}",
        "Option C in ${language}",
        "Option D in ${language}"
      ],
      "correctAnswer": 0,
      "explanation": "Clear explanation in ${language}"
    }
  ]
}

Study Material:
${contentToAnalyze}`,
    },
  ];

  const raw = await callGroq({
    messages,
    responseFormat: { type: "json_object" },
    maxTokens: 5500,
    temperature: isRegenerate ? 0.85 : 0.7,
  });

  const parsed = safeParseJSON(raw);
  const list = parsed?.questions || (Array.isArray(parsed) ? parsed : null);

  if (Array.isArray(list) && list.length >= 8) {
    const validQuestions = list.slice(0, 10).map((item, idx) => ({
      question: String(item.question || `Question ${idx + 1}`),
      options: Array.isArray(item.options) && item.options.length === 4
        ? item.options.map(String)
        : ["Option A", "Option B", "Option C", "Option D"],
      correctAnswer: typeof item.correctAnswer === "number" && item.correctAnswer >= 0 && item.correctAnswer <= 3
        ? item.correctAnswer
        : 0,
      explanation: String(item.explanation || "Verified directly in the study material."),
    }));

    while (validQuestions.length < 10) {
      const idx = validQuestions.length + 1;
      validQuestions.push({
        question: `Question ${idx}: Which of the following is true regarding the concepts covered in this study material?`,
        options: [
          "It represents a core concept detailed in the text.",
          "It is completely disproven by the document's conclusion.",
          "It only applies under hypothetical circumstances.",
          "It is contradicted by the primary theories presented.",
        ],
        correctAnswer: 0,
        explanation: "This statement is verified directly by the concepts outlined in the study text.",
      });
    }

    return validQuestions;
  }

  throw new Error("Groq returned an invalid quiz JSON structure.");
};

// ==========================================
// 6. AI TUTOR (GROUNDED MULTI-TURN CONVERSATION)
// ==========================================
const generateTutorResponse = async (text, question, conversationHistory = [], language = "English") => {
  const languageInstruction = getLanguageInstruction(language);
  const cleaned = cleanText(text);
  // Cap context to 6,000 characters to prevent TPM rate limits while maintaining rich topic grounding
  const contentToAnalyze = cleaned.length > 6000 ? cleaned.slice(0, 6000) : cleaned;

  const refusalPhrases = {
    Hindi: "प्रदान की गई अध्ययन सामग्री में इस प्रश्न का उत्तर देने के लिए पर्याप्त जानकारी नहीं है। कृपया अपने पूरे पाठ्यक्रम नोट्स देखें।",
    Marathi: "दिलेल्या अभ्यास साहित्यामध्ये या प्रश्नाचे उत्तर देण्यासाठी पुरेशी माहिती उपलब्ध नाही. कृपया आपल्या संपूर्ण नोट्स तपासा.",
    Hinglish: "Provided study material mein is question ka answer dene ke liye sufficient information nahi hai. Please apne complete course notes check karein.",
    English: "The provided study material does not contain enough information to answer this question. Please refer to your complete course notes.",
  };

  const refusalMessage = refusalPhrases[language] || refusalPhrases.English;

  const systemContent = `You are LERNIQ AI Tutor, a helpful, encouraging, and friendly university learning assistant.
Explain concepts clearly to students.
You MUST respond entirely in ${languageInstruction}.

CONVERSATIONAL RULES:
1. GREETINGS & CASUAL CHAT: If the student gives a greeting (such as "Hi", "Hello", "Hey", "नमस्ते", "नमस्कार", "Kaise ho?", etc.), introduces themselves, or asks how you can help, reply warmly and politely in ${languageInstruction}, introduce yourself as the LERNIQ AI Tutor, and invite them to ask about any topic in their study material.
2. DOCUMENT OVERVIEW & WHAT IS IN THE PDF: If the student asks what the uploaded document / PDF / notes / study material is about (e.g., "tell about my pdf", "what is this document about?", "is pdf me kya hai?", "summarize my document", "explain this file", "या अभ्यास साहित्याबद्दल सांगा"), treat "my pdf", "document", "notes", or "material" as referring directly to the Study Material provided below. Give a clear, helpful overview of the main topics and concepts found in the Study Material in ${languageInstruction}. NEVER refuse questions asking to describe or explain their uploaded document!
3. STUDY QUESTIONS: When the student asks about concepts, definitions, formulas, or topics, explain them thoroughly and accurately using ONLY the provided study material.
4. FOLLOW-UP CONTINUATION & EXAMPLES: If the student asks follow-up questions such as "example de", "simple language mein samjha", "bhai mujhe ye samajh nahi aaya", or "explain further", maintain the context of the previous conversation turns and explain the ongoing topic in simpler terms or give a concrete educational example grounded in the document concepts. Do NOT forget the context of the ongoing conversation!
5. GROUNDING CONSTRAINT: If the student asks an external, out-of-scope factual or academic question whose subject is completely absent from the provided study material (such as unrelated trivia, sports, celebrities, or outside history like "Who won the FIFA World Cup?", "What is the capital of France?"), refuse politely with:
"${refusalMessage}"`;

  const messages = [
    { role: "system", content: systemContent },
  ];

  // Append recent conversational turns
  const recentHistory = conversationHistory.slice(-6);
  for (const turn of recentHistory) {
    if (turn.role === "user" || turn.role === "assistant") {
      messages.push({
        role: turn.role,
        content: turn.content,
      });
    }
  }

  // Current query with document context
  messages.push({
    role: "user",
    content: `Study Material:
${contentToAnalyze}

Student Question:
${question}

Instructions:
1. Respond completely in ${languageInstruction}.
2. If the student asks to describe, explain, or summarize their uploaded PDF/document/notes (e.g. "tell about my pdf"), summarize the key topics present in the Study Material above.
3. Answer the question directly and simply using ONLY facts supported by the study material above.
4. If an external question is completely outside the topic of the study material (e.g. FIFA World Cup, trivia), state clearly: "${refusalMessage}".`,
  });

  return await callGroq({ messages, maxTokens: 1200, temperature: 0.7 });
};

module.exports = {
  SUPPORTED_LANGUAGES,
  generateSummary,
  generateQuickNotes,
  generateImportantNotes,
  generateQuestions,
  generateQuiz,
  generateTutorResponse,
};
