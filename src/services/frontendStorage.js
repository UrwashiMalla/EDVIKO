/**
 * frontendStorage.js
 * Frontend-only persistence using localStorage for:
 * - Teacher messages & announcements
 * - Personal direct messages between student & teacher
 * - University/School/College name
 * - Uploaded Notes & Lectures with delete functionality
 * - Quizzes conducted & Student quiz attempt records
 */

const STORAGE_KEYS = {
  INSTITUTION: "lerniq_institution_name",
  TEACHER_SUBJECT: "lerniq_teacher_subject",
  TEACHER_BROADCASTS: "lerniq_teacher_broadcasts",
  DIRECT_MESSAGES: "lerniq_student_teacher_messages",
  NOTES: "lerniq_uploaded_notes",
  LECTURES: "lerniq_uploaded_lectures",
  QUIZZES: "lerniq_conducted_quizzes",
  REMOVED_STUDENTS: "lerniq_removed_students",
};

// Default institution
export const getInstitutionName = () => {
  return localStorage.getItem(STORAGE_KEYS.INSTITUTION) || "Stanford University";
};

export const setInstitutionName = (name) => {
  if (name && name.trim()) {
    localStorage.setItem(STORAGE_KEYS.INSTITUTION, name.trim());
  }
};

// Teacher Subject / Department
export const getTeacherSubject = () => {
  return localStorage.getItem(STORAGE_KEYS.TEACHER_SUBJECT) || "Computer Science & Artificial Intelligence";
};

export const setTeacherSubject = (subj) => {
  if (subj && subj.trim()) {
    localStorage.setItem(STORAGE_KEYS.TEACHER_SUBJECT, subj.trim());
  }
};

// Default Enrolled Class Students for Personal Messaging
export const DEFAULT_STUDENTS_LIST = [
  { id: "default_student", name: "Alex Smith", email: "alexsmith@lerniq.edu", studentId: "std_101" },
  { id: "std_102", name: "Marcus Chen", email: "marcus.chen@lerniq.edu", studentId: "std_102" },
  { id: "std_103", name: "Elena Rostova", email: "elena.r@lerniq.edu", studentId: "std_103" },
  { id: "std_104", name: "Devin Taylor", email: "devin.t@lerniq.edu", studentId: "std_104" },
  { id: "std_105", name: "Priya Sharma", email: "priya.s@lerniq.edu", studentId: "std_105" },
  { id: "std_106", name: "Lucas Vance", email: "lucas.v@lerniq.edu", studentId: "std_106" },
  { id: "std_107", name: "Sophia Miller", email: "sophia.m@lerniq.edu", studentId: "std_107" },
  { id: "std_108", name: "Hassan Ali", email: "hassan.a@lerniq.edu", studentId: "std_108" },
];

// ==========================================
// REMOVED STUDENTS PERSISTENCE (FRONTEND-ONLY)
// ==========================================
export const getRemovedStudentIds = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.REMOVED_STUDENTS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const addRemovedStudentId = (studentId) => {
  if (!studentId) return getRemovedStudentIds();
  const current = getRemovedStudentIds();
  const idStr = String(studentId);
  if (!current.includes(idStr)) {
    const updated = [...current, idStr];
    localStorage.setItem(STORAGE_KEYS.REMOVED_STUDENTS, JSON.stringify(updated));
    return updated;
  }
  return current;
};

export const restoreRemovedStudentId = (studentId) => {
  const current = getRemovedStudentIds();
  const idStr = String(studentId);
  const updated = current.filter((id) => id !== idStr);
  localStorage.setItem(STORAGE_KEYS.REMOVED_STUDENTS, JSON.stringify(updated));
  return updated;
};

export const restoreAllRemovedStudents = () => {
  localStorage.removeItem(STORAGE_KEYS.REMOVED_STUDENTS);
  return [];
};

