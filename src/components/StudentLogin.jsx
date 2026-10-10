import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import studentImage from "../assets/student/student.png";

function StudentLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const { loginStudent } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!username || !password) {
      setErrorMessage("Please enter both Student ID and password.");
      return;
    }

    setLoading(true);

    try {
      let finalId = username.trim();
      if (!finalId.includes('@')) {
        finalId = finalId + '@lerniq.edu';
      }
      await loginStudent(finalId, password);
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
          <strong>LERNIQ</strong>
        </div>

        <div className="login-welcome">
          <p className="login-small-title">STUDENT LEARNING SPACE</p>
          <h1>
            Welcome Back,
            <br />
            <span>Future Achiever! 🚀</span>
          </h1>
          <p>
            Continue your learning journey, practice your skills, and achieve your academic goals.
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
          <p className="login-hello">Hello Student 👋</p>
          <h2>Student Login</h2>
          <p className="login-subtitle">Access your personalized learning dashboard</p>

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
              }}
            >
              ⚠️ {errorMessage}
            </motion.div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin}>
            {/* Email */}
            <div className="input-group">
              <label>Username</label>
              <div className="input-wrapper">
                <span>🆔</span>
                <input
                  type="text"
                  placeholder="Enter your Username (e.g. rahul123)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password */}
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

            {/* Options */}
            <div className="login-options">
              <label className="remember">
                <input type="checkbox" defaultChecked />
                Remember me
              </label>
              <Link to="/teacher/login" style={{ fontSize: "13px", color: "#6b46c1", textDecoration: "none" }}>
                Teacher Portal →
              </Link>
            </div>

            {/* Login Button */}
            <motion.button
              type="submit"
              className="login-button"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              <span>{loading ? "Logging in..." : "Login"}</span>
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