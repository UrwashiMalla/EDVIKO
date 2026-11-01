import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import studentImage from "../assets/student/student.png";

function TeacherLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const { loginTeacher } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!email || !password) {
      setErrorMessage("Please enter your educator email and password.");
      return;
    }

    setLoading(true);

    try {
      await loginTeacher(email.trim().toLowerCase(), password);
      navigate("/teacher/dashboard");
    } catch (err) {
      setErrorMessage(err.message || "Failed to log in as Teacher. Please check your credentials.");
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
          <p className="login-small-title">FACULTY & MENTOR PORTAL</p>
          <h1>
            Welcome Faculty,
            <br />
            <span>Guide & Inspire! 👨‍🏫</span>
          </h1>
          <p>
            Monitor your students' learning progress, manage classroom materials, and review real-time quiz accuracy analytics on EDVIKO.
          </p>
        </div>

        <motion.img
          src={studentImage}
          alt="Faculty portal"
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
          <p className="login-hello">Hello Professor 👋</p>
          <h2>Faculty Login</h2>
          <p className="login-subtitle">Access your educator monitoring dashboard</p>

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

          <form onSubmit={handleLogin} className="login-form">
            <div className="input-group">
              <label>Faculty Email Address</label>
              <div className="input-wrapper">
                <span>✉️</span>
                <input
                  type="email"
                  placeholder="e.g. instructor@university.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
              <Link to="/student/login" style={{ fontSize: "13px", color: "#6b46c1", textDecoration: "none" }}>
                Student Login →
              </Link>
            </div>

            <motion.button
              type="submit"
              className="login-button"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              <span>{loading ? "Authenticating..." : "Login to Faculty Portal"}</span>
              <span>→</span>
            </motion.button>
          </form>

          {/* New Teacher Signup Link */}
          <div style={{ marginTop: "20px", textAlign: "center", padding: "13px", background: "rgba(245, 243, 255, 0.85)", borderRadius: "14px", border: "1px solid #ddd6fe" }}>
            <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
              New Educator?{" "}
              <Link to="/teacher/signup" style={{ color: "#7c3aed", fontWeight: "700", textDecoration: "none" }}>
                Register Faculty Account →
              </Link>
            </p>
          </div>

          <p className="signup-text" style={{ marginTop: "20px" }}>
            Need student access instead?{" "}
            <button
              type="button"
              className="signup-button"
              onClick={() => navigate("/student/login")}
            >
              Student Portal
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default TeacherLogin;
