/**
 * frontendStorage.js
 * Frontend persistence & real-time sync bus for:
 * - Teacher messages & announcements (group broadcast)
 * - Personal direct messages between student & teacher
 * - University/School/College name
 * - Uploaded Notes & Lectures with live sync
 * - Quizzes conducted, student submissions & actual score tracking
 * - Blocked/removed student list
 * - Classroom entry alerts for teachers
 * - Event-driven sync bus for immediate cross-portal updates
 */

const STORAGE_KEYS = {
  INSTITUTION: "lerniq_institution_name",
  TEACHER_SUBJECT: "lerniq_teacher_subject",
  TEACHER_CLASS_CODE: "lerniq_teacher_class_code",
  TEACHER_BROADCASTS: "lerniq_teacher_broadcasts",
  DIRECT_MESSAGES: "lerniq_student_teacher_messages",
  NOTES: "lerniq_uploaded_notes",
  LECTURES: "lerniq_uploaded_lectures",
  QUIZZES: "lerniq_conducted_quizzes",
  STUDENT_ATTEMPTS: "lerniq_student_quiz_attempts",
  REMOVED_STUDENTS: "lerniq_removed_students",
  REMOVED_EMAILS: "lerniq_removed_emails",
  CLASSROOM_ENTRIES: "lerniq_classroom_entries",
  STUDENT_POPUPS: "lerniq_student_popups",
  DISMISSED_POPUPS: "lerniq_dismissed_popups",
  SYNC_HEARTBEAT: "lerniq_sync_heartbeat",
};

// ==========================================
// REAL-TIME SYNC EVENT BUS
// ==========================================
export const notifyLerniqSync = (type, payload = {}) => {
  try {
    const detail = { type, payload, timestamp: Date.now() };
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("lerniq_sync", { detail }));
      localStorage.setItem(STORAGE_KEYS.SYNC_HEARTBEAT, JSON.stringify(detail));
    }
  } catch (err) {
    console.warn("Sync dispatch warning:", err);
  }
};

export const onLerniqSync = (callback) => {
  if (typeof window === "undefined") return () => {};

  const handleCustom = (e) => {
    if (e.detail) callback(e.detail);
  };

  const handleStorage = (e) => {
    if (e.key === STORAGE_KEYS.SYNC_HEARTBEAT && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        callback(parsed);
      } catch {
        // ignore JSON parse errors
      }
    }
  };

  window.addEventListener("lerniq_sync", handleCustom);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener("lerniq_sync", handleCustom);
    window.removeEventListener("storage", handleStorage);
  };
};

// ==========================================
// INSTITUTION & SUBJECT
// ==========================================
export const getInstitutionName = () => {
  return localStorage.getItem(STORAGE_KEYS.INSTITUTION) || "Stanford University";
};

export const setInstitutionName = (name) => {
  if (name && name.trim()) {
    localStorage.setItem(STORAGE_KEYS.INSTITUTION, name.trim());
    notifyLerniqSync("INSTITUTION_UPDATED", { name: name.trim() });
  }
};

export const getTeacherSubject = () => {
  return localStorage.getItem(STORAGE_KEYS.TEACHER_SUBJECT) || "Computer Science & Artificial Intelligence";
};

export const setTeacherSubject = (subj) => {
  if (subj && subj.trim()) {
    localStorage.setItem(STORAGE_KEYS.TEACHER_SUBJECT, subj.trim());
    notifyLerniqSync("SUBJECT_UPDATED", { subject: subj.trim() });
  }
};

// ==========================================
// UNIQUE CLASS CODE FOR TEACHERS
// ==========================================
export const getTeacherClassCode = (teacherId = "default_teacher") => {
  const key = `${STORAGE_KEYS.TEACHER_CLASS_CODE}_${teacherId}`;
  let code = localStorage.getItem(key);
  if (!code) {
    // Generate unique random class code: e.g. TEACH-8K4P
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    code = `TEACH-${rand}`;
    localStorage.setItem(key, code);
  }
  return code;
};

// Default Enrolled Class Students
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
// REMOVED / BLOCKED STUDENTS
// ==========================================
export const getRemovedStudentIds = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.REMOVED_STUDENTS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const getRemovedStudentEmails = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.REMOVED_EMAILS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const isStudentRemoved = (idOrEmail) => {
  if (!idOrEmail) return false;
  const target = String(idOrEmail).toLowerCase().trim();
  const ids = getRemovedStudentIds().map((id) => String(id).toLowerCase());
  const emails = getRemovedStudentEmails().map((e) => String(e).toLowerCase());
  return ids.includes(target) || emails.includes(target);
};