// ==========================================
// TEACHER BROADCAST MESSAGES / ANNOUNCEMENTS
// ==========================================
const DEFAULT_BROADCASTS = [
  {
    id: "ann-1",
    title: "Midterm Exam Instructions & Topics",
    content: "Please review Chapter 3 (Heuristic Search) and Chapter 4 (Game Theory) before Monday. The practice quiz has also been published on your dashboard.",
    tag: "Announcement",
    priority: "High",
    teacherName: "Prof. Sarah Jenkins",
    date: "Oct 28, 2026 • 10:30 AM",
  },
  {
    id: "ann-2",
    title: "New AI Architecture Notes Uploaded",
    content: "Lecture notes and slide deck for Rational Agent PEAS Framework are now available in the Lectures & Notes section. Feel free to message me if you have any questions.",
    tag: "Materials",
    priority: "Normal",
    teacherName: "Prof. Sarah Jenkins",
    date: "Oct 26, 2026 • 02:15 PM",
  },
];

export const getTeacherBroadcasts = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TEACHER_BROADCASTS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.TEACHER_BROADCASTS, JSON.stringify(DEFAULT_BROADCASTS));
      return DEFAULT_BROADCASTS;
    }
    return JSON.parse(data);
  } catch {
    return DEFAULT_BROADCASTS;
  }
};

export const saveTeacherBroadcast = ({ title, content, tag = "Announcement", priority = "Normal", teacherName = "Prof. Sarah Jenkins" }) => {
  const current = getTeacherBroadcasts();
  const newBroadcast = {
    id: `ann-${Date.now()}`,
    title,
    content,
    tag,
    priority,
    teacherName,
    date: new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
  const updated = [newBroadcast, ...current];
  localStorage.setItem(STORAGE_KEYS.TEACHER_BROADCASTS, JSON.stringify(updated));
  return updated;
};

export const deleteTeacherBroadcast = (id) => {
  const current = getTeacherBroadcasts();
  const updated = current.filter((item) => item.id !== id);
  localStorage.setItem(STORAGE_KEYS.TEACHER_BROADCASTS, JSON.stringify(updated));
  return updated;
};

// ==========================================
// DIRECT 1-ON-1 MESSAGES (STUDENT <-> TEACHER)
// ==========================================
const DEFAULT_DIRECT_MESSAGES = [
  {
    id: "dm-1",
    studentId: "default_student",
    studentName: "Alex Smith",
    senderRole: "teacher",
    senderName: "Prof. Sarah Jenkins",
    text: "Welcome to class, Alex! Feel free to ask any questions here regarding your assignments or quizzes.",
    timestamp: "Oct 27, 2026 • 11:00 AM",
  },
  {
    id: "dm-2",
    studentId: "default_student",
    studentName: "Alex Smith",
    senderRole: "student",
    senderName: "Alex Smith",
    text: "Thank you Professor! I had a quick question regarding question 4 in the search algorithms quiz.",
    timestamp: "Oct 27, 2026 • 11:15 AM",
  },
  {
    id: "dm-3",
    studentId: "default_student",
    studentName: "Alex Smith",
    senderRole: "teacher",
    senderName: "Prof. Sarah Jenkins",
    text: "Check slide 14 on A* consistency proof. Remember that consistency implies admissibility!",
    timestamp: "Oct 27, 2026 • 11:22 AM",
  },
];

export const getDirectMessages = (studentKey = "default_student") => {
  try {
    const data = localStorage.getItem(`${STORAGE_KEYS.DIRECT_MESSAGES}_${studentKey}`);
    if (!data) {
      localStorage.setItem(`${STORAGE_KEYS.DIRECT_MESSAGES}_${studentKey}`, JSON.stringify(DEFAULT_DIRECT_MESSAGES));
      return DEFAULT_DIRECT_MESSAGES;
    }
    return JSON.parse(data);
  } catch {
    return DEFAULT_DIRECT_MESSAGES;
  }
};

export const sendDirectMessage = (studentKey = "default_student", { senderRole, senderName, text, studentName = "Student" }) => {
  const current = getDirectMessages(studentKey);
  const newMsg = {
    id: `dm-${Date.now()}`,
    studentId: studentKey,
    studentName,
    senderRole, // "student" or "teacher"
    senderName,
    text,
    timestamp: new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
  const updated = [...current, newMsg];
  localStorage.setItem(`${STORAGE_KEYS.DIRECT_MESSAGES}_${studentKey}`, JSON.stringify(updated));
  return updated;
};

// ==========================================
// TEACHER NOTES (UPLOAD & HISTORY & DELETE)
// ==========================================
const DEFAULT_NOTES = [
  {
    id: "tnote-1",
    title: "AI Search Algorithms & Heuristics Handout",
    subject: "Artificial Intelligence",
    module: "Unit 1: Problem Formulation",
    date: "Oct 24, 2026",
    fileSize: "1.4 MB",
    pages: "16 Pages",
    description: "Comprehensive notes covering Uninformed (BFS, DFS, UCS) and Informed (Greedy, A*) search algorithms with heuristic admissibility proofs.",
    content: "Heuristic Search: f(n) = g(n) + h(n). Admissibility guarantees optimal path on trees; consistency guarantees optimal path on graphs.",
  },
  {
    id: "tnote-2",
    title: "Neural Networks & Backpropagation Reference Sheet",
    subject: "Deep Learning",
    module: "Unit 3: Gradient Optimization",
    date: "Oct 26, 2026",
    fileSize: "2.1 MB",
    pages: "12 Pages",
    description: "Mathematical formulation of matrix calculus, chain rule decomposition, activation functions (ReLU, Sigmoid, GELU), and Adam optimizer equations.",
    content: "Backpropagation relies on the multivariate chain rule to propagate error gradients backwards from the loss layer to input weights.",
  },
  {
    id: "tnote-3",
    title: "Database Indexing & B-Trees Quick Review",
    subject: "Database Systems",
    module: "Unit 2: Storage & Indexing",
    date: "Oct 27, 2026",
    fileSize: "950 KB",
    pages: "8 Pages",
    description: "Clustered vs non-clustered indexes, B+ tree leaf node pointer traversal, query execution plans, and index selectivity.",
    content: "B+ Trees maintain balanced height with all records at leaf nodes, ensuring O(log N) disk block access.",
  },
];

export const getUploadedNotes = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.NOTES);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(DEFAULT_NOTES));
      return DEFAULT_NOTES;
    }
    return JSON.parse(data);
  } catch {
    return DEFAULT_NOTES;
  }
};

