import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth/mammoth.browser";
import { createWorker } from "tesseract.js";
import { recognizeImageQuestion } from "./imageOcrHelper";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

// Comprehensive list of programming, script, and configuration file extensions
export const CODE_EXTENSIONS = new Set([
  "js", "jsx", "ts", "tsx", "mjs", "cjs",
  "py", "ipynb",
  "java", "kt", "kts",
  "c", "cpp", "cc", "cxx", "h", "hpp", "cs",
  "html", "htm", "css", "scss", "sass", "less",
  "sql",
  "json", "xml", "yaml", "yml", "toml",
  "sh", "bash", "zsh", "bat", "ps1",
  "php", "rb", "go", "rs", "swift", "r", "m", "dart", "scala", "lua", "asm",
]);

// Image file extensions
export const IMAGE_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "webp", "bmp", "tiff", "gif",
]);

/**
 * Determine high-level category for backend schema:
 * "pdf" | "docx" | "code" | "image" | "text" | "other"
 */
export const getFileCategory = (file) => {
  if (!file) return "other";
  const ext = (file.name || "").split(".").pop().toLowerCase();
  if (ext === "pdf" || file.type === "application/pdf") return "pdf";
  if (ext === "docx" || ext === "doc" || file.type?.includes("wordprocessingml")) return "docx";
  if (IMAGE_EXTENSIONS.has(ext) || file.type?.startsWith("image/")) return "image";
  if (CODE_EXTENSIONS.has(ext)) return "code";
  return "text";
};

/**
 * Universal text extractor for all study document types:
 * - PDF (digital + scanned OCR fallback)
 * - Word docs (DOCX, DOC)
 * - Images (JPG, JPEG, PNG, WEBP with OCR)
 * - Code files (Python, JS, Java, C++, HTML, SQL, etc.)
 * - Plain text / Markdown / CSV
 */
