import { motion } from "framer-motion";
import "./Courses.css";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CourseDetails from "./CourseDetails";

function Courses() {
  const navigate = useNavigate();
  const [selectedCourse, setSelectedCourse] = useState(null);

  const onBack = () => navigate("/student/dashboard");
  const onOpenCourseDetails = (course) => setSelectedCourse(course);
  const onOpenWorkspace = () => navigate("/student/workspace");
  const courses = [
    {
      id: 1,
      title: "Artificial Intelligence",
      shortTitle: "AI",
      description:
        "Learn the fundamentals of Artificial Intelligence and intelligent systems.",
      icon: "🤖",
      topics: 8,
      level: "Beginner",
    },
    {
      id: 2,
      title: "Machine Learning",
      shortTitle: "ML",
      description:
        "Understand machine learning concepts, algorithms and practical applications.",
      icon: "🧠",
      topics: 10,
      level: "Beginner",
    },
    {
      id: 3,
      title: "Data Science",
      shortTitle: "DS",
      description:
        "Explore data analysis, visualization and data-driven problem solving.",
      icon: "📊",
      topics: 9,
      level: "Beginner",
    },
    {
      id: 4,
      title: "Natural Language Processing",
      shortTitle: "NLP",
      description:
        "Learn how computers understand, process and generate human language.",
      icon: "💬",
      topics: 7,
      level: "Intermediate",
    },
    {
      id: 5,
      title: "Python Programming",
      shortTitle: "PY",
      description:
        "Build your programming foundation with Python from the basics.",
      icon: "🐍",
      topics: 12,
      level: "Beginner",
    },
    {
      id: 6,
      title: "Data Structures",
      shortTitle: "DSA",
      description:
        "Learn essential data structures and problem-solving concepts.",
      icon: "🌳",
      topics: 11,
      level: "Beginner",
    },
  ];

  if (selectedCourse) {
    return (
      <CourseDetails
        course={selectedCourse}
        onBack={() => setSelectedCourse(null)}
        onStartLearning={(data) => {
          // Handle AI study topic with Groq API
          console.log("Start learning with Groq", data);
        }}
      />
    );
  }

  return (
    <div className="courses-page">

      {/* ================= HEADER ================= */}

      <motion.header
        className="courses-header"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div>
          <button className="courses-back-button" onClick={onBack}>
            ← Back to Dashboard
          </button>

          <span className="courses-label">
            PERSONALIZED LEARNING
          </span>

          <h1>Explore Courses</h1>

          <p>
            Choose a course and start learning with
            AI-powered personalized study tools.
          </p>
        </div>

        <motion.div
          className="courses-header-icon"
          animate={{ y: [0, -8, 0] }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          🎓
        </motion.div>
      </motion.header>

      {/* ================= COURSE GRID ================= */}

      <section className="courses-section">

        <div className="courses-section-heading">
          <div>
            <span>LEARNING LIBRARY</span>
            <h2>Available Courses</h2>
          </div>

          <div className="course-count">
            {courses.length} Courses
          </div>
        </div>

        <div className="courses-grid">

          {courses.map((course, index) => (
            <motion.div
              key={course.id}
              className="course-card"
              initial={{
                opacity: 0,
                y: 25,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                delay: index * 0.08,
                duration: 0.5,
              }}
              whileHover={{
                y: -8,
              }}
            >

              <div className="course-card-top">

                <motion.div
                  className="course-icon"
                  whileHover={{
                    rotate: 8,
                    scale: 1.08,
                  }}
                >
                  {course.icon}
                </motion.div>

                <span className="course-level">
                  {course.level}
                </span>

              </div>

              <h3>{course.title}</h3>

              <p>{course.description}</p>

              <div className="course-info">

                <span>
                  📚 {course.topics} Topics
                </span>

                <span>
                  ✨ AI Learning
                </span>

              </div>

              <button
  className="course-start-button"
  onClick={() => onOpenCourseDetails(course)}
>
  Start Learning →
</button>

            </motion.div>
          ))}

        </div>
      </section>

      {/* ================= AI LEARNING CARD ================= */}

      <motion.section
        className="courses-ai-card"
        initial={{
          opacity: 0,
          y: 30,
        }}
        animate={{
          opacity: 1,
          y: 0,
        }}
        transition={{
          delay: 0.5,
        }}
      >

        <div className="courses-ai-icon">
          ✨
        </div>

        <div>
          <span>AI-POWERED LEARNING</span>

          <h2>
            Don't know where to start?
          </h2>

          <p>
            Upload your study material and let LERNIQ
            create personalized learning resources for you.
          </p>
        </div>

        <button
          onClick={onOpenWorkspace}
          className="courses-ai-button"
        >
          Start With My Material →
        </button>

      </motion.section>

    </div>
  );
}

export default Courses;