export const uploadNote = ({ title, subject, module = "General", description, content, fileName }) => {
  const current = getUploadedNotes();
  const newNote = {
    id: `tnote-${Date.now()}`,
    title,
    subject,
    module,
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    fileSize: fileName ? "1.8 MB" : "Text Document",
    pages: "5-10 Pages",
    description: description || "Teacher uploaded classroom study notes.",
    content: content || description,
    fileName: fileName || null,
  };
  const updated = [newNote, ...current];
  localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(updated));
  return updated;
};

export const deleteNote = (id) => {
  const current = getUploadedNotes();
  const updated = current.filter((note) => note.id !== id);
  localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(updated));
  return updated;
};

// ==========================================
// TEACHER LECTURES (UPLOAD & HISTORY & DELETE)
// ==========================================
const DEFAULT_LECTURES = [
  {
    id: "tlec-1",
    title: "Introduction to AI & Intelligent Agent Architectures",
    subject: "Artificial Intelligence",
    date: "Oct 24, 2026",
    duration: "42 min",
    videoEmbedUrl: "https://www.youtube.com/embed/JMUxmLyrhSk",
    description: "Detailed analysis of agent architectures, PEAS (Performance, Environment, Actuators, Sensors), deterministic vs stochastic environments, and state-space search formulation.",
    takeaways: [
      "Rationality maximizes expected utility given precepts history.",
      "PEAS description sets the baseline for agent specifications.",
      "Reflex, model-based, goal-based, and utility agent comparisons.",
    ],
  },
  {
    id: "tlec-2",
    title: "State-Space Search & Adversarial Alpha-Beta Pruning",
    subject: "Artificial Intelligence",
    date: "Oct 27, 2026",
    duration: "48 min",
    videoEmbedUrl: "https://www.youtube.com/embed/l-mYLq6e55U",
    description: "Exploring Minimax decision rule in zero-sum game trees, depth cutoff heuristics, and Alpha-Beta bounding to prune suboptimal branches.",
    takeaways: [
      "Minimax gives optimal decisions against optimal opponents.",
      "Alpha-Beta pruning achieves same decision as Minimax with up to 50% fewer node evaluations.",
    ],
  },
];

