import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authApi } from "../services/api";
import studentImage from "../assets/student/student.png";
import "./StudentSignup.css";

function StudentSignup() {
  const navigate = useNavigate();

  // Multi-step signup state: 1 = Profile info, 2 = Email verification, 3 = Password creation
  const [step, setStep] = useState(1);

  // Step 1: Profile Info
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [teacherCode, setTeacherCode] = useState("");
  const [availableTeachers, setAvailableTeachers] = useState([]);

  // Step 2: Email Verification (OTP)
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [timer, setTimer] = useState(60);
  const [verificationToken, setVerificationToken] = useState("");
  const [resending, setResending] = useState(false);
  const inputRefs = useRef([]);

  // Step 3: Password Creation
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agree, setAgree] = useState(false);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Load available mentors/teachers
  useEffect(() => {
    let ignore = false;
    authApi.listTeachers()
      .then((res) => {
        if (!ignore && res.teachers && res.teachers.length > 0) {
          setAvailableTeachers(res.teachers);
        }
      })
      .catch(() => {});

    return () => {
      ignore = true;
    };
  }, []);

  // OTP Countdown Timer for Step 2
  useEffect(() => {
    if (step !== 2 || timer === 0) return;
    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [step, timer]);

  // Focus first OTP input when reaching step 2
  useEffect(() => {
    if (step === 2) {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [step]);

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

  // ==========================================
  // STEP 1: SEND SIGNUP OTP
  // ==========================================
  const handleStep1Submit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const trimmedName = name.trim();
    const trimmedUsername = username.trim().toLowerCase();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setErrorMessage("Please enter your full name.");
      return;
    }

    if (!trimmedUsername || trimmedUsername.length < 3) {
      setErrorMessage("Please choose a username (at least 3 characters).");
      return;
    }

    if (!trimmedEmail || !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setErrorMessage("Please enter a valid email address (e.g. yourname@gmail.com).");
      return;
    }

    const trimmedTeacherCode = teacherCode.trim().toUpperCase();
    if (!trimmedTeacherCode) {
      setErrorMessage("Classroom Code is required. Please obtain the classroom code from your teacher to register.");
      return;
    }

    setLoading(true);

    try {
      const res = await authApi.sendSignupOtp({
        name: trimmedName,
        username: trimmedUsername,
        email: trimmedEmail,
        teacherCode: trimmedTeacherCode,
      });

      setSuccessMessage(res.message || `Verification code sent to ${trimmedEmail}!`);
      setStep(2);
      setTimer(60);
      setOtp(["", "", "", "", "", ""]);
    } catch (err) {
      setErrorMessage(err.message || "Failed to send verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // STEP 2: HANDLE OTP INPUT & VERIFY
  // ==========================================
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

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(pasted)) {
      const digits = pasted.split("");
      setOtp(digits);
      inputRefs.current[5]?.focus();
    }
  };

  const handleResendOtp = async () => {
    if (timer > 0 || resending) return;
    setErrorMessage("");
    setSuccessMessage("");
    setResending(true);

    try {
      await authApi.resendOtp({
        email: email.trim().toLowerCase(),
        name: name.trim(),
        purpose: "student_verification",
      });
      setTimer(60);
      setOtp(["", "", "", "", "", ""]);
      setSuccessMessage(`New 5-minute verification code sent to ${email.trim()}!`);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setErrorMessage(err.message || "Failed to resend code. Please try again.");
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
      const res = await authApi.verifySignupOtp({
        email: email.trim().toLowerCase(),
        otp: enteredOtp,
      });

      setVerificationToken(res.verificationToken || "");
      setSuccessMessage("Email verified successfully! Now create your secure password.");
      setStep(3);
    } catch (err) {
      setErrorMessage(err.message || "Invalid or expired verification code.");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // STEP 3: CREATE PASSWORD & COMPLETE SIGNUP
  // ==========================================
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
      setErrorMessage("Please accept the Terms of Service & Privacy Policy.");
      return;
    }

    setLoading(true);

    try {
      const res = await authApi.registerStudent({
        name: name.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        password,
        confirmPassword,
        teacherCode: teacherCode.trim(),
        verificationToken,
      });

      setSuccessMessage("🎉 Account created and verified successfully! Redirecting to login...");

      setTimeout(() => {
        navigate("/student/login", {
          state: {
            registeredEmail: email.trim().toLowerCase(),
            registeredUsername: res.username || username.trim(),
          },
        });
      }, 1200);
    } catch (err) {
      setErrorMessage(err.message || "Failed to finalize account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-page">
      {/* Decorative Blur Backgrounds */}
      <div className="bg-shape shape-1" />
      <div className="bg-shape shape-2" />

      {/* =========================================================
          LEFT HERO SECTION
      ========================================================== */}
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
          <span className="badge">STUDENT PORTAL</span>
          <h1>
            Start Your Smart <br />
            <span>Learning Journey 🚀</span>
          </h1>
          <p>
            Join EDVIKO today. Upload study materials, generate AI notes, practice smart MCQ quizzes, and connect with your educators.
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="signup-features">
          <div className="feature-item">
            <span className="feature-icon">🤖</span>
            <div>
              <strong>AI Academic Tutor</strong>
              <p>24/7 grounded concept explanations</p>
            </div>
          </div>

          <div className="feature-item">
            <span className="feature-icon">📊</span>
            <div>
              <strong>Instant Practice Quizzes</strong>
              <p>Self-paced test evaluations</p>
            </div>
          </div>

          <div className="feature-item">
            <span className="feature-icon">💬</span>
            <div>
              <strong>Classroom Channel</strong>
              <p>Private 1-on-1 messaging with your instructor</p>
            </div>
          </div>
        </div>

        <div className="signup-illustration">
          <img src={studentImage} alt="EDVIKO Student" />
        </div>
      </motion.div>

      {/* =========================================================
          RIGHT FORM CARD
      ========================================================== */}
      <motion.div
        className="signup-card-wrapper"
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <div className="signup-card">
          {/* Back button */}
          <button
            type="button"
            className="back-btn"
            onClick={() => {
              if (step > 1) {
                setStep(step - 1);
                setErrorMessage("");
              } else {
                navigate("/student/login");
              }
            }}
          >
            ← {step > 1 ? "Previous step" : "Back to login"}
          </button>

          {/* Header */}
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
              {step === 1 && "Create Student Account"}
              {step === 2 && "Verify Email Address"}
              {step === 3 && "Secure Your Password"}
            </h2>
            <p className="subtitle">
              {step === 1 && "Enter your basic profile details to receive an OTP code"}
              {step === 2 && "Enter the 6-digit verification code sent to your email (valid for 5 mins)"}
              {step === 3 && "Choose a strong password to protect your student portal"}
            </p>
          </div>

          {/* Success Banner */}
          {successMessage && (
            <div
              style={{
                marginBottom: "16px",
                padding: "10px 14px",
                borderRadius: "10px",
                background: "#f0fdf4",
                color: "#15803d",
                fontSize: "14px",
                fontWeight: 500,
                border: "1px solid #bbf7d0",
              }}
            >
              ✅ {successMessage}
            </div>
          )}

          {/* Error Banner */}
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
                border: "1px solid #fecaca",
              }}
            >
              ⚠️ {errorMessage}
            </div>
          )}

          {/* =========================================================
              STEP 1: FULL NAME, USERNAME, EMAIL, CLASSROOM CODE
          ========================================================== */}
          {step === 1 && (
            <form onSubmit={handleStep1Submit}>
              {/* FULL NAME */}
              <div className="modern-input-group">
                <label>
                  Full Name <span>*</span>
                </label>
                <div className="modern-input">
                  <div className="field-icon">👤</div>
                  <input
                    type="text"
                    placeholder="e.g. Aditya Pande"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* USERNAME */}
              <div className="modern-input-group">
                <label>
                  Username <span>*</span>
                </label>
                <div className="modern-input">
                  <div className="field-icon">🆔</div>
                  <input
                    type="text"
                    placeholder="e.g. aditya123"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* EMAIL */}
              <div className="modern-input-group">
                <label>
                  Student Email Address <span>*</span>
                </label>
                <div className="modern-input">
                  <div className="field-icon">✉️</div>
                  <input
                    type="email"
                    placeholder="e.g. student@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <small style={{ color: "#64748b", fontSize: "11px", marginTop: "4px", display: "block" }}>
                  A 6-digit verification code will be sent to this email address.
                </small>
              </div>

              {/* TEACHER CLASSROOM CODE (MANDATORY) */}
              <div className="modern-input-group">
                <label>
                  Teacher Classroom Code <span>*</span>
                </label>
                <div className="modern-input">
                  <div className="field-icon">🏫</div>
                  <input
                    type="text"
                    placeholder="e.g. EDV-BAV5 (provided by your teacher)"
                    value={teacherCode}
                    onChange={(e) => setTeacherCode(e.target.value.toUpperCase())}
                    required
                  />
                </div>
                <small style={{ color: "#64748b", fontSize: "11px", marginTop: "4px", display: "block" }}>
                  Enter your teacher's code to match their classroom. Registration requires a valid teacher code.
                </small>
              </div>

              {/* CONTINUE BUTTON */}
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

          {/* =========================================================
              STEP 2: EMAIL VERIFICATION (OTP)
          ========================================================== */}
          {step === 2 && (
            <form onSubmit={handleStep2Submit}>
              <div style={{ textAlign: "center", marginBottom: "14px" }}>
                <span className="signup-email-badge">✉️ {email}</span>
                <p style={{ fontSize: "12.5px", color: "#334155", margin: "6px 0 2px 0", fontWeight: 600 }}>
                  Enrolling in Classroom: <strong style={{ color: "#7c3aed" }}>{teacherCode}</strong>
                </p>
                <p style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 0 0" }}>
                  💡 <strong>Tip:</strong> If not in your primary inbox, please check your <strong>Spam / Junk</strong> folder.
                </p>
              </div>

              {/* OTP DIGIT BOXES */}
              <div className="signup-otp-inputs" onPaste={handleOtpPaste}>
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      inputRefs.current[index] = el;
                    }}
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

              {/* RESEND TIMER */}
              <div className="signup-otp-resend">
                {timer > 0 ? (
                  <p>
                    Didn't receive the code? <span>Resend in 00:{String(timer).padStart(2, "0")}</span>
                  </p>
                ) : (
                  <p>
                    Didn't receive the code?{" "}
                    <button type="button" onClick={handleResendOtp} disabled={resending}>
                      {resending ? "Sending..." : "Resend OTP Code"}
                    </button>
                  </p>
                )}
              </div>

              {/* VERIFY BUTTON */}
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

          {/* =========================================================
              STEP 3: CREATE PASSWORD
          ========================================================== */}
          {step === 3 && (
            <form onSubmit={handleStep3Submit}>
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
                      style={{ width: `${(passwordStrength / 4) * 100}%` }}
                    />
                  </div>
                )}
              </div>

              {/* CONFIRM PASSWORD */}
              <div className="modern-input-group">
                <label>
                  Confirm Password <span>*</span>
                </label>
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

              {/* TERMS CHECKBOX */}
              <label className="terms-checkbox">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  required
                />
                <span>
                  I agree to the <Link to="/terms">Terms of Service</Link> and{" "}
                  <Link to="/privacy">Privacy Policy</Link>
                </span>
              </label>

              {/* FINALIZE BUTTON */}
              <motion.button
                type="submit"
                className="create-account-button"
                disabled={loading || !agree}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.97 }}
              >
                <span>{loading ? "Creating Account..." : "Complete Registration"}</span>
                <span className="button-arrow">🚀</span>
              </motion.button>
            </form>
          )}

          {/* FOOTER */}
          <div className="signup-footer">
            <p>
              Already registered? <Link to="/student/login">Log in to Student Portal</Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default StudentSignup;