export const extractTextFromFile = async (file, onProgress = null) => {
  if (!file) throw new Error("No file selected.");
  const fileName = file.name.toLowerCase();
  const ext = fileName.split(".").pop().toLowerCase();

  // ==========================================
  // 1. PDF EXTRACTION
  // ==========================================
  if (ext === "pdf" || file.type === "application/pdf") {
    const arrayBuffer = await file.arrayBuffer();

    // Use unpkg URLs for standard fonts and cmaps to parse all font styles reliably
    const cMapUrl = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || "6.3.289"}/cmaps/`;
    const standardFontDataUrl = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || "6.3.289"}/standard_fonts/`;

    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapUrl,
      cMapPacked: true,
      standardFontDataUrl,
    }).promise;

    let totalWordsCount = 0;
    let completeText = "";

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      if (onProgress) onProgress(`Reading page ${pageNumber} of ${pdf.numPages}...`);
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => (typeof item.str === "string" ? item.str : ""))
        .join(" ")
        .trim();

      if (pageText) {
        const words = pageText.split(/\s+/).filter(Boolean);
        totalWordsCount += words.length;
        completeText += `\n\n--- Page ${pageNumber} ---\n\n` + pageText;
      }
    }

    // If PDF has no text layer (scanned document / handwritten pages / image-only slides), run OCR!
    if (totalWordsCount < 5) {
      if (onProgress) onProgress(`Scanned image PDF detected. Running OCR on pages...`);
      try {
        const worker = await createWorker("eng");
        const pagesToScan = Math.min(pdf.numPages, 6);
        for (let pageNum = 1; pageNum <= pagesToScan; pageNum++) {
          if (onProgress) onProgress(`Scanning OCR on page ${pageNum} of ${pagesToScan}...`);
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport }).promise;

          const res = await worker.recognize(canvas);
          const ocrText = res?.data?.text?.trim() || "";
          if (ocrText) {
            completeText += `\n\n--- Page ${pageNum} (Scanned OCR) ---\n\n` + ocrText;
            totalWordsCount += ocrText.split(/\s+/).filter(Boolean).length;
          }
        }
        await worker.terminate();
      } catch (ocrErr) {
        console.warn("PDF OCR fallback notice:", ocrErr);
      }
    }

    const clean = completeText.trim();
    if (clean && totalWordsCount >= 3) {
      return clean;
    }

    // Intelligent fallback context for graphical or slide-based PDFs
    const docTitle = file.name.replace(/\.[^/.]+$/, "");
    return `[Uploaded Study Material: ${file.name}]\nThis document "${file.name}" was uploaded for study and exam preparation. It contains ${pdf.numPages} page(s) of visual slides, diagrams, or scanned notes on ${docTitle}. EDVIKO AI Tutor can explain the core concepts of ${docTitle}, answer exam questions, break down formulas, and solve doubts.`;
  }

  // ==========================================
  // 2. WORD DOCUMENTS (DOCX, DOC)
  // ==========================================
  if (ext === "docx" || ext === "doc" || file.type?.includes("wordprocessingml")) {
    if (onProgress) onProgress(`Extracting Word document "${file.name}"...`);
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const clean = (result.value || "").trim();
    if (clean) return clean;

    const docTitle = file.name.replace(/\.[^/.]+$/, "");
    return `[Uploaded Study Document: ${file.name}]\nStudy notes uploaded on ${docTitle}. Master this topic with AI explanations, summaries, and revision questions.`;
  }

  // ==========================================
  // 3. IMAGES (JPG, JPEG, PNG, WEBP, ETC.)
  // ==========================================
  if (IMAGE_EXTENSIONS.has(ext) || file.type?.startsWith("image/")) {
    if (onProgress) onProgress(`Running OCR recognition on image "${file.name}"...`);
    try {
      const ocrResult = await recognizeImageQuestion(file);

      if (ocrResult.isValid && ocrResult.text) {
        return `[Uploaded Study Image / Diagram Notes: ${file.name}]\nExtracted Content:\n${ocrResult.text}\n\nEDVIKO AI Tutor: Explain the concepts in this image, solve any problems, and provide a clear step-by-step breakdown.`;
      }
    } catch (err) {
      console.warn("Image OCR error:", err);
    }

    const docTitle = file.name.replace(/\.[^/.]+$/, "");
    return `[Uploaded Study Diagram / Concept Image: ${file.name}]\nImage uploaded by student for AI study assistance on "${docTitle}". Contains conceptual diagrams, lecture slides, or notebook notes. EDVIKO AI Tutor can explain the core concepts, definitions, and applications.`;
  }

  // ==========================================
  // 4. CODING & SCRIPT FILES
  // ==========================================
  if (CODE_EXTENSIONS.has(ext)) {
    if (onProgress) onProgress(`Reading source code from "${file.name}"...`);
    const codeContent = await file.text();
    const codeLang = ext.toLowerCase();

    return `[Uploaded Source Code File: ${file.name} (${ext.toUpperCase()})]\n\`\`\`${codeLang}\n${codeContent.trim()}\n\`\`\`\n\nEDVIKO AI Tutor Instructions: Analyze this code carefully. Explain its purpose, logic flow, time and space complexity, potential bugs or edge cases, and best practices.`;
  }

  // ==========================================
  // 5. TEXT, MARKDOWN, CSV, LOG, CONFIG
  // ==========================================
  if (
    ext === "txt" ||
    ext === "text" ||
    ext === "md" ||
    ext === "csv" ||
    ext === "tsv" ||
    ext === "rtf" ||
    file.type === "text/plain"
  ) {
    if (onProgress) onProgress(`Reading text notes from "${file.name}"...`);
    const text = await file.text();
    const clean = text.trim();
    if (clean) return clean;
    return `[Uploaded Study Notes: ${file.name}]\nStudy notes uploaded for learning.`;
  }

  // ==========================================
  // 6. GENERAL FALLBACK (TRY READING AS TEXT)
  // ==========================================
  try {
    if (onProgress) onProgress(`Extracting content from "${file.name}"...`);
    const text = await file.text();
    if (text && text.trim().length > 0) {
      return text.trim();
    }
  } catch (err) {
    console.warn("General text read fallback notice:", err);
  }

  const docTitle = file.name.replace(/\.[^/.]+$/, "");
  return `[Uploaded Study Document: ${file.name}]\nStudent uploaded study material on ${docTitle}. Help the student understand this topic, answer questions, and prepare for exams.`;
};
