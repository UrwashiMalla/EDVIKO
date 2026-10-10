import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { motion } from "framer-motion";

export default function Navbar({ activeTab = "dashboard" }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const isTeacher = user?.role === "teacher";

  return (
    <header className="dashboard-navbar">
      <Link to={isTeacher ? "/teacher/dashboard" : "/student/dashboard"} style={{ textDecoration: "none" }}>
        <div className="dashboard-brand">
          <span className="brand-cap">🎓</span>
          <strong>LERNIQ</strong>
        </div>
      </Link>

      <nav className="dashboard-nav">
        {!isTeacher ? (
          <>
            <Link
              to="/student/dashboard"
              className={`nav-link ${activeTab === "dashboard" ? "active" : ""}`}
            >
              Dashboard
            </Link>
            <Link
              to="/student/workspace"
              className={`nav-link ${activeTab === "workspace" ? "active" : ""}`}
            >
              Upload Material
            </Link>
            <Link
              to="/student/documents"
              className={`nav-link ${activeTab === "documents" ? "active" : ""}`}
            >
              My Documents
            </Link>
            <Link
              to="/student/courses"
              className={`nav-link ${activeTab === "courses" ? "active" : ""}`}
            >
              Courses
            </Link>
            <Link
              to="/student/profile"
              className={`nav-link ${activeTab === "profile" ? "active" : ""}`}
            >
              Profile
            </Link>
          </>
        ) : (
          <>
            <Link
              to="/teacher/dashboard"
              className={`nav-link ${activeTab === "dashboard" ? "active" : ""}`}
            >
              Overview
            </Link>
            <Link
              to="/teacher/students"
              className={`nav-link ${activeTab === "students" ? "active" : ""}`}
            >
              My Students
            </Link>
            <Link
              to="/teacher/documents"
              className={`nav-link ${activeTab === "documents" ? "active" : ""}`}
            >
              Student Documents
            </Link>
            <Link
              to="/teacher/quiz-results"
              className={`nav-link ${activeTab === "quiz-results" ? "active" : ""}`}
            >
              Quiz Results
            </Link>
          </>
        )}
      </nav>

      <div className="dashboard-actions">
        <div className="student-profile" style={{ cursor: "pointer" }}>
          <div className="profile-avatar">
            {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
          </div>
          <div className="profile-text">
            <strong>{user?.name || "User"}</strong>
            <small style={{ textTransform: "capitalize" }}>{user?.role || "Student"}</small>
          </div>
        </div>

        <motion.button
          onClick={handleLogout}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          style={{
            marginLeft: "12px",
            padding: "8px 16px",
            background: "#fee2e2",
            color: "#b91c1c",
            border: "none",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: "600",
            cursor: "pointer",
          }}
        >
          Logout
        </motion.button>
      </div>
    </header>
  );
}
