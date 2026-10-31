const SUPPORTED_LANGUAGES = ["English", "Hindi", "Marathi", "Hinglish"];

/**
 * Normalizes input language string to one of the canonical supported languages:
 * "English", "Hindi", "Marathi", "Hinglish".
 * Defaults to "English" if invalid or omitted.
 */
const getValidLanguage = (lang) => {
  if (!lang || typeof lang !== "string") return "English";
  const match = SUPPORTED_LANGUAGES.find(
    (l) => l.toLowerCase() === lang.trim().toLowerCase()
  );
  return match || "English";
};

/**
 * Detects if a user message is a language-switch command/query
 * (e.g., "hindi", "hindi?", "in hindi", "hindi mein", "हिंदी में", "marathi?", "मराठीत", "hinglish?", "english?").
 * Returns the canonical language ("English", "Hindi", "Marathi", "Hinglish") or null if not a switch command.
 */
const detectLanguageSwitch = (text) => {
  if (!text || typeof text !== "string") return null;
  const raw = text.trim();
  const cleaned = raw.toLowerCase().replace(/[?!.,;:]+$/, "").trim();

  // If the query is long, it is a content/study question, not a switch command
  const words = cleaned.split(/\s+/);
  if (words.length > 7) return null;

  // Questions asking ABOUT the language itself should be handled as study questions
  if (/\b(history|origin|evolution|grammar|alphabet|script|author|literature|poet|founder|words count|percentage|population|state|country)\b/i.test(cleaned)) {
    return null;
  }
  if (/^(what|why|how|when|who|where|which|kya|kyu|kaise|kon|konta|kiti)\b/i.test(cleaned) && /\b(is|are|was|were|ahe|hote|hota|hai|tha|the)\b/i.test(cleaned)) {
    return null;
  }

  // If user is asking for specific content (joke, riddle, explanation, doubt, question, story), don't treat as a pure switch command
  if (/\b(joke|chutkula|riddle|puzzle|kahani|story|fact|formula|difference|concept|doubt|batao|bata|sunao|suna|padhai|game|quiz|meaning|arth|kya|kyu|kaise|why|what|how)\b/i.test(cleaned)) {
    return null;
  }

  // Devanagari script direct matches
  if (/^(हिंदी|हिन्दी)(\s*(में|मे))?$/i.test(raw.trim().replace(/[?!.,;:]+$/, ""))) return "Hindi";
  if (/^(मराठी|मराठीत)(\s*(मध्ये|त))?$/i.test(raw.trim().replace(/[?!.,;:]+$/, ""))) return "Marathi";
  if (/^(इंग्रजी|इंग्लिश)(\s*(मध्ये|त))?$/i.test(raw.trim().replace(/[?!.,;:]+$/, ""))) return "English";

  const targets = [
    { lang: "Hinglish", regex: /\bhinglish\b/i },
    { lang: "Hindi", regex: /\bhindi\b/i },
    { lang: "Marathi", regex: /\bmarathi\b/i },
    { lang: "English", regex: /\benglish\b/i },
  ];

  for (const { lang, regex } of targets) {
    if (regex.test(cleaned)) {
      // 1. Exact or near-exact matches: "hindi", "hindi?", "in hindi", "hindi mein", "hindi me", "to hindi", "into hindi", "hindi please"
      if (new RegExp(`^(in\\s+|to\\s+|into\\s+)?${lang.toLowerCase()}(\\s*(mein|me|bhasha|language|please))?$`, "i").test(cleaned)) {
        return lang;
      }
      // 2. Command phrases: "switch to hindi", "change to hindi", "talk in hindi", "speak in hindi", "bol in hindi", "hinglish me bolo"
      if (/\b(switch|change|talk|speak|reply|respond|use|set|start|bol|bolo|sang|sanga)\b/i.test(cleaned)) {
        return lang;
      }
      // 3. Short standalone mentions: words <= 4 not containing content keywords
      if (words.length <= 4 && !/\b(explain|what|summary|notes|quiz|material|pdf|document)\b/i.test(cleaned)) {
        return lang;
      }
    }
  }

  return null;
};

module.exports = {
  SUPPORTED_LANGUAGES,
  getValidLanguage,
  detectLanguageSwitch,
};

