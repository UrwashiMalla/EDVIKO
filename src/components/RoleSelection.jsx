
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import studentImage from "../assets/student/student.png";

function RoleSelection() {
  const navigate = useNavigate();

  return (
    <div className="role-page">
      {/* Decorative Background */}
      <div className="background-circle circle-one"></div>
      <div className="background-circle circle-two"></div>

      {/* =========================
          LEFT SECTION
      ========================= */}
      <motion.div
        className="intro-section"
        initial={{ opacity: 0, x: -80 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8 }}
      >
        {/* Logo */}
        <div className="logo">
          <span>🎓</span>
          <strong>EDVIKO</strong>
        </div>

        {/* Welcome Text */}
        <div className="intro-text">
          <p className="small-heading">SMART LEARNING PLATFORM</p>
          <h1>
            Welcome to
            <br />
            <span>EDVIKO</span>
          </h1>
          <p className="description">
            Learn smarter, understand better, and grow with personalized AI learning.
          </p>
        </div>

        {/* Student Illustration */}
        <motion.img
          src={studentImage}
          alt="Student learning"
          className="student-image"
          initial={{ opacity: 0, scale: 0.7, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.3 }}
        />
      </motion.div>

      {/* =========================
          RIGHT SECTION
      ========================= */}
      <motion.div
        className="selection-card"
        initial={{ opacity: 0, x: 80 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
      >
        {/* Greeting */}
        <p className="hello-text">Hello Learner 👋</p>
        <h2>How do you want to continue?</h2>
        <p className="choose-text">Select your role to enter EDVIKO</p>

        {/* =========================
            STUDENT BUTTON
        ========================= */}
        <motion.button
          className="role-card"
          onClick={() => navigate("/student/login")}
          whileHover={{ scale: 1.03, y: -5 }}
          whileTap={{ scale: 0.97 }}
        >
          <div className="role-icon student-icon">👨‍🎓</div>
          <div className="role-info">
            <h3>Student</h3>
            <p>Upload material, practice quizzes, and track your progress</p>
          </div>
          <span className="arrow">→</span>
        </motion.button>

        {/* =========================
            TEACHER BUTTON
        ========================= */}
        <motion.button
          className="role-card"
          onClick={() => navigate("/teacher/login")}
          whileHover={{ scale: 1.03, y: -5 }}
          whileTap={{ scale: 0.97 }}
        >
          <div className="role-icon teacher-icon">👨‍🏫</div>
          <div className="role-info">
            <h3>Teacher / Mentor</h3>
            <p>Guide students, review documents, and monitor quiz accuracy</p>
          </div>
          <span className="arrow">→</span>
        </motion.button>

        {/* Bottom Text */}
        <p className="bottom-text">
          One platform. Smarter learning. Better growth.
        </p>
      </motion.div>
    </div>
  );
}

export default RoleSelection;