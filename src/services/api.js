/**
 * Centralized API Client for EDVIKO
 */

const BASE_URL = import.meta.env.VITE_API_URL || "";

export const apiRequest = async (endpoint, options = {}) => {
  const url = `${BASE_URL}${endpoint}`;

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const token = localStorage.getItem("lerniq_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include", // send cookies
  });

  let data;
  try {
    data = await response.json();
  } catch {
    data = {
      success: false,
      message: `Server returned HTTP ${response.status} (${response.statusText || "Non-JSON response"})`,
    };
  }

  if (!response.ok) {
    const error = new Error(data.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};

// API Endpoints
export const authApi = {
  // Student Auth
  sendSignupOtp: (body) => apiRequest("/api/auth/send-signup-otp", { method: "POST", body: JSON.stringify(body) }),
  verifySignupOtp: (body) => apiRequest("/api/auth/verify-signup-otp", { method: "POST", body: JSON.stringify(body) }),
  sendStudentOtp: (body) => apiRequest("/api/auth/student/send-otp", { method: "POST", body: JSON.stringify(body) }),
  verifyStudentOtp: (body) => apiRequest("/api/auth/student/verify-otp", { method: "POST", body: JSON.stringify(body) }),
  registerStudent: (body) => apiRequest("/api/auth/student/register", { method: "POST", body: JSON.stringify(body) }),
  loginStudent: (body) => apiRequest("/api/auth/student/login", { method: "POST", body: JSON.stringify(body) }),

  // Teacher Auth
  sendTeacherOtp: (body) => apiRequest("/api/auth/teacher/send-otp", { method: "POST", body: JSON.stringify(body) }),
  verifyTeacherOtp: (body) => apiRequest("/api/auth/teacher/verify-otp", { method: "POST", body: JSON.stringify(body) }),
  registerTeacher: (body) => apiRequest("/api/auth/teacher/register", { method: "POST", body: JSON.stringify(body) }),
  loginTeacher: (body) => apiRequest("/api/auth/teacher/login", { method: "POST", body: JSON.stringify(body) }),

  // Forgot Password
  sendForgotPasswordOtp: (body) => apiRequest("/api/auth/forgot-password/send-otp", { method: "POST", body: JSON.stringify(body) }),
  verifyForgotPasswordOtp: (body) => apiRequest("/api/auth/forgot-password/verify-otp", { method: "POST", body: JSON.stringify(body) }),
  resetPassword: (body) => apiRequest("/api/auth/forgot-password/reset", { method: "POST", body: JSON.stringify(body) }),

  // General & Utility
  resendOtp: (body) => apiRequest("/api/auth/resend-otp", { method: "POST", body: JSON.stringify(body) }),
  getMe: () => apiRequest("/api/auth/me"),
  logout: () => apiRequest("/api/auth/logout", { method: "POST" }),
  listTeachers: () => apiRequest("/api/auth/teachers"),
};

export const documentApi = {
  create: (body) => apiRequest("/api/documents", { method: "POST", body: JSON.stringify(body) }),
  getMyDocuments: () => apiRequest("/api/documents"),
  getById: (id, lang = "") => apiRequest(`/api/documents/${id}${lang ? `?lang=${encodeURIComponent(lang)}` : ""}`),
  delete: (id) => apiRequest(`/api/documents/${id}`, { method: "DELETE" }),
};

export const aiApi = {
  getSummary: (body) => apiRequest("/api/ai/summary", { method: "POST", body: JSON.stringify(body) }),
  getQuickNotes: (body) => apiRequest("/api/ai/quick-notes", { method: "POST", body: JSON.stringify(body) }),
  getImportantNotes: (body) => apiRequest("/api/ai/important-notes", { method: "POST", body: JSON.stringify(body) }),
  getQuestions: (body) => apiRequest("/api/ai/questions", { method: "POST", body: JSON.stringify(body) }),
  getQuiz: (body) => apiRequest("/api/ai/quiz", { method: "POST", body: JSON.stringify(body) }),
  askTutor: (body) => apiRequest("/api/ai/tutor", { method: "POST", body: JSON.stringify(body) }),
  getTutorHistory: (docId, lang = "") => apiRequest(`/api/ai/tutor/${docId}${lang ? `?lang=${encodeURIComponent(lang)}` : ""}`),
  clearTutorHistory: (docId, lang = "") => apiRequest(`/api/ai/tutor/${docId}${lang ? `?lang=${encodeURIComponent(lang)}` : ""}`, { method: "DELETE" }),
};

export const quizApi = {
  list: () => apiRequest("/api/quizzes"),
  getById: (id) => apiRequest(`/api/quizzes/${id}`),
  generatePreview: (body) => apiRequest("/api/quizzes/generate-preview", { method: "POST", body: JSON.stringify(body) }),
  publish: (body) => apiRequest("/api/quizzes", { method: "POST", body: JSON.stringify(body) }),
  delete: (id) => apiRequest(`/api/quizzes/${id}`, { method: "DELETE" }),
  getSubmissions: (id) => apiRequest(`/api/quizzes/${id}/submissions`),
  getByDocument: (docId, lang = "") => apiRequest(`/api/quizzes/document/${docId}${lang ? `?lang=${encodeURIComponent(lang)}` : ""}`),
  submitAttempt: (quizId, body) => apiRequest(`/api/quizzes/${quizId}/attempt`, { method: "POST", body: JSON.stringify(body) }),
  getAttempts: (quizId) => apiRequest(`/api/quizzes/${quizId}/attempts`),
};

export const notificationApi = {
  getMyNotifications: () => apiRequest("/api/notifications"),
  markAllRead: () => apiRequest("/api/notifications/mark-all-read", { method: "PUT" }),
  markOneRead: (id) => apiRequest(`/api/notifications/${id}/read`, { method: "PUT" }),
};

export const studentApi = {
  getDashboard: () => apiRequest("/api/students/me/dashboard"),
  updateProfile: (body) => apiRequest("/api/students/me/profile", { method: "PUT", body: JSON.stringify(body) }),
  changeClassroom: (body) => apiRequest("/api/students/classroom/change", { method: "POST", body: JSON.stringify(body) }),
  getBroadcasts: () => apiRequest("/api/students/messages/broadcasts"),
  getDirectMessages: () => apiRequest("/api/students/messages/direct"),
  sendDirectMessage: (body) => apiRequest("/api/students/messages/direct", { method: "POST", body: JSON.stringify(body) }),
};

export const teacherApi = {
  getDashboard: () => apiRequest("/api/teachers/dashboard"),
  getStudents: () => apiRequest("/api/teachers/students"),
  getRemovedStudents: () => apiRequest("/api/teachers/students/removed"),
  getStudentDetails: (studentId) => apiRequest(`/api/teachers/students/${studentId}`),
  getStudentQuizResults: (studentId) => apiRequest(`/api/teachers/students/${studentId}/quiz-results`),
  getDocuments: () => apiRequest("/api/teachers/documents"),
  getQuizResults: () => apiRequest("/api/teachers/quiz-results"),
  removeStudent: (studentId) => apiRequest(`/api/teachers/students/${studentId}`, { method: "DELETE" }),
  unremoveStudent: (studentId) => apiRequest(`/api/teachers/students/${studentId}/unremove`, { method: "POST" }),
  sendBroadcast: (body) => apiRequest("/api/teachers/broadcast", { method: "POST", body: JSON.stringify(body) }),
  getBroadcasts: () => apiRequest("/api/teachers/broadcasts"),
  getConversations: () => apiRequest("/api/teachers/conversations"),
  sendDirectMessage: (studentId, body) => apiRequest(`/api/teachers/students/${studentId}/message`, { method: "POST", body: JSON.stringify(body) }),
  getDirectMessages: (studentId) => apiRequest(`/api/teachers/students/${studentId}/messages`),
};