export const getUploadedLectures = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.LECTURES);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.LECTURES, JSON.stringify(DEFAULT_LECTURES));
      return DEFAULT_LECTURES;
    }
    return JSON.parse(data);
  } catch {
    return DEFAULT_LECTURES;
  }
};

export const uploadLecture = ({ title, subject, duration = "35 min", videoEmbedUrl, description, takeaways = [] }) => {
  const current = getUploadedLectures();
  let validUrl = videoEmbedUrl;
  if (validUrl && validUrl.includes("watch?v=")) {
    validUrl = validUrl.replace("watch?v=", "embed/");
  } else if (!validUrl) {
    validUrl = "https://www.youtube.com/embed/JMUxmLyrhSk";
  }

  const newLecture = {
    id: `tlec-${Date.now()}`,
    title,
    subject,
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    duration: duration.endsWith("min") ? duration : `${duration} min`,
    videoEmbedUrl: validUrl,
    description: description || "Faculty recorded lecture video.",
    takeaways: takeaways.length > 0 ? takeaways : [
      "Key conceptual takeaways summarized by faculty instructor.",
      "Review attached notes for deep dive problem sets.",
    ],
  };
  const updated = [newLecture, ...current];
  localStorage.setItem(STORAGE_KEYS.LECTURES, JSON.stringify(updated));
  return updated;
};

export const deleteLecture = (id) => {
  const current = getUploadedLectures();
  const updated = current.filter((lec) => lec.id !== id);
  localStorage.setItem(STORAGE_KEYS.LECTURES, JSON.stringify(updated));
  return updated;
};

