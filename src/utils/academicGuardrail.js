/**
 * academicGuardrail.js
 * Guardrails for EDVIKO AI Chatbot and Tutor.
 * Allows natural conversation, study breaks, jokes, riddles, greetings, and academic queries
 * to reach the AI response generation layer, while gracefully handling prompt injections.
 */

// Jailbreak / Prompt override attempts
const JAILBREAK_PATTERNS = [
  /\b(ignore (all )?(previous|prior|above) instructions)\b/i,
  /\b(dan mode|jailbreak|developer mode|unrestricted mode)\b/i,
  /\b(bypass (restrictions|guardrails|filters|rules))\b/i,
];

export const getAcademicRefusalMessage = (lang = "English") => {
  switch (lang) {
    case "Hindi":
      return "नमस्ते! मैं EDVIKO का AI अध्ययन साथी हूँ। मैं आपकी पढ़ाई, कॉन्सेप्ट्स और परीक्षा की तैयारी में मदद करने के लिए यहाँ हूँ। बताइए, आज क्या पढ़ना है?";
    case "Marathi":
      return "नमस्कार! मी EDVIKO चा AI अभ्यास मित्र आहे. मी आपल्या अभ्यासात, संकल्पनांमध्ये आणि परीक्षेच्या तयारीत मदत करण्यासाठी येथे आहे. सांगा, आज काय शिकायचे आहे?";
    case "Hinglish":
      return "Hey! Main EDVIKO ka AI study companion hoon. Main yahan aapke doubts solve karne, concepts samjhane aur study sessions ke liye ready hoon. Chalo batao, aaj kaunsa topic padhein?";
    default:
      return "Hello! I'm your EDVIKO AI study companion. I'm here to help you learn, solve academic doubts, and prepare for exams. What subject or topic shall we dive into today?";
  }
};

/**
 * Checks if a user prompt is a malicious prompt injection attempt.
 * Normal casual conversations, greetings, study breaks, jokes, and general questions
 * are intentionally NOT blocked here so the AI response generation layer can handle them naturally.
 */
export const isNonStudyQuery = (text) => {
  if (!text || typeof text !== "string") return false;
  const clean = text.trim().toLowerCase();

  // Only flag explicit adversarial prompt injections/jailbreaks
  for (const jb of JAILBREAK_PATTERNS) {
    if (jb.test(clean)) {
      return true;
    }
  }

  // Allow all natural conversations, jokes, mood, study breaks, hobbies, and queries to reach the AI layer
  return false;
};
