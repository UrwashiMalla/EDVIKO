import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import ProtectedRoute from "./components/ProtectedRoute";

import RoleSelection from "./components/RoleSelection";
import StudentLogin from "./components/StudentLogin";
import StudentSignup from "./components/StudentSignup";
import StudentOTP from "./components/StudentOTP";
import StudentDashboard from "./components/StudentDashboard";
import LearningWorkspace from "./components/LearningWorkspace";
import StudentDocuments from "./components/StudentDocuments";
import AILearningResults from "./components/AILearningResults";
import SmartMCQQuiz from "./components/SmartMCQQuiz";
import StudentProfile from "./components/StudentProfile";
import LecturesNotes from "./components/LecturesNotes";
import AIChatbot from "./components/AIChatbot";

import TeacherLogin from "./components/TeacherLogin";
import TeacherDashboard from "./components/TeacherDashboard";
import TeacherStudents from "./components/TeacherStudents";
import TeacherStudentDetail from "./components/TeacherStudentDetail";
import TeacherDocuments from "./components/TeacherDocuments";
import TeacherQuizResults from "./components/TeacherQuizResults";

import "./App.css";
import "./styles/mobileResponsive.css";

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
        <Routes>
          {/* Public Landing & Role Selection */}
          <Route path="/" element={<RoleSelection />} />

          {/* Student Auth */}
          <Route path="/student/login" element={<StudentLogin />} />
          <Route path="/student/signup" element={<StudentSignup />} />
          <Route path="/student/verify-otp" element={<StudentOTP />} />

          {/* Student Protected Routes */}
          <Route
            path="/student/dashboard"
            element={
              <ProtectedRoute role="student">
                <StudentDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student/workspace"
            element={
              <ProtectedRoute role="student">
                <LearningWorkspace />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student/documents"
            element={
              <ProtectedRoute role="student">
                <StudentDocuments />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student/documents/:id"
            element={
              <ProtectedRoute role="student">
                <AILearningResults />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student/quiz/:id"
            element={
              <ProtectedRoute role="student">
                <SmartMCQQuiz />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student/profile"
            element={
              <ProtectedRoute role="student">
                <StudentProfile />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student/lectures-notes"
            element={
              <ProtectedRoute role="student">
                <LecturesNotes />
              </ProtectedRoute>
            }
          />

          {/* Backwards compatibility for courses */}
          <Route
            path="/student/courses"
            element={
              <ProtectedRoute role="student">
                <LecturesNotes />
              </ProtectedRoute>
            }
          />

          {/* AI Chatbot where students can talk */}
          <Route
            path="/student/chat"
            element={
              <ProtectedRoute role="student">
                <AIChatbot />
              </ProtectedRoute>
            }
          />

          <Route
            path="/student/ai-chat"
            element={
              <ProtectedRoute role="student">
                <AIChatbot />
              </ProtectedRoute>
            }
          />

          {/* Teacher Auth */}
          <Route path="/teacher/login" element={<TeacherLogin />} />

          {/* Teacher Protected Routes */}
          <Route
            path="/teacher/dashboard"
            element={
              <ProtectedRoute role="teacher">
                <TeacherDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/teacher/students"
            element={
              <ProtectedRoute role="teacher">
                <TeacherStudents />
              </ProtectedRoute>
            }
          />

          <Route
            path="/teacher/students/:studentId"
            element={
              <ProtectedRoute role="teacher">
                <TeacherStudentDetail />
              </ProtectedRoute>
            }
          />

          <Route
            path="/teacher/students/:id"
            element={
              <ProtectedRoute role="teacher">
                <TeacherStudentDetail />
              </ProtectedRoute>
            }
          />

          <Route
            path="/teacher/documents"
            element={
              <ProtectedRoute role="teacher">
                <TeacherDocuments />
              </ProtectedRoute>
            }
          />

          <Route
            path="/teacher/quiz-results"
            element={
              <ProtectedRoute role="teacher">
                <TeacherQuizResults />
              </ProtectedRoute>
            }
          />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
