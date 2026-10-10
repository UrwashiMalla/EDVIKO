/**
 * Document processing and text chunking service
 */

const cleanText = (rawText) => {
  if (!rawText) return "";
  let text = rawText
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // remove control chars
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  // Remove extraction page boundary markers: e.g. "--- Page 1 ---"
  text = text.replace(/---\s*Page\s+\d+\s*---/gi, "\n");

  // Fix words broken across line breaks: e.g. "opti-\nmization" -> "optimization"
  text = text.replace(/([a-zA-Z]{2,})-\n\s*([a-zA-Z]{2,})/g, "$1$2");

  // Clean lines: remove standalone page numbers or header artifacts
  const lines = text.split("\n").map((l) => l.trim());
  const filteredLines = lines.filter((line) => {
    if (!line) return true;
    // Standalone page numbers: e.g. "Page 1", "12", "Page 2 of 50"
    if (/^(?:page\s+)?\d+(?:\s+(?:of|\/)\s+\d+)?$/i.test(line)) return false;
    // Standalone date stamps or numbering noise
    if (/^(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4})$/.test(line)) return false;
    return true;
  });

  return filteredLines
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const getStats = (text) => {
  const cleaned = cleanText(text);
  const words = cleaned ? cleaned.split(/\s+/).filter(Boolean) : [];
  return {
    wordCount: words.length,
    characterCount: cleaned.length,
  };
};

/**
 * Split text into overlapping chunks if it exceeds maxChunkWords
 */
const chunkText = (text, maxChunkWords = 2500, overlapWords = 200) => {
  const cleaned = cleanText(text);
  const words = cleaned.split(/\s+/).filter(Boolean);

  if (words.length <= maxChunkWords) {
    return [cleaned];
  }

  const chunks = [];
  let startIndex = 0;

  while (startIndex < words.length) {
    const endIndex = Math.min(startIndex + maxChunkWords, words.length);
    const chunkWords = words.slice(startIndex, endIndex);
    chunks.push(chunkWords.join(" "));

    if (endIndex >= words.length) break;
    startIndex += maxChunkWords - overlapWords;
  }

  return chunks;
};

/**
 * Validate document before saving or processing
 */
const validateDocumentContent = (text) => {
  const cleaned = cleanText(text);
  if (!cleaned || cleaned.length === 0) {
    return {
      isValid: false,
      error: "Text could not be extracted from this PDF. The document may be empty or image-only scanned without selectable text.",
    };
  }

  const { wordCount } = getStats(cleaned);
  if (wordCount < 10) {
    return {
      isValid: false,
      error: "Document contains insufficient readable text (fewer than 10 words). Please provide a document with study content.",
    };
  }

  return {
    isValid: true,
    cleanedText: cleaned,
    wordCount,
  };
};

module.exports = {
  cleanText,
  getStats,
  chunkText,
  validateDocumentContent,
};
