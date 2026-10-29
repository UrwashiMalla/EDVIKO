import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { authApi } from "../services/api";
import studentImage from "../assets/student/student.png";
import "./StudentOTP.css";

function StudentOTP() {
  const [searchParams] = useSearchParams();
  const emailParam = searchParams.get("email") || "";

  const [email] = useState(emailParam);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [timer, setTimer] = useState(60);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const inputRefs = useRef([]);
  const { verifyOtp } = useAuth();
  const navigate = useNavigate();

  // OTP TIMER
  useEffect(() => {
    if (timer === 0) return;
    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // HANDLE OTP INPUT
  const handleChange = (value, index) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setError("");

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // HANDLE BACKSPACE
  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // VERIFY OTP
  const handleVerify = async () => {
    const enteredOtp = otp.join("");
    if (enteredOtp.length !== 6) {
      setError("Please enter the complete 6-digit OTP.");
      return;
    }

    if (!email) {
      setError("Missing email address. Please return to login.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await verifyOtp(email, enteredOtp);
      navigate("/student/dashboard");
    } catch (err) {
      setError(err.message || "Incorrect or expired OTP code.");
    } finally {
      setLoading(false);
    }
  };

  // RESEND OTP
  const handleResend = async () => {
    if (!email) return;
    try {
      await authApi.resendOtp({ email });
      setOtp(["", "", "", "", "", ""]);
      setTimer(60);
      setError("");
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err.message || "Failed to resend code.");
    }
  };

  return (
    <div className="otp-page">
      {/* LEFT SIDE */}
      <motion.div
        className="otp-visual"
        initial={{ opacity: 0, x: -70 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7 }}
      >
        <div className="otp-logo">
          <span>🎓</span>
          <strong>EDVIKO</strong>
        </div>

        <div className="otp-visual-content">
          <div className="otp-badge">🔐 SECURE LEARNING</div>
          <h1>
            One small step
            <br />
            towards your
            <br />
            <span>learning journey. ✨</span>
          </h1>
          <p>
            Verify your email to keep your
            <br />
            EDVIKO account secure and personalized.
          </p>
        </div>

        <motion.img
          src={studentImage}
          alt="Student learning"
          className="otp-student-image"
          initial={{ opacity: 0, scale: 0.75, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        />
      </motion.div>

      {/* RIGHT SIDE */}
      <motion.div
        className="otp-form-section"
        initial={{ opacity: 0, x: 70 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7 }}
      >
        <div className="otp-card">
          <button className="otp-back" onClick={() => navigate("/student/signup")}>
            ← Back to Sign Up
          </button>

          <div className="otp-icon">✉️</div>
          <p className="otp-small-title">EMAIL VERIFICATION</p>
          <h2>Verify your email</h2>
          <p className="otp-description">We've sent a 6-digit verification code to</p>

          <div className="otp-email">{email || "your email address"}</div>
          <p style={{ fontSize: "13px", color: "#4f46e5", margin: "6px 0 16px 0", fontWeight: 500 }}>
            Sent from: <b>adityapande78@gmail.com</b> (Please check Inbox & Spam)
          </p>

          {/* OTP BOXES */}
          <div className="otp-inputs">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(element) => {
                  inputRefs.current[index] = element;
                }}
                type="text"
                inputMode="numeric"
                maxLength="1"
                value={digit}
                onChange={(e) => handleChange(e.target.value, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
              />
            ))}
          </div>

          {/* ERROR */}
          {error && (
            <motion.p
              className="otp-error"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              ⚠️ {error}
            </motion.p>
          )}

          {/* TIMER */}
          <div className="otp-resend">
            {timer > 0 ? (
              <p>
                Didn't receive the code? <span>Resend in 00:{String(timer).padStart(2, "0")}</span>
              </p>
            ) : (
              <p>
                Didn't receive the code?{" "}
                <button type="button" onClick={handleResend}>
                  Resend OTP
                </button>
              </p>
            )}
          </div>

          {/* VERIFY */}
          <motion.button
            className="verify-button"
            onClick={handleVerify}
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
          >
            <span>{loading ? "Verifying..." : "Verify & Continue"}</span>
            <span>→</span>
          </motion.button>

          {/* DEMO INFO */}
          <div className="demo-otp">
            <span>📧</span>
            <div>
              <strong>Email Verification</strong>
              <p>
                Check your inbox for mail from <b>adityapande78@gmail.com</b>. If not visible, check spam folder. (Dev code: <b>123456</b>)
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default StudentOTP;