export const addRemovedStudentId = (studentId, studentEmail = null) => {
  if (!studentId) return getRemovedStudentIds();
  const currentIds = getRemovedStudentIds();
  const idStr = String(studentId);
  const updatedIds = currentIds.includes(idStr) ? currentIds : [...currentIds, idStr];
  localStorage.setItem(STORAGE_KEYS.REMOVED_STUDENTS, JSON.stringify(updatedIds));

  if (studentEmail) {
    const currentEmails = getRemovedStudentEmails();
    const emStr = String(studentEmail).toLowerCase().trim();
    if (!currentEmails.includes(emStr)) {
      const updatedEmails = [...currentEmails, emStr];
      localStorage.setItem(STORAGE_KEYS.REMOVED_EMAILS, JSON.stringify(updatedEmails));
    }
  }

  notifyLerniqSync("STUDENT_REMOVED", { studentId: idStr, studentEmail });
  return updatedIds;
};

export const restoreRemovedStudentId = (studentId) => {
  const current = getRemovedStudentIds();
  const idStr = String(studentId);
  const updated = current.filter((id) => id !== idStr);
  localStorage.setItem(STORAGE_KEYS.REMOVED_STUDENTS, JSON.stringify(updated));
  notifyLerniqSync("STUDENT_RESTORED", { studentId: idStr });
  return updated;
};

export const restoreAllRemovedStudents = () => {
  localStorage.removeItem(STORAGE_KEYS.REMOVED_STUDENTS);
  localStorage.removeItem(STORAGE_KEYS.REMOVED_EMAILS);
  notifyLerniqSync("ALL_STUDENTS_RESTORED");
  return [];
};

// ==========================================
// TEACHER BROADCAST (GROUP MESSAGES)
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

  // Trigger pop-up notice for all students
  addStudentPopup({
    id: `popup-${Date.now()}`,
    type: "announcement",
    title: `📢 New Class Announcement: ${title}`,
    message: content,
    sender: teacherName,
    link: "/student/dashboard",
    linkText: "View Announcement",
    timestamp: Date.now(),
  });

  notifyLerniqSync("BROADCAST_CREATED", newBroadcast);
  return updated;
};

export const deleteTeacherBroadcast = (id) => {
  const current = getTeacherBroadcasts();
  const updated = current.filter((item) => item.id !== id);
  localStorage.setItem(STORAGE_KEYS.TEACHER_BROADCASTS, JSON.stringify(updated));
  notifyLerniqSync("BROADCAST_DELETED", { id });
  return updated;
};

