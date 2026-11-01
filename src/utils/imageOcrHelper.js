import { createWorker } from "tesseract.js";

/**
 * Preprocesses an image using HTML Canvas:
 * 1. Rescales high-resolution camera photos (e.g. 4000x3000) down to ~1400-1600px
 *    so stroke thickness matches Tesseract's optimal receptive field (2-4px strokes).
 * 2. Applies block-based local adaptive contrast thresholding (binarization):
 *    - Eliminates camera phone shadows and uneven room lighting.
 *    - Fades out faint blue/gray notebook ruled lines.
 *    - Sharpens pen ink (ballpoint, gel pen, pencil) into crisp black on pure white paper.
 */
export const preprocessImageForOcr = async (imageFile) => {
  return new Promise((resolve) => {
    if (typeof document === "undefined") return resolve(imageFile);

    const img = new Image();
    const url = URL.createObjectURL(imageFile);

    img.onload = () => {
      try {
        const maxDim = 1600;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const imgData = ctx.getImageData(0, 0, width, height);
        const d = imgData.data;
        const totalPixels = width * height;

        // 1. Grayscale & compute luminance
        const grayArr = new Uint8ClampedArray(totalPixels);
        let totalLuminance = 0;

        for (let i = 0, p = 0; i < d.length; i += 4, p++) {
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];
          // Blue ink has lower red; pencil/black is low across all channels
          const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
          grayArr[p] = gray;
          totalLuminance += gray;
        }

        const avgLuminance = totalLuminance / totalPixels;

        // 2. Fast block-based adaptive threshold (32x32 blocks)
        // Handles uneven desk lighting, room shadows, and fades ruled notebook lines
        const blockSize = 32;
        const blocksX = Math.ceil(width / blockSize);
        const blocksY = Math.ceil(height / blockSize);
        const blockMeans = new Float32Array(blocksX * blocksY);

        for (let by = 0; by < blocksY; by++) {
          for (let bx = 0; bx < blocksX; bx++) {
            let blockSum = 0;
            let blockCount = 0;
            const startX = bx * blockSize;
            const startY = by * blockSize;
            const endX = Math.min(width, startX + blockSize);
            const endY = Math.min(height, startY + blockSize);

            for (let y = startY; y < endY; y++) {
              const rowOffset = y * width;
              for (let x = startX; x < endX; x++) {
                blockSum += grayArr[rowOffset + x];
                blockCount++;
              }
            }
            blockMeans[by * blocksX + bx] = blockCount > 0 ? blockSum / blockCount : avgLuminance;
          }
        }

        // 3. Apply adaptive binarization
        for (let y = 0; y < height; y++) {
          const by = Math.min(blocksY - 1, Math.floor(y / blockSize));
          const rowOffset = y * width;
          for (let x = 0; x < width; x++) {
            const bx = Math.min(blocksX - 1, Math.floor(x / blockSize));
            const localMean = blockMeans[by * blocksX + bx];
            const pixel = grayArr[rowOffset + x];

            // Pen ink is significantly darker than surrounding paper background.
            // Faint notebook ruled lines (only ~5-8% darker than paper) get eliminated.
            const threshold = localMean * 0.86 - 6;

            const pIdx = (rowOffset + x) * 4;
            if (pixel < threshold) {
              // Ink stroke: crisp black
              d[pIdx] = 0;
              d[pIdx + 1] = 0;
              d[pIdx + 2] = 0;
              d[pIdx + 3] = 255;
            } else {
              // Paper / faint lines: clean pure white
              d[pIdx] = 255;
              d[pIdx + 1] = 255;
              d[pIdx + 2] = 255;
              d[pIdx + 3] = 255;
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          resolve(blob || imageFile);
        }, "image/png");
      } catch (err) {
        console.warn("Image OCR preprocessing notice:", err);
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
 * Validates and cleans OCR output.
 * Filters out stray punctuation artifacts, random 1-letter noise, and notebook line fragments.
 */
export const cleanAndValidateOcrText = (rawText, confidence = 100) => {
  if (!rawText || !rawText.trim()) {
    return { isValid: false, cleanedText: "", validWords: [], confidence: 0 };
  }

  // If Tesseract confidence is critically low, handwriting is not decipherable
  if (confidence < 40) {
    return { isValid: false, cleanedText: "", validWords: [], confidence };
  }

  const lines = rawText.split("\n");
  const validLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 2) continue;

    const alphanumericCount = (trimmed.match(/[a-zA-Z0-9]/g) || []).length;
    const noiseSymbolCount = (trimmed.match(/[^a-zA-Z0-9\s.,?!:;()=+\-*/^]/g) || []).length;

    // Discard line if noise symbols exceed 25% of line length
    if (noiseSymbolCount > 0 && noiseSymbolCount / trimmed.length > 0.25) continue;
    // Discard line if fewer than 2 alphanumeric characters
    if (alphanumericCount < 2) continue;

    const words = trimmed.split(/\s+/).filter(Boolean);
    const realWords = words.filter((w) => /[a-zA-Z0-9]{2,}/.test(w));
    if (words.length >= 2 && realWords.length === 0) continue;

    // Clean stray leading/trailing garbage symbols
    const sanitizedLine = trimmed
      .replace(/^[^a-zA-Z0-9#("']+/g, "")
      .replace(/[^a-zA-Z0-9?.)"'!]+$/g, "")
      .trim();

    if (sanitizedLine.length >= 2) {
      validLines.push(sanitizedLine);
    }
  }

  const cleanedText = validLines.join("\n").trim();
  const allWords = cleanedText.split(/\s+/).filter((w) => /[a-zA-Z0-9]{2,}/.test(w));

  // Compute average word length
  const totalLetters = allWords.reduce((sum, w) => sum + w.length, 0);
  const avgWordLen = allWords.length > 0 ? totalLetters / allWords.length : 0;

  // Genuine academic text/question requires at least 3 valid words and an average word length of >= 2.8
  const isValid = cleanedText.length >= 10 && allWords.length >= 3 && avgWordLen >= 2.8;

  return {
    isValid,
    cleanedText: isValid ? cleanedText : "",
    validWords: allWords,
    confidence,
  };
};

/**
 * Recognizes text from image (handwriting, questions written by pen) using Tesseract.js
 * Returns { isValid, text, confidence }
 */
export const recognizeImageQuestion = async (imageFile) => {
  try {
    const preprocessed = await preprocessImageForOcr(imageFile);
    const worker = await createWorker("eng");
    const ret = await worker.recognize(preprocessed);
    await worker.terminate();

    const rawText = ret?.data?.text?.trim() || "";
    const confidence = ret?.data?.confidence || 0;

    const validation = cleanAndValidateOcrText(rawText, confidence);
    return {
      isValid: validation.isValid,
      text: validation.cleanedText,
      confidence,
    };
  } catch (err) {
    console.warn("Handwriting OCR recognition error:", err);
    return {
      isValid: false,
      text: "",
      confidence: 0,
    };
  }
};
