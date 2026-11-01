import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { isStudentRemoved, logClassroomEntry } from "../services/frontendStorage";
import studentImage from "../assets/student/student.png";

function StudentLogin() {
  const location = useLocation();
  const [username, setUsername] = useState(
    location.state?.registeredUsername || location.state?.registeredEmail || ""
  );
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successNotice, setSuccessNotice] = useState(
    location.state?.registeredUsername
      ? "🎉 Account verified & created successfully! Please enter your password to log in."
      : ""
  );

  const { loginStudent } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessNotice("");

    if (!username || !password) {
      setErrorMessage("Please enter both Email/Username and password.");
      return;
    }

    setLoading(true);

    try {
      const finalId = username.trim();

      // Check if student was removed by teacher
      if (isStudentRemoved(finalId) || isStudentRemoved(username.trim())) {
        setErrorMessage("Access Denied: You have been removed from the class by your teacher and cannot log in again with this email.");
        setLoading(false);
        return;
      }

      const res = await loginStudent(finalId, password);

      // Log student entering class
      logClassroomEntry({
        studentId: res?.user?.id || finalId,
        studentName: res?.user?.name || username.trim(),
        studentEmail: res?.user?.email || finalId,
      });

      navigate("/student/dashboard");
    } catch (err) {
      if (err.data?.requiresOtp) {
        navigate(`/student/verify-otp?email=${encodeURIComponent(username.trim())}`);
      } else {
        setErrorMessage(err.message || "Failed to log in. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Left Illustration Section */}
      <motion.div
        className="login-intro"
        initial={{ opacity: 0, x: -100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7 }}
      >
        <div className="login-logo">
          <span>🎓</span>
          <strong>EDVIKO</strong>
        </div>

        <div className="login-welcome">
          <p className="login-small-title">STUDENT LEARNING SPACE</p>
          <h1>
            Welcome Back,
            <br />
            <span>Future Achiever! 🚀</span>
          </h1>
          <p>
            Continue your learning journey on EDVIKO, practice with smart AI tutors, and track your classroom growth.
          </p>
        </div>

        <motion.img
          src={studentImage}
          alt="Student learning"
          className="login-student-image"
          initial={{ opacity: 0, scale: 0.7, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        />
      </motion.div>

      {/* Login Card */}
      <motion.div
        className="login-card"
        initial={{ opacity: 0, x: 100, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.15 }}
      >
        <button className="back-button" onClick={() => navigate("/")}>
          ← Choose another role
        </button>

        <div className="login-card-content">
          <p className="login-hello">Hello Learner 👋</p>
          <h2>Welcome Back!</h2>
          <p className="login-subtitle">Enter your credentials to access your student space</p>

          {successNotice && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                marginBottom: "16px",
                padding: "10px 14px",
                borderRadius: "10px",
                background: "#f0fdf4",
                color: "#15803d",
                fontSize: "13px",
                fontWeight: 500,
                border: "1px solid #bbf7d0",
              }}
            >
              {successNotice}
            </motion.div>
          )}

          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                marginBottom: "16px",
                padding: "10px 14px",
                borderRadius: "10px",
                background: "#fef2f2",
                color: "#b91c1c",
                fontSize: "14px",
                fontWeight: 500,
                border: "1px solid #fecaca",
              }}
            >
              ⚠️ {errorMessage}
            </motion.div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label>Email or Username</label>
              <div className="input-wrapper">
                <span>🆔</span>
                <input
                  type="text"
                  placeholder="Enter your Email or Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="input-group">
              <label>Password</label>
              <div className="input-wrapper">
                <span>🔒</span>
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="login-options">
              <label className="remember">
                <input type="checkbox" defaultChecked />
                Remember me
              </label>
              <Link to="/teacher/login" style={{ fontSize: "13px", color: "#6b46c1", textDecoration: "none" }}>
                Faculty Portal →
              </Link>
            </div>

            <motion.button
              type="submit"
              className="login-button"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              <span>{loading ? "Logging in..." : "Login to Student Portal"}</span>
              <span>→</span>
            </motion.button>
          </form>

          {/* Sign Up Link */}
          <p className="signup-text" style={{ marginTop: "24px" }}>
            Don't have an account?{" "}
            <button
              type="button"
              className="signup-button"
              onClick={() => navigate("/student/signup")}
            >
              Sign Up
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default StudentLogin;