// ==========================================
// DIRECT 1-ON-1 MESSAGES (PARTICULAR STUDENT ONLY)
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
    const cleanKey = String(studentKey || "default_student").toLowerCase();
    const data = localStorage.getItem(`${STORAGE_KEYS.DIRECT_MESSAGES}_${cleanKey}`);
    if (!data) {
      if (cleanKey === "default_student" || cleanKey.includes("alexsmith")) {
        localStorage.setItem(`${STORAGE_KEYS.DIRECT_MESSAGES}_${cleanKey}`, JSON.stringify(DEFAULT_DIRECT_MESSAGES));
        return DEFAULT_DIRECT_MESSAGES;
      }
      return [];
    }
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const sendDirectMessage = (studentKey = "default_student", { senderRole, senderName, text, studentName = "Student", type = "chat" }) => {
  const cleanKey = String(studentKey || "default_student").toLowerCase();
  const current = getDirectMessages(cleanKey);
  const newMsg = {
    id: `dm-${Date.now()}`,
    studentId: cleanKey,
    studentName,
    senderRole, // "student" or "teacher"
    senderName,
    text,
    type,
    timestamp: new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
  const updated = [...current, newMsg];
  localStorage.setItem(`${STORAGE_KEYS.DIRECT_MESSAGES}_${cleanKey}`, JSON.stringify(updated));

  // If teacher sent it to student, create a popup notification for that specific student!
  if (senderRole === "teacher") {
    addStudentPopup({
      id: `dm-pop-${Date.now()}`,
      targetStudentKey: cleanKey,
      type: type === "quiz_reminder" ? "reminder" : "message",
      title: type === "quiz_reminder" ? `⏰ Quiz Reminder from ${senderName}` : `💬 Message from ${senderName}`,
      message: text,
      sender: senderName,
      link: type === "quiz_reminder" ? "/student/quizzes" : "/student/dashboard",
      linkText: type === "quiz_reminder" ? "Go to Quizzes" : "Reply Message",
      timestamp: Date.now(),
    });
  }

  notifyLerniqSync("DIRECT_MESSAGE", { studentKey: cleanKey, message: newMsg });
  return updated;
};

// Specialized Quiz Reminder
export const sendQuizReminder = ({ studentId, studentName, studentEmail, quizTitle, teacherName = "Prof. Sarah Jenkins" }) => {
  const text = `Quiz Reminder: Please attempt and complete your quiz "${quizTitle}". Log in and click 'Quizzes' to begin.`;
  
  // Deliver to student ID
  sendDirectMessage(studentId, {
    senderRole: "teacher",
    senderName: teacherName,
    text,
    studentName: studentName || "Student",
    type: "quiz_reminder",
  });

  // Also deliver to student email if different
  if (studentEmail && String(studentEmail).toLowerCase() !== String(studentId).toLowerCase()) {
    sendDirectMessage(studentEmail, {
      senderRole: "teacher",
      senderName: teacherName,
      text,
      studentName: studentName || "Student",
      type: "quiz_reminder",
    });
  }

  notifyLerniqSync("QUIZ_REMINDER_SENT", { studentId, studentEmail, quizTitle });
};

// ==========================================
// TEACHER NOTES
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

  // Pop up for students
  addStudentPopup({
    id: `note-pop-${Date.now()}`,
    type: "note",
    title: `📝 New Notes Available: ${title}`,
    message: description || `Prof. uploaded study notes for ${subject}. Click to view or download.`,
    sender: "Prof. Sarah Jenkins",
    link: "/student/lectures-notes",
    linkText: "View Notes",
    timestamp: Date.now(),
  });

  notifyLerniqSync("NOTE_UPLOADED", newNote);
  return updated;
};

export const deleteNote = (id) => {
  const current = getUploadedNotes();
  const updated = current.filter((note) => note.id !== id);
  localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(updated));
  notifyLerniqSync("NOTE_DELETED", { id });
  return updated;
};

// ==========================================
// TEACHER LECTURES
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

  // Pop up for students
  addStudentPopup({
    id: `lec-pop-${Date.now()}`,
    type: "lecture",
    title: `🎥 New Lecture Uploaded: ${title}`,
    message: description || `A new video lecture has been added to ${subject}.`,
    sender: "Prof. Sarah Jenkins",
    link: "/student/lectures-notes",
    linkText: "Watch Lecture",
    timestamp: Date.now(),
  });

  notifyLerniqSync("LECTURE_UPLOADED", newLecture);
  return updated;
};

export const deleteLecture = (id) => {
  const current = getUploadedLectures();
  const updated = current.filter((lec) => lec.id !== id);
  localStorage.setItem(STORAGE_KEYS.LECTURES, JSON.stringify(updated));
  notifyLerniqSync("LECTURE_DELETED", { id });
  return updated;
};