// ==========================================
// QUIZZES CONDUCTED & STUDENT ATTEMPT ANALYTICS
// ==========================================
const DEFAULT_QUIZZES = [
  {
    id: "quiz-101",
    title: "AI Search Algorithms & Heuristics Quiz",
    subject: "Artificial Intelligence",
    questionCount: 10,
    passingScore: 60,
    timeLimit: 15,
    date: "Oct 25, 2026",
    questions: [
      {
        question: "Which search algorithm is guaranteed to find the shallowest goal node in an unweighted tree?",
        options: ["Depth-First Search (DFS)", "Breadth-First Search (BFS)", "Depth-Limited Search", "Greedy Best-First Search"],
        answerIndex: 1,
      },
      {
        question: "For A* graph search to guarantee optimality, the heuristic function h(n) must be:",
        options: ["Consistent (Monotone)", "Inadmissible", "Non-negative and strictly zero", "Always greater than true cost"],
        answerIndex: 0,
      },
    ],
    studentRoster: [
      { studentId: "std_101", name: "Alex Smith", email: "alexsmith@lerniq.edu", attempted: true, score: 90, totalQuestions: 10, completedAt: "Oct 26, 2026, 04:15 PM" },
      { studentId: "std_102", name: "Marcus Chen", email: "marcus.chen@lerniq.edu", attempted: true, score: 80, totalQuestions: 10, completedAt: "Oct 26, 2026, 05:40 PM" },
      { studentId: "std_103", name: "Elena Rostova", email: "elena.r@lerniq.edu", attempted: true, score: 100, totalQuestions: 10, completedAt: "Oct 27, 2026, 10:12 AM" },
      { studentId: "std_104", name: "Devin Taylor", email: "devin.t@lerniq.edu", attempted: false, score: 0, totalQuestions: 10, completedAt: null },
      { studentId: "std_105", name: "Priya Sharma", email: "priya.s@lerniq.edu", attempted: true, score: 70, totalQuestions: 10, completedAt: "Oct 27, 2026, 03:20 PM" },
      { studentId: "std_106", name: "Lucas Vance", email: "lucas.v@lerniq.edu", attempted: false, score: 0, totalQuestions: 10, completedAt: null },
      { studentId: "std_107", name: "Sophia Miller", email: "sophia.m@lerniq.edu", attempted: true, score: 80, totalQuestions: 10, completedAt: "Oct 28, 2026, 01:10 PM" },
      { studentId: "std_108", name: "Hassan Ali", email: "hassan.a@lerniq.edu", attempted: false, score: 0, totalQuestions: 10, completedAt: null },
    ],
  },
  {
    id: "quiz-102",
    title: "Neural Networks & Backprop Midterm Check",
    subject: "Deep Learning",
    questionCount: 8,
    passingScore: 70,
    timeLimit: 20,
    date: "Oct 27, 2026",
    questions: [
      {
        question: "What problem occurs during deep network training when gradients vanish through sigmoid activations?",
        options: ["Exploding Weights", "Vanishing Gradient", "Overfitting to Noise", "Dead Neuron Effect"],
        answerIndex: 1,
      },
    ],
    studentRoster: [
      { studentId: "std_101", name: "Alex Smith", email: "alexsmith@lerniq.edu", attempted: true, score: 75, totalQuestions: 8, completedAt: "Oct 28, 2026, 09:30 AM" },
      { studentId: "std_102", name: "Marcus Chen", email: "marcus.chen@lerniq.edu", attempted: true, score: 88, totalQuestions: 8, completedAt: "Oct 28, 2026, 11:45 AM" },
      { studentId: "std_103", name: "Elena Rostova", email: "elena.r@lerniq.edu", attempted: false, score: 0, totalQuestions: 8, completedAt: null },
      { studentId: "std_104", name: "Devin Taylor", email: "devin.t@lerniq.edu", attempted: false, score: 0, totalQuestions: 8, completedAt: null },
      { studentId: "std_105", name: "Priya Sharma", email: "priya.s@lerniq.edu", attempted: true, score: 63, totalQuestions: 8, completedAt: "Oct 28, 2026, 02:10 PM" },
      { studentId: "std_106", name: "Lucas Vance", email: "lucas.v@lerniq.edu", attempted: true, score: 75, totalQuestions: 8, completedAt: "Oct 28, 2026, 04:05 PM" },
      { studentId: "std_107", name: "Sophia Miller", email: "sophia.m@lerniq.edu", attempted: false, score: 0, totalQuestions: 8, completedAt: null },
      { studentId: "std_108", name: "Hassan Ali", email: "hassan.a@lerniq.edu", attempted: true, score: 88, totalQuestions: 8, completedAt: "Oct 28, 2026, 06:15 PM" },
    ],
  },
  {
    id: "quiz-103",
    title: "Database Indexing & Query Plans Assessment",
    subject: "Database Systems",
    questionCount: 10,
    passingScore: 60,
    timeLimit: 15,
    date: "Oct 28, 2026",
    questions: [
      {
        question: "In a B+ Tree, where are actual record pointers stored?",
        options: ["Only in leaf nodes", "Only in root node", "Evenly distributed across all levels", "In inverted index tables"],
        answerIndex: 0,
      },
    ],
    studentRoster: [
      { studentId: "std_101", name: "Alex Smith", email: "alexsmith@lerniq.edu", attempted: true, score: 90, totalQuestions: 10, completedAt: "Oct 29, 2026, 10:15 AM" },
      { studentId: "std_102", name: "Marcus Chen", email: "marcus.chen@lerniq.edu", attempted: true, score: 70, totalQuestions: 10, completedAt: "Oct 29, 2026, 11:20 AM" },
      { studentId: "std_103", name: "Elena Rostova", email: "elena.r@lerniq.edu", attempted: true, score: 100, totalQuestions: 10, completedAt: "Oct 29, 2026, 01:05 PM" },
      { studentId: "std_104", name: "Devin Taylor", email: "devin.t@lerniq.edu", attempted: true, score: 80, totalQuestions: 10, completedAt: "Oct 29, 2026, 02:45 PM" },
      { studentId: "std_105", name: "Priya Sharma", email: "priya.s@lerniq.edu", attempted: false, score: 0, totalQuestions: 10, completedAt: null },
      { studentId: "std_106", name: "Lucas Vance", email: "lucas.v@lerniq.edu", attempted: false, score: 0, totalQuestions: 10, completedAt: null },
      { studentId: "std_107", name: "Sophia Miller", email: "sophia.m@lerniq.edu", attempted: true, score: 90, totalQuestions: 10, completedAt: "Oct 29, 2026, 04:30 PM" },
      { studentId: "std_108", name: "Hassan Ali", email: "hassan.a@lerniq.edu", attempted: false, score: 0, totalQuestions: 10, completedAt: null },
    ],
  },
];

