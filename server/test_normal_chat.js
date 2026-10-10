/**
 * Real-world Casual / Normal Student Interaction Test with LERNIQ AI Tutor API
 */

require("dotenv").config({ path: ".env" });
const { generateTutorResponse } = require("./services/groqService");

const sampleStudyMaterial = `
Machine Learning & Data Science Quick Reference Guide:

1. Supervised Learning:
- Linear Regression: Predicts a continuous outcome variable (Y) based on one or more predictor features (X). Fits a best-fit line minimizing Mean Squared Error (MSE).
- Logistic Regression: A classification algorithm that uses the sigmoid (logistic) function to output probabilities between 0 and 1. Used for binary classification (e.g., spam detection).
- Decision Trees: Models decisions and their possible consequences as a flowchart-like tree structure. Splits on features using metrics like Information Gain or Gini Impurity.

2. Unsupervised Learning:
- K-Means Clustering: Groups unlabeled data into K non-overlapping clusters. Each point is assigned to its closest cluster centroid, and centroids are iteratively updated.
- Principal Component Analysis (PCA): A dimensionality reduction technique that finds the directions (principal components) of maximum variance in high-dimensional data, reducing feature count while preserving key patterns.

3. Neural Networks:
- Composed of input, hidden, and output layers of interconnected artificial neurons. Uses backpropagation and gradient descent to learn non-linear relationships.
`.trim();

async function runCasualStudentTest() {
  console.log("==================================================================");
  console.log("💬 REAL-WORLD NORMAL / CASUAL STUDENT CHAT TEST WITH LERNIQ AI");
  console.log("==================================================================\n");

  const conversationHistory = [];

  const casualPrompts = [
    {
      label: "Turn 1: Casual 'Hi'",
      language: "English",
      input: "Hi",
    },
    {
      label: "Turn 2: Casual Hinglish asking what the document is about",
      language: "Hinglish",
      input: "hello sir, mujhe thoda samjhao na is document me kya hai?",
    },
    {
      label: "Turn 3: Asking a direct concept question in casual language",
      language: "Hinglish",
      input: "Linear regression aur logistic regression me main difference kya hai simple bhasha me?",
    },
    {
      label: "Turn 4: Normal conceptual question in English",
      language: "English",
      input: "what is PCA and why do we use it?",
    },
    {
      label: "Turn 5: Casual Hindi question",
      language: "Hindi",
      input: "K-Means clustering me centroid ka kya kaam hota hai?",
    },
    {
      label: "Turn 6: Casual friendly sign-off",
      language: "Hinglish",
      input: "thanks sir, ache se samajh aa gaya!",
    },
  ];

  for (const item of casualPrompts) {
    console.log(`------------------------------------------------------------------`);
    console.log(`▶ ${item.label}`);
    console.log(`🌐 Language: ${item.language}`);
    console.log(`👤 Student says: "${item.input}"`);
    console.log(`------------------------------------------------------------------`);

    const aiResponse = await generateTutorResponse(
      sampleStudyMaterial,
      item.input,
      conversationHistory,
      item.language
    );

    console.log(`🤖 LERNIQ AI Tutor:\n${aiResponse}\n`);

    // Add to history for realistic multi-turn context
    conversationHistory.push({ role: "user", content: item.input });
    conversationHistory.push({ role: "assistant", content: aiResponse });
  }

  console.log("==================================================================");
  console.log("✅ CASUAL STUDENT CONVERSATION TEST COMPLETED SUCCESSFULLY!");
  console.log("==================================================================");
}

runCasualStudentTest().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