// ==========================================
// QUIZZES CONDUCTED & STUDENT ATTEMPTS
// ==========================================
const DEFAULT_QUIZZES = [
  {
    id: "quiz-101",
    title: "AI Search Algorithms & Heuristics Quiz",
    subject: "Artificial Intelligence",
    questionCount: 4,
    passingScore: 60,
    timeLimit: 15,
    difficulty: "Medium",
    date: "Oct 25, 2026",
    questions: [
      {
        question: "Which search algorithm is guaranteed to find the shallowest goal node in an unweighted tree?",
        options: ["Depth-First Search (DFS)", "Breadth-First Search (BFS)", "Depth-Limited Search", "Greedy Best-First Search"],
        answerIndex: 1,
        explanation: "BFS explores level by level, ensuring the shallowest solution is found first.",
      },
      {
        question: "For A* graph search to guarantee optimality, the heuristic function h(n) must be:",
        options: ["Consistent (Monotone)", "Inadmissible", "Non-negative and strictly zero", "Always greater than true cost"],
        answerIndex: 0,
        explanation: "Consistency guarantees that optimal path to any visited node has already been found without reopening.",
      },
      {
        question: "What is the worst-case space complexity of Depth-First Search with branching factor b and depth m?",
        options: ["O(b * m)", "O(b^m)", "O(m^b)", "O(1)"],
        answerIndex: 0,
        explanation: "DFS only stores a single path from the root to a leaf along with unexpanded sibling nodes: O(b * m).",
      },
      {
        question: "In Minimax decision trees, what does Alpha-Beta pruning achieve?",
        options: ["Prunes branches that cannot influence the final decision", "Finds approximate suboptimal moves faster", "Eliminates all opponent leaf nodes", "Reduces tree depth by half unconditionally"],
        answerIndex: 0,
        explanation: "Alpha-beta pruning yields the exact same decision as standard Minimax while skipping irrelevant subtrees.",
      },
    ],
    studentRoster: [
      { studentId: "std_101", name: "Alex Smith", email: "alexsmith@lerniq.edu", attempted: true, score: 4, totalQuestions: 4, percentage: 100, completedAt: "Oct 26, 2026, 04:15 PM" },
      { studentId: "std_102", name: "Marcus Chen", email: "marcus.chen@lerniq.edu", attempted: true, score: 3, totalQuestions: 4, percentage: 75, completedAt: "Oct 26, 2026, 05:40 PM" },
      { studentId: "std_103", name: "Elena Rostova", email: "elena.r@lerniq.edu", attempted: true, score: 4, totalQuestions: 4, percentage: 100, completedAt: "Oct 27, 2026, 10:12 AM" },
      { studentId: "std_104", name: "Devin Taylor", email: "devin.t@lerniq.edu", attempted: false, score: 0, totalQuestions: 4, percentage: 0, completedAt: null },
      { studentId: "std_105", name: "Priya Sharma", email: "priya.s@lerniq.edu", attempted: true, score: 3, totalQuestions: 4, percentage: 75, completedAt: "Oct 27, 2026, 03:20 PM" },
      { studentId: "std_106", name: "Lucas Vance", email: "lucas.v@lerniq.edu", attempted: false, score: 0, totalQuestions: 4, percentage: 0, completedAt: null },
      { studentId: "std_107", name: "Sophia Miller", email: "sophia.m@lerniq.edu", attempted: true, score: 3, totalQuestions: 4, percentage: 75, completedAt: "Oct 28, 2026, 01:10 PM" },
      { studentId: "std_108", name: "Hassan Ali", email: "hassan.a@lerniq.edu", attempted: false, score: 0, totalQuestions: 4, percentage: 0, completedAt: null },
    ],
  },
  {
    id: "quiz-102",
    title: "Neural Networks & Backprop Midterm Check",
    subject: "Deep Learning",
    questionCount: 3,
    passingScore: 70,
    timeLimit: 20,
    difficulty: "Difficult",
    date: "Oct 27, 2026",
    questions: [
      {
        question: "What problem occurs during deep network training when gradients vanish through sigmoid activations?",
        options: ["Exploding Weights", "Vanishing Gradient", "Overfitting to Noise", "Dead Neuron Effect"],
        answerIndex: 1,
        explanation: "Sigmoids have maximum derivative of 0.25, leading to exponentially decaying gradients in deep layers.",
      },
      {
        question: "Which optimizer maintains running averages of both the gradients and the second moments of the gradients?",
        options: ["Adam (Adaptive Moment Estimation)", "Vanilla Stochastic Gradient Descent", "Momentum SGD", "Adagrad"],
        answerIndex: 0,
        explanation: "Adam calculates adaptive learning rates from estimates of first and second moments of the gradients.",
      },
      {
        question: "Which activation function is defined as f(x) = max(0, x)?",
        options: ["ReLU", "Softmax", "GELU", "Tanh"],
        answerIndex: 0,
        explanation: "ReLU outputs x if positive, else zero, mitigating the vanishing gradient problem.",
      },
    ],
    studentRoster: [
      { studentId: "std_101", name: "Alex Smith", email: "alexsmith@lerniq.edu", attempted: true, score: 2, totalQuestions: 3, percentage: 67, completedAt: "Oct 28, 2026, 09:30 AM" },
      { studentId: "std_102", name: "Marcus Chen", email: "marcus.chen@lerniq.edu", attempted: true, score: 3, totalQuestions: 3, percentage: 100, completedAt: "Oct 28, 2026, 11:45 AM" },
      { studentId: "std_104", name: "Devin Taylor", email: "devin.t@lerniq.edu", attempted: false, score: 0, totalQuestions: 3, percentage: 0, completedAt: null },
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

export const uploadQuiz = ({
  title,
  subject,
  questionCount = 5,
  passingScore = 60,
  timeLimit = 15,
  difficulty = "Medium",
  questions = [],
}) => {
  const current = getTeacherQuizzes();
  const actualQuestions = questions.length > 0 ? questions : [
    {
      question: `Sample question on ${title}: What is the primary objective of this module?`,
      options: ["Core foundational understanding", "Memory overhead reduction", "Heuristic optimization", "Real-time synchronization"],
      answerIndex: 0,
      explanation: "Foundational conceptual mastery is required for this module.",
    },
  ];

  const newQuiz = {
    id: `quiz-${Date.now()}`,
    title,
    subject: subject || "General",
    questionCount: actualQuestions.length,
    passingScore: Number(passingScore) || 60,
    timeLimit: timeLimit === null || timeLimit === 0 ? null : (Number(timeLimit) || 15),
    difficulty,
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    questions: actualQuestions,
    studentRoster: DEFAULT_STUDENTS_LIST.map((s) => ({
      studentId: s.studentId || s.id,
      name: s.name,
      email: s.email,
      attempted: false,
      score: 0,
      totalQuestions: actualQuestions.length,
      percentage: 0,
      completedAt: null,
    })),
  };

  const updated = [newQuiz, ...current];
  localStorage.setItem(STORAGE_KEYS.QUIZZES, JSON.stringify(updated));

  // Pop up notification for all students
  addStudentPopup({
    id: `quiz-pop-${Date.now()}`,
    type: "quiz",
    title: `🎯 New Quiz Uploaded: ${title}`,
    message: `${actualQuestions.length} Questions (${difficulty}) • ${newQuiz.timeLimit ? `${newQuiz.timeLimit} mins` : "Untimed"}`,
    sender: "Prof. Sarah Jenkins",
    link: "/student/quizzes",
    linkText: "Solve Quiz Now",
    timestamp: Date.now(),
  });

  notifyLerniqSync("QUIZ_UPLOADED", newQuiz);
  return updated;
};

export const deleteQuiz = (id) => {
  const current = getTeacherQuizzes();
  const updated = current.filter((q) => q.id !== id);
  localStorage.setItem(STORAGE_KEYS.QUIZZES, JSON.stringify(updated));
  notifyLerniqSync("QUIZ_DELETED", { id });
  return updated;
};

// ==========================================
// STUDENT QUIZ SUBMISSION & ACTUAL RESULT TRACKING
// ==========================================
export const recordStudentQuizAttempt = ({
  quizId,
  studentId,
  studentName,
  studentEmail,
  score,
  totalQuestions,
  answers = [],
}) => {
  const percentage = Math.round((score / totalQuestions) * 100);
  const completedAt = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // 1. Update in teacher quiz list (studentRoster)
  const quizzes = getTeacherQuizzes();
  const updatedQuizzes = quizzes.map((q) => {
    if (q.id === quizId) {
      const roster = q.studentRoster || [];
      const matchIdx = roster.findIndex(
        (r) =>
          String(r.studentId).toLowerCase() === String(studentId).toLowerCase() ||
          String(r.email).toLowerCase() === String(studentEmail).toLowerCase()
      );

      const attemptRecord = {
        studentId: studentId || "std_101",
        name: studentName || "Student",
        email: studentEmail || "student@lerniq.edu",
        attempted: true,
        score,
        totalQuestions,
        percentage,
        completedAt,
        answers,
      };

      let newRoster;
      if (matchIdx >= 0) {
        newRoster = [...roster];
        newRoster[matchIdx] = attemptRecord;
      } else {
        newRoster = [attemptRecord, ...roster];
      }

      return { ...q, studentRoster: newRoster };
    }
    return q;
  });

  localStorage.setItem(STORAGE_KEYS.QUIZZES, JSON.stringify(updatedQuizzes));

  // 2. Save student's personal record
  try {
    const studentAttemptsKey = `${STORAGE_KEYS.STUDENT_ATTEMPTS}_${String(studentId || studentEmail).toLowerCase()}`;
    const myAttempts = JSON.parse(localStorage.getItem(studentAttemptsKey) || "{}");
    myAttempts[quizId] = {
      quizId,
      score,
      totalQuestions,
      percentage,
      completedAt,
      answers,
    };
    localStorage.setItem(studentAttemptsKey, JSON.stringify(myAttempts));
  } catch (err) {
    console.warn("Could not save personal attempt:", err);
  }

  notifyLerniqSync("QUIZ_ATTEMPT_SUBMITTED", {
    quizId,
    studentId,
    studentName,
    studentEmail,
    score,
    percentage,
  });

  return { success: true, score, percentage, completedAt };
};

export const getStudentQuizAttempt = (quizId, studentKey) => {
  try {
    const key = `${STORAGE_KEYS.STUDENT_ATTEMPTS}_${String(studentKey).toLowerCase()}`;
    const myAttempts = JSON.parse(localStorage.getItem(key) || "{}");
    if (myAttempts[quizId]) return myAttempts[quizId];

    // Fallback: check quiz studentRoster directly
    const quizzes = getTeacherQuizzes();
    const quiz = quizzes.find((q) => q.id === quizId);
    if (quiz && quiz.studentRoster) {
      const record = quiz.studentRoster.find(
        (r) =>
          r.attempted &&
          (String(r.studentId).toLowerCase() === String(studentKey).toLowerCase() ||
            String(r.email).toLowerCase() === String(studentKey).toLowerCase())
      );
      if (record) return record;
    }
    return null;
  } catch {
    return null;
  }
};

// ==========================================
// CLASSROOM ENTRY NOTIFICATIONS (FOR TEACHERS)
// ==========================================
export const logClassroomEntry = ({ studentId, studentName, studentEmail }) => {
  try {
    const entries = getClassroomEntries();
    const newEntry = {
      id: `entry-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      studentId: studentId || "std_unknown",
      studentName: studentName || "Student",
      studentEmail: studentEmail || "student@lerniq.edu",
      timestamp: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      read: false,
    };
    const updated = [newEntry, ...entries].slice(0, 30); // keep last 30 entries
    localStorage.setItem(STORAGE_KEYS.CLASSROOM_ENTRIES, JSON.stringify(updated));
    notifyLerniqSync("STUDENT_ENTERED_CLASS", newEntry);
    return updated;
  } catch {
    return [];
  }
};

export const getClassroomEntries = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CLASSROOM_ENTRIES);
    if (!data) return [];
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const markClassroomEntriesAsRead = () => {
  try {
    const entries = getClassroomEntries().map((e) => ({ ...e, read: true }));
    localStorage.setItem(STORAGE_KEYS.CLASSROOM_ENTRIES, JSON.stringify(entries));
    notifyLerniqSync("CLASSROOM_ENTRIES_READ");
    return entries;
  } catch {
    return [];
  }
};

// ==========================================
// POP-UP NOTIFICATIONS (FOR STUDENTS)
// ==========================================
export const addStudentPopup = (popupData) => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.STUDENT_POPUPS);
    const list = data ? JSON.parse(data) : [];
    const updated = [popupData, ...list].slice(0, 20);
    localStorage.setItem(STORAGE_KEYS.STUDENT_POPUPS, JSON.stringify(updated));
    notifyLerniqSync("NEW_STUDENT_POPUP", popupData);
  } catch (err) {
    console.warn("Popup save error:", err);
  }
};

export const getStudentPopups = (studentKey = null) => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.STUDENT_POPUPS);
    if (!data) return [];
    const list = JSON.parse(data);
    const dismissed = getDismissedPopupIds();

    return list.filter((p) => {
      if (dismissed.includes(p.id)) return false;
      if (p.targetStudentKey && studentKey) {
        const cleanT = String(p.targetStudentKey).toLowerCase();
        const cleanS = String(studentKey).toLowerCase();
        return cleanT === cleanS || cleanT === "default_student";
      }
      return true; // broadcast popups
    });
  } catch {
    return [];
  }
};

export const getDismissedPopupIds = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.DISMISSED_POPUPS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const dismissStudentPopup = (popupId) => {
  try {
    const current = getDismissedPopupIds();
    if (!current.includes(popupId)) {
      const updated = [...current, popupId];
      localStorage.setItem(STORAGE_KEYS.DISMISSED_POPUPS, JSON.stringify(updated));
    }
  } catch (err) {
    console.warn("Dismiss popup error:", err);
  }
};
