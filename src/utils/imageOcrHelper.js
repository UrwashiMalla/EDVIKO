import { createWorker } from "tesseract.js";

/**
 * Preprocesses image using HTML Canvas
 * Enhances contrast, converts to grayscale, and sharpens
 * to make pen ink clearly distinguishable from paper lines.
 */
export const preprocessImageForOcr = async (imageFile) => {
  return new Promise((resolve) => {
    if (typeof document === "undefined") return resolve(imageFile);

    const img = new Image();
    const url = URL.createObjectURL(imageFile);

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;

        // Grayscale & contrast enhancement
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;

          // Increase contrast for faint pen strokes
          const factor = 1.4;
          let val = (gray - 128) * factor + 128;
          val = Math.min(255, Math.max(0, val));

          d[i] = val;
          d[i + 1] = val;
          d[i + 2] = val;
        }

        ctx.putImageData(imgData, 0, 0);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          resolve(blob || imageFile);
        }, "image/png");
      } catch (err) {
        URL.revokeObjectURL(url);
        resolve(imageFile);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(imageFile);
    };

    img.src = url;
  });
};

/**
 * Recognizes text from image (handwriting, questions written by pen) using Tesseract.js
 */
export const recognizeImageQuestion = async (imageFile) => {
  try {
    const preprocessed = await preprocessImageForOcr(imageFile);
    const worker = await createWorker("eng");
    const ret = await worker.recognize(preprocessed);
    await worker.terminate();

    const rawText = ret?.data?.text?.trim() || "";
    // Clean up excessive whitespace
    const cleaned = rawText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .join("\n");

    return cleaned;
  } catch (err) {
    console.warn("Handwriting OCR recognition error:", err);
    return "";
  }
};
