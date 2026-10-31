import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth/mammoth.browser";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

/**
 * Extracts plain text from PDF, DOCX, DOC, or TXT file
 */
export const extractTextFromFile = async (file) => {
  if (!file) throw new Error("No file selected.");
  const fileName = file.name.toLowerCase();

  // 1. PDF
  if (fileName.endsWith(".pdf")) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let completeText = "";
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item) => item.str).join(" ");
      completeText += `\n\n--- Page ${pageNumber} ---\n\n` + pageText;
    }
    const clean = completeText.trim();
    if (!clean) {
      throw new Error("Text could not be extracted from this PDF. It may be image-only scanned.");
    }
    return clean;
  }

  // 2. DOCX / DOC
  if (fileName.endsWith(".docx") || fileName.endsWith(".doc")) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const clean = (result.value || "").trim();
    if (!clean) {
      throw new Error("Text could not be extracted from this document.");
    }
    return clean;
  }

  // 3. TXT / Markdown
  if (
    fileName.endsWith(".txt") ||
    fileName.endsWith(".text") ||
    fileName.endsWith(".md") ||
    file.type === "text/plain"
  ) {
    const text = await file.text();
    return text.trim();
  }

  throw new Error("Unsupported format. Please upload a PDF, TXT, DOC, or DOCX file.");
};
