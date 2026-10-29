import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../services/api";
import studentImage from "../assets/student/student.png";
import "./StudentSignup.css";

function StudentSignup() {
  const [name, setName] = useState("");
    const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [teacherCode, setTeacherCode] = useState("");
  const [availableTeachers, setAvailableTeachers] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        const res = await authApi.listTeachers();
        if (res.teachers) {
          setAvailableTeachers(res.teachers);
          if (res.teachers.length > 0) {
            setTeacherCode((prev) => prev || res.teachers[0].teacherCode);
          }
        }
      } catch {
        // Teacher listing is optional
      }
    };
    fetchTeachers();
  }, []);

  const getPasswordStrength = () => {
    if (!password) return 0;
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const passwordStrength = getPasswordStrength();

  const handleSignup = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!name || !password || !confirmPassword) {
      setErrorMessage("Please complete all required fields.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    if (!agree) {
      setErrorMessage("Please accept the Terms & Privacy Policy to continue.");
      return;
    }

    setLoading(true);

    try {
      const res = await authApi.registerStudent({
        name: name.trim(),
        email: name.trim(),
        password,
        teacherCode: teacherCode.trim(),
      });

      alert(`Success! Your Username is: ${res.studentId}
Please use this username to log in.`);
      navigate(`/student/login`);
    } catch (err) {
      setErrorMessage(err.message || "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-page">
      {/* LEFT SIDE */}
      <motion.section
        className="signup-visual"
        initial={{ opacity: 0, x: -60 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7 }}
      >
        <div className="signup-logo">
          <span className="signup-logo-icon">🎓</span>
          <strong>EDVIKO</strong>
        </div>

        <div className="signup-visual-content">
          <div className="signup-badge">✨ PERSONALIZED LEARNING</div>
          <h1>
            Your learning
            <br />
            journey starts
            <br />
            <span>here. 🚀</span>
          </h1>
          <p>
            Create your profile and let EDVIKO personalize your learning experience with Groq AI.
          </p>
        </div>

        <motion.img
          src={studentImage}
          alt="Student learning"
          className="signup-student-image"
          initial={{ opacity: 0, scale: 0.75, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        />
      </motion.section>

      {/* RIGHT SIDE */}
      <motion.section
        className="signup-form-section"
        initial={{ opacity: 0, x: 70 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7 }}
      >
        <div className="signup-card">
          <button className="signup-back" onClick={() => navigate("/student/login")}>
            ← Back to Login
          </button>

          <div className="signup-progress">
            <div className="progress-label">
              <span>STEP 1 OF 2</span>
              <span>50%</span>
            </div>
            <div className="progress-track">
              <div className="progress-value"></div>
            </div>
          </div>

          <div className="signup-heading">
            <div className="signup-welcome-icon">👋</div>
            <div>
              <p className="signup-small-title">WELCOME TO EDVIKO</p>
              <h2>Create your profile</h2>
            </div>
          </div>

          <p className="signup-description">
            Join thousands of students mastering their coursework with AI-powered study tools.
          </p>

          {errorMessage && (
            <div
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
            </div>
          )}

          <form onSubmit={handleSignup}>
            {/* NAME */}
            <div className="modern-input-group">
              <label>
                Username <span>*</span>
              </label>
              <div className="modern-input">
                <div className="field-icon">👤</div>
                <input
                  type="text"
                  placeholder="Choose a unique username"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* TEACHER ASSIGNMENT */}
            {availableTeachers.length > 0 && (
              <div className="modern-input-group">
                <label>Assigned Faculty / Mentor</label>
                <div className="modern-input">
                  <div className="field-icon">👨‍🏫</div>
                  <select
                    value={teacherCode}
                    onChange={(e) => setTeacherCode(e.target.value)}
                    style={{
                      width: "100%",
                      border: "none",
                      outline: "none",
                      background: "transparent",
                      fontSize: "14px",
                    }}
                  >
                    {availableTeachers.map((t) => (
                      <option key={t.teacherCode} value={t.teacherCode}>
                        {t.name} ({t.teacherCode} - {t.department})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* PASSWORD */}
            <div className="modern-input-group">
              <label>
                Create Password <span>*</span>
              </label>
              <div className="modern-input">
                <div className="field-icon">🔒</div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>

              {password && (
                <div className="password-strength">
                  <div className="strength-bars">
                    {[1, 2, 3, 4].map((item) => (
                      <span
                        key={item}
                        className={item <= passwordStrength ? "strength-active" : ""}
                      ></span>
                    ))}
                  </div>
                  <small>
                    {passwordStrength <= 1
                      ? "Weak password"
                      : passwordStrength === 2
                      ? "Fair password"
                      : passwordStrength === 3
                      ? "Good password"
                      : "Strong password"}
                  </small>
                </div>
              )}
            </div>

            {/* CONFIRM PASSWORD */}
            <div className="modern-input-group">
              <label>
                Confirm Password <span>*</span>
              </label>
              <div className="modern-input">
                <div className="field-icon">🔐</div>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* TERMS */}
            <label className="terms-row">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
              />
              <span>
                I agree to the Terms of Service and Privacy Policy
              </span>
            </label>

            

            {/* CREATE BUTTON */}
            <motion.button
              type="submit"
              className="create-account-button"
              disabled={loading}
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.97 }}
            >
              <span>{loading ? "Creating Account..." : "Create My Account"}</span>
              <span className="button-arrow">→</span>
            </motion.button>
          </form>

          <div className="already-account">
            <span>Already have an account?</span>
            <button onClick={() => navigate("/student/login")}>Login</button>
          </div>
        </div>
      </motion.section>
    </div>
  );
}

export default StudentSignup;