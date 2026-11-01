import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../services/api";
import studentImage from "../assets/student/student.png";
import "./StudentSignup.css";

function StudentSignup() {
  const navigate = useNavigate();

  // Multi-step signup state: 1 = Profile info, 2 = Email verification, 3 = Password creation
  const [step, setStep] = useState(1);

  // Step 1: Profile Info
  const [name, setName] = useState("");
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
          setTeacherCode((prev) => prev || res.teachers[0].teacherCode);
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
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setErrorMessage("Please enter a username.");
      return;
    }

    if (!trimmedEmail || !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setErrorMessage("Please enter a valid email address (e.g. yourname@gmail.com).");
      return;
    }

    setLoading(true);

    try {
      const res = await authApi.sendSignupOtp({
        name: trimmedName,
        email: trimmedEmail,
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
    // Only accept numeric input
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setErrorMessage("");

    // Auto-advance to next box
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
      });
      setTimer(60);
      setOtp(["", "", "", "", "", ""]);
      setSuccessMessage(`New verification code sent to ${email.trim()}!`);
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
      setSuccessMessage("Email verified successfully! Now create your password.");
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
        email: email.trim().toLowerCase(),
        password,
        teacherCode: teacherCode.trim(),
        verificationToken,
      });

      setSuccessMessage("🎉 Account created and verified successfully! Redirecting to login...");

      // Smooth redirect to student login
      setTimeout(() => {
        navigate("/student/login", {
          state: {
            registeredEmail: email.trim().toLowerCase(),
            registeredUsername: res.studentId || name.trim(),
          },
        });
      }, 1400);
    } catch (err) {
      setErrorMessage(err.message || "Failed to finalize account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-page">
      {/* LEFT VISUAL */}
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
            Create your profile and let EDVIKO personalize your learning experience with AI study tools.
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

      {/* RIGHT FORM SECTION */}
      <motion.section
        className="signup-form-section"
        initial={{ opacity: 0, x: 70 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7 }}
      >
        <div className="signup-card">
          {/* Back Navigation */}
          {step === 1 && (
            <button className="signup-back" onClick={() => navigate("/student/login")}>
              ← Back to Login
            </button>
          )}
          {step === 2 && (
            <button className="signup-back" onClick={() => { setStep(1); setErrorMessage(""); }}>
              ← Change Email / Username
            </button>
          )}
          {step === 3 && (
            <button className="signup-back" onClick={() => { setStep(2); setErrorMessage(""); }}>
              ← Back to Verification
            </button>
          )}

          {/* Progress Bar (3 Steps) */}
          <div className="signup-progress">
            <div className="progress-label">
              <span>STEP {step} OF 3</span>
              <span>{step === 1 ? "33%" : step === 2 ? "66%" : "100%"}</span>
            </div>
            <div className="progress-track">
              <div
                className="progress-value"
                style={{ width: step === 1 ? "33%" : step === 2 ? "66%" : "100%" }}
              ></div>
            </div>
          </div>

          {/* Heading */}
          <div className="signup-heading">
            <div className="signup-welcome-icon">
              {step === 1 ? "👋" : step === 2 ? "✉️" : "🔒"}
            </div>
            <div>
              <p className="signup-small-title">
                {step === 1 ? "WELCOME TO EDVIKO" : step === 2 ? "EMAIL VERIFICATION" : "ACCOUNT SECURITY"}
              </p>
              <h2>
                {step === 1 ? "Create your profile" : step === 2 ? "Verify your email" : "Create password"}
              </h2>
            </div>
          </div>

          <p className="signup-description">
            {step === 1 && "Enter your username and email address to get started with EDVIKO AI."}
            {step === 2 && "We've sent a 6-digit verification code to your email address."}
            {step === 3 && "Choose a strong password to complete registration and secure your profile."}
          </p>

          {/* Success Banner */}
          {successMessage && (
            <div
              style={{
                marginBottom: "16px",
                padding: "10px 14px",
                borderRadius: "10px",
                background: "#f0fdf4",
                color: "#166534",
                fontSize: "14px",
                fontWeight: 600,
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
              STEP 1: USERNAME + EMAIL
          ========================================================== */}
          {step === 1 && (
            <form onSubmit={handleStep1Submit}>
              {/* USERNAME */}
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
                    autoFocus
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

              {/* ASSIGNED FACULTY / MENTOR */}
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
              <div style={{ textAlign: "center", marginBottom: "8px" }}>
                <span className="signup-email-badge">✉️ {email}</span>
                <p style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 0 0" }}>
                  Sent from: <strong style={{ color: "#7c3aed" }}>pandeaditya786@gmail.com</strong> (Check Inbox & Spam)
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
                <span>I agree to the Terms of Service and Privacy Policy</span>
              </label>

              {/* SUBMIT BUTTON */}
              <motion.button
                type="submit"
                className="create-account-button"
                disabled={loading}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.97 }}
              >
                <span>{loading ? "Creating Account..." : "Complete Registration & Create Account"}</span>
                <span className="button-arrow">→</span>
              </motion.button>
            </form>
          )}

          {/* Already have an account link */}
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
