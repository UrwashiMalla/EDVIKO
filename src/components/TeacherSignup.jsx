import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authApi } from "../services/api";
import studentImage from "../assets/student/student.png";
import "./StudentSignup.css";

const COMMON_SUBJECTS = [
  "Computer Science & AI",
  "Mathematics",
  "Physics",
  "Chemistry",
  "English Literature",
  "Biology",
  "Data Science",
  "Economics",
  "Other Subject",
];

function TeacherSignup() {
  const navigate = useNavigate();

  // Multi-step signup: 1 = Details, 2 = OTP, 3 = Password
  const [step, setStep] = useState(1);

  // Step 1: Details
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(COMMON_SUBJECTS[0]);
  const [customSubject, setCustomSubject] = useState("");
  const [department, setDepartment] = useState("");

  // Step 2: Email Verification (OTP)
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [timer, setTimer] = useState(60);
  const [verificationToken, setVerificationToken] = useState("");
  const [resending, setResending] = useState(false);
  const inputRefs = useRef([]);

  // Step 3: Password
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agree, setAgree] = useState(false);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Countdown timer
  useEffect(() => {
    if (step !== 2 || timer === 0) return;
    const interval = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [step, timer]);

  useEffect(() => {
    if (step === 2) {
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  const effectiveSubject = subject === "Other Subject" ? customSubject : subject;

  // Password strength calculation
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

  // STEP 1: SEND OTP
  const handleStep1Submit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const finalSubject = effectiveSubject.trim();

    if (!trimmedName) {
      setErrorMessage("Please enter your full name and title (e.g. Prof. Sarah Jenkins).");
      return;
    }

    if (!trimmedEmail || !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setErrorMessage("Please enter a valid faculty email address.");
      return;
    }

    if (!finalSubject) {
      setErrorMessage("Please select or enter your instructional subject name.");
      return;
    }

    setLoading(true);

    try {
      const res = await authApi.sendTeacherOtp({
        name: trimmedName,
        email: trimmedEmail,
        subject: finalSubject,
      });

      setSuccessMessage(res.message || `Faculty verification code sent to ${trimmedEmail}!`);
      setStep(2);
      setTimer(60);
      setOtp(["", "", "", "", "", ""]);
    } catch (err) {
      setErrorMessage(err.message || "Failed to send faculty verification code.");
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: VERIFY OTP
  const handleOtpChange = (value, index) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setErrorMessage("");
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (e, index) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResendOtp = async () => {
    if (timer > 0 || resending) return;
    setErrorMessage("");
    setResending(true);
    try {
      await authApi.resendOtp({
        email: email.trim().toLowerCase(),
        name: name.trim(),
        purpose: "teacher_verification",
      });
      setTimer(60);
      setOtp(["", "", "", "", "", ""]);
      setSuccessMessage(`New 5-minute verification code sent to ${email.trim()}!`);
    } catch (err) {
      setErrorMessage(err.message || "Failed to resend code.");
    } finally {
      setResending(false);
    }
  };

  const handleStep2Submit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const enteredOtp = otp.join("");
    if (enteredOtp.length !== 6) {
      setErrorMessage("Please enter the complete 6-digit verification code.");
      return;
    }

    setLoading(true);

    try {
      const res = await authApi.verifyTeacherOtp({
        email: email.trim().toLowerCase(),
        otp: enteredOtp,
      });

      setVerificationToken(res.verificationToken || "");
      setSuccessMessage("Faculty email verified! Create your account password.");
      setStep(3);
    } catch (err) {
      setErrorMessage(err.message || "Invalid or expired verification code.");
    } finally {
      setLoading(false);
    }
  };

  // STEP 3: CREATE ACCOUNT
  const handleStep3Submit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!password || !confirmPassword) {
      setErrorMessage("Please enter and confirm your password.");
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
      setErrorMessage("Please accept the Terms of Service & Educator Policy.");
      return;
    }

    setLoading(true);

    try {
      const res = await authApi.registerTeacher({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        confirmPassword,
        subject: effectiveSubject.trim(),
        department: department.trim() || "Academics",
        verificationToken,
      });

      setSuccessMessage(`🎉 Faculty account created successfully! Classroom Code: ${res.teacherCode || ""}`);

      setTimeout(() => {
        navigate("/teacher/login", {
          state: {
            registeredEmail: email.trim().toLowerCase(),
          },
        });
      }, 1400);
    } catch (err) {
      setErrorMessage(err.message || "Failed to create faculty account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-page">
      <div className="bg-shape shape-1" />
      <div className="bg-shape shape-2" />

      {/* LEFT HERO */}
      <motion.div
        className="signup-hero"
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="signup-brand">
          <span>🎓</span>
          <strong>EDVIKO</strong>
        </div>

        <div className="signup-hero-text">
          <span className="badge">FACULTY PORTAL</span>
          <h1>
            Empower Students, <br />
            <span>Guide & Inspire 👨‍🏫</span>
          </h1>
          <p>
            Create your educator profile on EDVIKO. Generate persistent classroom codes, post course announcements, inspect student progress, and answer 1-on-1 questions.
          </p>
        </div>

        <div className="signup-features">
          <div className="feature-item">
            <span className="feature-icon">🏫</span>
            <div>
              <strong>Instant Classroom Creation</strong>
              <p>Unique joining code generated and preserved permanently</p>
            </div>
          </div>

          <div className="feature-item">
            <span className="feature-icon">📚</span>
            <div>
              <strong>Subject Specialization</strong>
              <p>Persistent course subject tied to your educator profile</p>
            </div>
          </div>

          <div className="feature-item">
            <span className="feature-icon">💬</span>
            <div>
              <strong>Direct Mentorship</strong>
              <p>Private student messaging and classroom broadcasts</p>
            </div>
          </div>
        </div>

        <div className="signup-illustration">
          <img src={studentImage} alt="EDVIKO Faculty" />
        </div>
      </motion.div>

      {/* RIGHT FORM CARD */}
      <motion.div
        className="signup-card-wrapper"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <div className="signup-card">
          <button
            type="button"
            className="back-btn"
            onClick={() => {
              if (step > 1) {
                setStep(step - 1);
                setErrorMessage("");
              } else {
                navigate("/teacher/login");
              }
            }}
          >
            ← {step > 1 ? "Previous step" : "Back to faculty login"}
          </button>

          <div className="signup-card-header">
            <div className="step-indicator">
              <span className={`step-dot ${step === 1 ? "active" : step > 1 ? "completed" : ""}`}>
                {step > 1 ? "✓" : "1"}
              </span>
              <span className={`step-line ${step >= 2 ? "active" : ""}`} />
              <span className={`step-dot ${step === 2 ? "active" : step > 2 ? "completed" : ""}`}>
                {step > 2 ? "✓" : "2"}
              </span>
              <span className={`step-line ${step >= 3 ? "active" : ""}`} />
              <span className={`step-dot ${step === 3 ? "active" : ""}`}>3</span>
            </div>

            <h2>
              {step === 1 && "Faculty Registration"}
              {step === 2 && "Verify Educator Email"}
              {step === 3 && "Set Secure Password"}
            </h2>
            <p className="subtitle">
              {step === 1 && "Enter your faculty details and instructional subject"}
              {step === 2 && "Enter the 6-digit verification code sent to your email (valid for 5 mins)"}
              {step === 3 && "Secure your educator dashboard password"}
            </p>
          </div>

          {successMessage && (
            <div style={{ marginBottom: "16px", padding: "10px 14px", borderRadius: "10px", background: "#f0fdf4", color: "#15803d", fontSize: "14px", fontWeight: 500, border: "1px solid #bbf7d0" }}>
              ✅ {successMessage}
            </div>
          )}

          {errorMessage && (
            <div style={{ marginBottom: "16px", padding: "10px 14px", borderRadius: "10px", background: "#fef2f2", color: "#b91c1c", fontSize: "14px", fontWeight: 500, border: "1px solid #fecaca" }}>
              ⚠️ {errorMessage}
            </div>
          )}

          {/* STEP 1 */}
          {step === 1 && (
            <form onSubmit={handleStep1Submit}>
              <div className="modern-input-group">
                <label>Full Name & Title <span>*</span></label>
                <div className="modern-input">
                  <div className="field-icon">👨‍🏫</div>
                  <input
                    type="text"
                    placeholder="e.g. Prof. Sarah Jenkins"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="modern-input-group">
                <label>Faculty Email Address <span>*</span></label>
                <div className="modern-input">
                  <div className="field-icon">✉️</div>
                  <input
                    type="email"
                    placeholder="e.g. instructor@university.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <small style={{ color: "#64748b", fontSize: "11px", marginTop: "4px", display: "block" }}>
                  A 6-digit verification code will be sent to this email address.
                </small>
              </div>

              <div className="modern-input-group">
                <label>Subject Specialization <span>*</span></label>
                <div className="modern-input">
                  <div className="field-icon">📖</div>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontSize: "14px" }}
                  >
                    {COMMON_SUBJECTS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {subject === "Other Subject" && (
                <div className="modern-input-group">
                  <label>Specify Subject Name <span>*</span></label>
                  <div className="modern-input">
                    <div className="field-icon">✏️</div>
                    <input
                      type="text"
                      placeholder="e.g. Applied Machine Learning"
                      value={customSubject}
                      onChange={(e) => setCustomSubject(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="modern-input-group">
                <label>Department / Faculty</label>
                <div className="modern-input">
                  <div className="field-icon">🏛️</div>
                  <input
                    type="text"
                    placeholder="e.g. Department of Engineering"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  />
                </div>
              </div>

              <motion.button
                type="submit"
                className="create-account-button"
                disabled={loading}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.97 }}
              >
                <span>{loading ? "Sending Code..." : "Send Verification Code"}</span>
                <span className="button-arrow">→</span>
              </motion.button>
            </form>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <form onSubmit={handleStep2Submit}>
              <div style={{ textAlign: "center", marginBottom: "14px" }}>
                <span className="signup-email-badge">✉️ {email}</span>
                <p style={{ fontSize: "12.5px", color: "#334155", margin: "6px 0 2px 0", fontWeight: 600 }}>
                  Instructional Subject: <strong style={{ color: "#7c3aed" }}>{effectiveSubject}</strong>
                </p>
                <p style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 0 0" }}>
                  💡 <strong>Tip:</strong> If not in your primary inbox, please check your <strong>Spam / Junk</strong> folder.
                </p>
              </div>

              <div className="signup-otp-inputs">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength="1"
                    value={digit}
                    onChange={(e) => handleOtpChange(e.target.value, index)}
                    onKeyDown={(e) => handleOtpKeyDown(e, index)}
                    autoComplete="one-time-code"
                  />
                ))}
              </div>

              <div className="signup-otp-resend">
                {timer > 0 ? (
                  <p>Didn't receive the code? <span>Resend in 00:{String(timer).padStart(2, "0")}</span></p>
                ) : (
                  <p>
                    Didn't receive the code?{" "}
                    <button type="button" onClick={handleResendOtp} disabled={resending}>
                      {resending ? "Sending..." : "Resend OTP Code"}
                    </button>
                  </p>
                )}
              </div>

              <motion.button
                type="submit"
                className="create-account-button"
                disabled={loading || otp.join("").length !== 6}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.97 }}
              >
                <span>{loading ? "Verifying Code..." : "Verify & Continue"}</span>
                <span className="button-arrow">→</span>
              </motion.button>
            </form>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <form onSubmit={handleStep3Submit}>
              <div className="modern-input-group">
                <label>Create Password <span>*</span></label>
                <div className="modern-input">
                  <div className="field-icon">🔒</div>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex="-1"
                  >
                    {showPassword ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {password && (
                  <div className="password-strength-bar">
                    <div
                      className={`strength-fill strength-${passwordStrength}`}
                      style={{ width: `${Math.max(15, (passwordStrength / 4) * 100)}%` }}
                    />
                  </div>
                )}
              </div>

              <div className="modern-input-group">
                <label>Confirm Password <span>*</span></label>
                <div className="modern-input">
                  <div className="field-icon">🔒</div>
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
                    tabIndex="-1"
                  >
                    {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
              </div>

              <label className="terms-checkbox">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  required
                />
                <span>
                  I agree to EDVIKO <Link to="/terms">Terms of Service</Link> & Educator Guidelines
                </span>
              </label>

              <motion.button
                type="submit"
                className="create-account-button"
                disabled={loading || !agree}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.97 }}
              >
                <span>{loading ? "Creating Faculty Portal..." : "Complete Registration"}</span>
                <span className="button-arrow">🚀</span>
              </motion.button>
            </form>
          )}

          <div className="signup-footer">
            <p>
              Already registered? <Link to="/teacher/login">Log in to Faculty Portal</Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default TeacherSignup;