export const getTeacherQuizzes = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.QUIZZES);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.QUIZZES, JSON.stringify(DEFAULT_QUIZZES));
      return DEFAULT_QUIZZES;
    }
    return JSON.parse(data);
  } catch {
    return DEFAULT_QUIZZES;
  }
};

export const uploadQuiz = ({ title, subject, questionCount = 5, passingScore = 60, timeLimit = 15, questions = [] }) => {
  const current = getTeacherQuizzes();
  const newQuiz = {
    id: `quiz-${Date.now()}`,
    title,
    subject: subject || "General",
    questionCount: questions.length || questionCount,
    passingScore: Number(passingScore) || 60,
    timeLimit: Number(timeLimit) || 15,
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    questions: questions.length > 0 ? questions : [
      {
        question: `Sample question on ${title}: What is the primary objective of this module?`,
        options: ["Core foundational understanding", "Memory overhead reduction", "Heuristic optimization", "Real-time synchronization"],
        answerIndex: 0,
      },
    ],
    studentRoster: [
      { studentId: "std_101", name: "Alex Smith", email: "alexsmith@lerniq.edu", attempted: false, score: 0, totalQuestions: questions.length || questionCount, completedAt: null },
      { studentId: "std_102", name: "Marcus Chen", email: "marcus.chen@lerniq.edu", attempted: false, score: 0, totalQuestions: questions.length || questionCount, completedAt: null },
      { studentId: "std_103", name: "Elena Rostova", email: "elena.r@lerniq.edu", attempted: false, score: 0, totalQuestions: questions.length || questionCount, completedAt: null },
      { studentId: "std_104", name: "Devin Taylor", email: "devin.t@lerniq.edu", attempted: false, score: 0, totalQuestions: questions.length || questionCount, completedAt: null },
      { studentId: "std_105", name: "Priya Sharma", email: "priya.s@lerniq.edu", attempted: false, score: 0, totalQuestions: questions.length || questionCount, completedAt: null },
      { studentId: "std_106", name: "Lucas Vance", email: "lucas.v@lerniq.edu", attempted: false, score: 0, totalQuestions: questions.length || questionCount, completedAt: null },
    ],
  };
  const updated = [newQuiz, ...current];
  localStorage.setItem(STORAGE_KEYS.QUIZZES, JSON.stringify(updated));
  return updated;
};

export const deleteQuiz = (id) => {
  const current = getTeacherQuizzes();
  const updated = current.filter((q) => q.id !== id);
  localStorage.setItem(STORAGE_KEYS.QUIZZES, JSON.stringify(updated));
  return updated;
};
