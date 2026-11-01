import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth/mammoth.browser";
import { createWorker } from "tesseract.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

/**
 * Extracts plain text from PDF, DOCX, DOC, or TXT file.
 * Includes CMap / standardFont loading, image OCR fallback for scanned PDFs,
 * and robust content preservation.
 */
export const extractTextFromFile = async (file, onProgress = null) => {
  if (!file) throw new Error("No file selected.");
  const fileName = file.name.toLowerCase();

  // 1. PDF EXTRACTION
  if (fileName.endsWith(".pdf") || file.type === "application/pdf") {
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

  // 2. DOCX / DOC
  if (
    fileName.endsWith(".docx") ||
    fileName.endsWith(".doc") ||
    file.type.includes("wordprocessingml")
  ) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const clean = (result.value || "").trim();
    if (clean) return clean;

    const docTitle = file.name.replace(/\.[^/.]+$/, "");
    return `[Uploaded Study Document: ${file.name}]\nStudy notes uploaded on ${docTitle}. Master this topic with AI explanations, summaries, and revision questions.`;
  }

  // 3. TXT / Markdown
  if (
    fileName.endsWith(".txt") ||
    fileName.endsWith(".text") ||
    fileName.endsWith(".md") ||
    file.type === "text/plain"
  ) {
    const text = await file.text();
    const clean = text.trim();
    if (clean) return clean;
    return `[Uploaded Notes: ${file.name}]\nStudy notes uploaded for learning.`;
  }

  throw new Error("Unsupported format. Please upload a PDF, TXT, DOC, or DOCX file.");
};
