import { motion } from "framer-motion";
import "./CourseDetails.css";

import { useState } from "react";

function CourseDetails({ course, onBack, onStartLearning }) {
  const [aiResponse, setAiResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleTopicClick = async (topic) => {
    setIsLoading(true);
    setAiResponse(null);
    try {
      const apiKey = import.meta.env.VITE_GROQ_API_KEY || "YOUR_GROQ_API_KEY";
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages: [
            {
              role: "system",
              content: "You are an expert AI tutor for LERNIQ. Explain the topic in a simple, engaging way with a quick summary and a mini quiz."
            },
            {
              role: "user",
              content: `Please teach me about "${topic.title}" from the "${course.title}" course.`
            }
          ]
        })
      });
      const data = await res.json();
      if (data.choices && data.choices.length > 0) {
        setAiResponse({ topic: topic.title, content: data.choices[0].message.content });
      } else {
        setAiResponse({ topic: topic.title, content: "Failed to generate AI response. Please check Groq API key." });
      }
    } catch (error) {
      console.error(error);
      setAiResponse({ topic: topic.title, content: "An error occurred while calling Groq API." });
    } finally {
      setIsLoading(false);
    }
  };
  const courseTopics = {
    "Artificial Intelligence": [
      {
        title: "Introduction to Artificial Intelligence",
        description:
          "Understand what AI is, where it is used, and how intelligent systems work.",
        duration: "20 min",
        icon: "🤖",
      },
      {
        title: "Types of Artificial Intelligence",
        description:
          "Learn about Narrow AI, General AI and the basic idea of Super AI.",
        duration: "18 min",
        icon: "🧠",
      },
      {
        title: "AI Problem Solving",
        description:
          "Understand search, reasoning and problem-solving approaches used in AI.",
        duration: "25 min",
        icon: "🔎",
      },
      {
        title: "Knowledge Representation",
        description:
          "Learn how knowledge can be represented so that machines can reason about it.",
        duration: "22 min",
        icon: "📚",
      },
      {
        title: "Machine Learning Basics",
        description:
          "Understand how machine learning helps AI systems learn from data.",
        duration: "25 min",
        icon: "📊",
      },
      {
        title: "Neural Networks",
        description:
          "Get introduced to neurons, layers and the basic working of neural networks.",
        duration: "30 min",
        icon: "🕸️",
      },
      {
        title: "AI Applications",
        description:
          "Explore real-world applications of AI in education, healthcare and business.",
        duration: "20 min",
        icon: "🌐",
      },
      {
        title: "AI Ethics and Future",
        description:
          "Understand responsible AI, ethical concerns and the future of intelligent systems.",
        duration: "20 min",
        icon: "✨",
      },
    ],

    "Machine Learning": [
      {
        title: "Introduction to Machine Learning",
        description:
          "Learn the basic concepts of machine learning and how systems learn from data.",
        duration: "20 min",
        icon: "🧠",
      },
      {
        title: "Types of Machine Learning",
        description:
          "Understand supervised, unsupervised and reinforcement learning.",
        duration: "25 min",
        icon: "📚",
      },
      {
        title: "Data Preprocessing",
        description:
          "Learn how raw data is cleaned and prepared before model training.",
        duration: "30 min",
        icon: "🧹",
      },
      {
        title: "Linear Regression",
        description:
          "Understand regression and how a model predicts continuous values.",
        duration: "30 min",
        icon: "📈",
      },
      {
        title: "Classification",
        description:
          "Learn how classification models predict categories and classes.",
        duration: "30 min",
        icon: "🎯",
      },
      {
        title: "Decision Trees",
        description:
          "Understand how decision trees make predictions using a sequence of decisions.",
        duration: "25 min",
        icon: "🌳",
      },
      {
        title: "Random Forest",
        description:
          "Learn how multiple decision trees can be combined to improve predictions.",
        duration: "25 min",
        icon: "🌲",
      },
      {
        title: "Model Evaluation",
        description:
          "Understand accuracy, precision, recall and other basic evaluation measures.",
        duration: "25 min",
        icon: "📊",
      },
      {
        title: "Overfitting and Underfitting",
        description:
          "Learn why models perform poorly and how to improve generalization.",
        duration: "20 min",
        icon: "⚖️",
      },
      {
        title: "Machine Learning Project",
        description:
          "Apply the concepts learned to build a simple machine learning project.",
        duration: "40 min",
        icon: "🚀",
      },
    ],

    "Data Science": [
      {
        title: "Introduction to Data Science",
        description:
          "Understand data science, its workflow and real-world applications.",
        duration: "20 min",
        icon: "📊",
      },
      {
        title: "Data Collection",
        description:
          "Learn different ways data can be collected and stored.",
        duration: "20 min",
        icon: "📥",
      },
      {
        title: "Data Cleaning",
        description:
          "Learn how missing, duplicate and inconsistent data can be handled.",
        duration: "25 min",
        icon: "🧹",
      },
      {
        title: "Exploratory Data Analysis",
        description:
          "Understand how to explore datasets and identify useful patterns.",
        duration: "30 min",
        icon: "🔍",
      },
      {
        title: "Data Visualization",
        description:
          "Learn how charts and graphs help communicate insights.",
        duration: "25 min",
        icon: "📈",
      },
      {
        title: "Statistics Basics",
        description:
          "Understand important statistical concepts used in data analysis.",
        duration: "30 min",
        icon: "🧮",
      },
      {
        title: "Feature Engineering",
        description:
          "Learn how useful features can be created from raw data.",
        duration: "25 min",
        icon: "⚙️",
      },
      {
        title: "Introduction to Machine Learning",
        description:
          "Understand how machine learning fits into the data science workflow.",
        duration: "25 min",
        icon: "🤖",
      },
      {
        title: "Data Science Project",
        description:
          "Use the complete data science workflow on a practical project.",
        duration: "40 min",
        icon: "🚀",
      },
    ],

    "Natural Language Processing": [
      {
        title: "Introduction to NLP",
        description:
          "Understand how computers process and work with human language.",
        duration: "20 min",
        icon: "💬",
      },
      {
        title: "Text Preprocessing",
        description:
          "Learn tokenization, cleaning and other basic text preprocessing techniques.",
        duration: "30 min",
        icon: "📝",
      },
      {
        title: "Tokenization",
        description:
          "Understand how text is divided into smaller meaningful units.",
        duration: "20 min",
        icon: "🔤",
      },
      {
        title: "Stop Words and Stemming",
        description:
          "Learn common techniques used to simplify and normalize text.",
        duration: "25 min",
        icon: "✂️",
      },
      {
        title: "Bag of Words",
        description:
          "Understand how text can be converted into numerical features.",
        duration: "25 min",
        icon: "📦",
      },
      {
        title: "TF-IDF",
        description:
          "Learn how TF-IDF represents the importance of words in documents.",
        duration: "30 min",
        icon: "📊",
      },
      {
        title: "NLP Applications",
        description:
          "Explore chatbots, sentiment analysis, translation and text classification.",
        duration: "25 min",
        icon: "🌐",
      },
    ],

    "Python Programming": [
      {
        title: "Introduction to Python",
        description:
          "Learn Python syntax, variables and the basic structure of a program.",
        duration: "25 min",
        icon: "🐍",
      },
      {
        title: "Variables and Data Types",
        description:
          "Understand strings, numbers, booleans and basic Python variables.",
        duration: "25 min",
        icon: "📦",
      },
      {
        title: "Operators and Expressions",
        description:
          "Learn arithmetic, comparison and logical operators.",
        duration: "20 min",
        icon: "➕",
      },
      {
        title: "Conditional Statements",
        description:
          "Learn how if, elif and else control program decisions.",
        duration: "25 min",
        icon: "🔀",
      },
      {
        title: "Loops",
        description:
          "Understand for loops, while loops and iteration.",
        duration: "25 min",
        icon: "🔁",
      },
      {
        title: "Functions",
        description:
          "Learn how to create reusable blocks of Python code.",
        duration: "30 min",
        icon: "⚙️",
      },
      {
        title: "Lists and Tuples",
        description:
          "Understand Python collections and how to work with multiple values.",
        duration: "25 min",
        icon: "📋",
      },
      {
        title: "Dictionaries and Sets",
        description:
          "Learn key-value storage and unique collections in Python.",
        duration: "25 min",
        icon: "🗂️",
      },
      {
        title: "File Handling",
        description:
          "Learn how Python reads and writes files.",
        duration: "25 min",
        icon: "📁",
      },
      {
        title: "Exception Handling",
        description:
          "Understand how Python handles errors safely.",
        duration: "20 min",
        icon: "🛠️",
      },
      {
        title: "Object-Oriented Programming",
        description:
          "Learn classes, objects and basic OOP concepts in Python.",
        duration: "35 min",
        icon: "🏗️",
      },
      {
        title: "Python Mini Project",
        description:
          "Build a small practical project using the concepts learned.",
        duration: "40 min",
        icon: "🚀",
      },
    ],

    "Data Structures": [
      {
        title: "Introduction to Data Structures",
        description:
          "Understand why data structures are important in programming.",
        duration: "20 min",
        icon: "🌳",
      },
      {
        title: "Arrays",
        description:
          "Learn how arrays store and organize collections of data.",
        duration: "25 min",
        icon: "📦",
      },
      {
        title: "Linked Lists",
        description:
          "Understand nodes, links and different types of linked lists.",
        duration: "30 min",
        icon: "🔗",
      },
      {
        title: "Stacks",
        description:
          "Learn the LIFO principle and practical applications of stacks.",
        duration: "25 min",
        icon: "📚",
      },
      {
        title: "Queues",
        description:
          "Understand FIFO and different types of queues.",
        duration: "25 min",
        icon: "🚶",
      },
      {
        title: "Trees",
        description:
          "Learn tree structures, traversal and basic terminology.",
        duration: "30 min",
        icon: "🌲",
      },
      {
        title: "Binary Search Trees",
        description:
          "Understand how binary search trees organize searchable data.",
        duration: "30 min",
        icon: "🌳",
      },
      {
        title: "Graphs",
        description:
          "Learn vertices, edges and basic graph representations.",
        duration: "30 min",
        icon: "🕸️",
      },
      {
        title: "Searching Algorithms",
        description:
          "Understand linear search and binary search.",
        duration: "25 min",
        icon: "🔎",
      },
      {
        title: "Sorting Algorithms",
        description:
          "Learn the basics of common sorting techniques.",
        duration: "30 min",
        icon: "↕️",
      },
      {
        title: "Time and Space Complexity",
        description:
          "Understand how algorithm efficiency is measured.",
        duration: "30 min",
        icon: "⏱️",
      },
    ],
  };

  const selectedCourse = course || {
    title: "Artificial Intelligence",
    shortTitle: "AI",
    description:
      "Learn the fundamentals of Artificial Intelligence and intelligent systems.",
    icon: "🤖",
    level: "Beginner",
  };

  const topics =
    courseTopics[selectedCourse.title] ||
    courseTopics["Artificial Intelligence"];

  return (
    <div className="course-details-page">

      {/* ================= HEADER ================= */}

      <motion.header
        className="course-details-header"
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >

        <div className="course-details-header-left">

          <button
            className="course-details-back"
            onClick={onBack}
          >
            ← Back to Courses
          </button>

          <div className="course-details-title-row">

            <motion.div
              className="course-details-icon"
              animate={{ y: [0, -6, 0] }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              {selectedCourse.icon}
            </motion.div>

            <div>
              <span className="course-details-label">
                COURSE
              </span>

              <h1>{selectedCourse.title}</h1>

              <p>{selectedCourse.description}</p>
            </div>

          </div>

        </div>

        <div className="course-details-level">
          <span>LEVEL</span>
          <strong>{selectedCourse.level}</strong>
        </div>

      </motion.header>

      {/* ================= GROQ AI RESPONSE ================= */}
      {(isLoading || aiResponse) && (
        <motion.section
          className="course-overview-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ flexDirection: 'column', alignItems: 'flex-start', background: '#f8fafc', border: '1px solid #e2e8f0', gap: '15px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.2rem' }}>
              ✨ Groq AI Tutor {aiResponse ? `- ${aiResponse.topic}` : ''}
            </h3>
            {aiResponse && (
              <button 
                onClick={() => setAiResponse(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: '#64748b' }}
              >
                &times;
              </button>
            )}
          </div>
          
          {isLoading ? (
            <p style={{ color: '#64748b', fontStyle: 'italic', margin: 0 }}>
              Generating personalized study content with Groq AI...
            </p>
          ) : (
            <div style={{ color: '#334155', lineHeight: '1.6', whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>
              {aiResponse.content}
            </div>
          )}
        </motion.section>
      )}


      {/* ================= COURSE OVERVIEW ================= */}

      <motion.section
        className="course-overview-card"
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >

        <div className="overview-item">
          <span>📚</span>
          <div>
            <strong>{topics.length}</strong>
            <small>Topics</small>
          </div>
        </div>

        <div className="overview-divider" />

        <div className="overview-item">
          <span>✨</span>
          <div>
            <strong>AI</strong>
            <small>Learning Tools</small>
          </div>
        </div>

        <div className="overview-divider" />

        <div className="overview-item">
          <span>🎯</span>
          <div>
            <strong>Practice</strong>
            <small>Quizzes & Questions</small>
          </div>
        </div>

        <button
          className="course-start-learning"
          onClick={() => handleTopicClick(topics[0])}
        >
          Start Learning →
        </button>

      </motion.section>


      {/* ================= TOPICS ================= */}

      <section className="course-topics-section">

        <div className="course-topics-heading">
          <div>
            <span>LEARNING PATH</span>
            <h2>Course Topics</h2>
            <p>
              Follow the topics step by step and build your
              understanding.
            </p>
          </div>

          <div className="topic-progress">
            <strong>0%</strong>
            <span>Completed</span>
          </div>
        </div>


        <div className="course-topic-list">

          {topics.map((topic, index) => (

            <motion.div
              key={topic.title}
              className="course-topic-card"

              initial={{
                opacity: 0,
                x: -25,
              }}

              whileInView={{
                opacity: 1,
                x: 0,
              }}

              viewport={{
                once: true,
              }}

              transition={{
                duration: 0.45,
                delay: index * 0.06,
              }}

              whileHover={{
                y: -3,
              }}
            >

              <div className="topic-number">
                {String(index + 1).padStart(2, "0")}
              </div>

              <div className="topic-icon">
                {topic.icon}
              </div>

              <div className="topic-content">

                <div className="topic-title-row">

                  <h3>{topic.title}</h3>

                  <span>
                    {topic.duration}
                  </span>

                </div>

                <p>{topic.description}</p>

                <div className="topic-actions">

                 <button
  onClick={() => handleTopicClick(topic)}
  className="topic-study-button"
>
  Study Topic →
</button>

                  <span className="topic-status">
                    🔒 Not Started
                  </span>

                </div>

              </div>

            </motion.div>

          ))}

        </div>

      </section>


      {/* ================= AI STUDY CARD ================= */}

      <motion.section
        className="course-ai-study-card"

        initial={{
          opacity: 0,
          y: 30,
        }}

        whileInView={{
          opacity: 1,
          y: 0,
        }}

        viewport={{
          once: true,
        }}
      >

        <div className="course-ai-study-icon">
          ✨
        </div>

        <div>
          <span>AI-POWERED STUDY</span>

          <h2>
            Learn faster with LERNIQ
          </h2>

          <p>
            Use your study material to generate summaries,
            important notes, questions, quizzes and AI tutoring.
          </p>
        </div>

        <button
          onClick={onStartLearning}
          className="course-ai-study-button"
        >
          Open AI Workspace →
        </button>

      </motion.section>

    </div>
  );
}

export default CourseDetails;