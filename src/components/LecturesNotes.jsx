import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { getUploadedNotes, getUploadedLectures, onLerniqSync } from "../services/frontendStorage";
import { studentApi } from "../services/api";
import { useAuth } from "../context/useAuth";
import Navbar from "./Navbar";
import "./LecturesNotes.css";

function LecturesNotes() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [allMaterials, setAllMaterials] = useState([]);
  const [filterType, setFilterType] = useState("all"); // "all", "lecture", "note"
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeModalItem, setActiveModalItem] = useState(null);
  const [facultyInfo, setFacultyInfo] = useState({
    name: "Faculty Instructor",
    code: "",
    subject: "Computer Science & AI",
  });
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();

  // Support tab filtering via URL query params (?tab=notes or ?tab=lectures)
  useEffect(() => {
    const tab = searchParams.get("tab") || searchParams.get("type");
    if (tab === "notes" || tab === "note") {
      setFilterType("note");
    } else if (tab === "lectures" || tab === "lecture") {
      setFilterType("lecture");
    }
  }, [searchParams]);

  // Support auto-opening a specific lecture or note (?id=...)
  useEffect(() => {
    const targetId = searchParams.get("id");
    if (targetId && allMaterials.length > 0 && !activeModalItem) {
      const match = allMaterials.find((m) => String(m.id) === String(targetId));
      if (match) {
        setActiveModalItem(match);
      }
    }
  }, [searchParams, allMaterials, activeModalItem]);

  const loadMaterials = async () => {
    let fetchedLecs = [];
    let fetchedNotes = [];

    try {
      const [lecRes, noteRes, dashRes] = await Promise.all([
        studentApi.getLectures().catch(() => null),
        studentApi.getNotes().catch(() => null),
        studentApi.getDashboard().catch(() => null),
      ]);

      if (dashRes && dashRes.success && dashRes.stats) {
        setFacultyInfo({
          name: dashRes.stats.enrolledTeacherName || "Faculty Instructor",
          code: dashRes.stats.classroomCode || "",
          subject: dashRes.activeTeacherProfile?.subject || "General Academics",
        });
      }

      if (lecRes && lecRes.success && Array.isArray(lecRes.lectures)) {
        fetchedLecs = lecRes.lectures.map((l) => ({
          id: l._id || l.id,
          type: "lecture",
          title: l.title,
          subject: l.subject || "General",
          teacher: l.teacherName || "Faculty Instructor",
          date: l.createdAt
            ? new Date(l.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "Recent",
          duration: l.duration || "40 min",
          videoEmbedUrl: l.videoEmbedUrl || "https://www.youtube.com/embed/JMUxmLyrhSk",
          description: l.description,
          takeaways: l.takeaways || [],
          content: l.content || l.description,
        }));
      }

      if (noteRes && noteRes.success && Array.isArray(noteRes.notes)) {
        fetchedNotes = noteRes.notes.map((n) => ({
          id: n._id || n.id,
          type: "note",
          title: n.title,
          subject: n.subject || "General",
          teacher: n.teacherName || "Faculty Instructor",
          date: n.createdAt
            ? new Date(n.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "Recent",
          format: `${n.fileSize || "1.2 MB"} • ${n.pages || "Handout"}`,
          description: n.description,
          takeaways: [n.description || "Review notes for problem sets."],
          content: n.content || n.description,
          fileName: n.fileName,
        }));
      }
    } catch (err) {
      console.warn("Could not fetch remote classroom materials:", err.message);
    }

    if (fetchedLecs.length > 0 || fetchedNotes.length > 0) {
      setAllMaterials([...fetchedLecs, ...fetchedNotes]);
    } else {
      const localNotes = getUploadedNotes().map((n) => ({
        id: n.id,
        type: "note",
        title: n.title,
        subject: n.subject || "General",
        teacher: "Faculty Instructor",
        date: n.date,
        format: n.pages || "PDF Handout",
        description: n.description,
        takeaways: [n.description, "Review lecture materials for additional examples."],
        content: n.content || n.description,
      }));
      const localLecs = getUploadedLectures().map((l) => ({
        id: l.id,
        type: "lecture",
        title: l.title,
        subject: l.subject || "General",
        teacher: "Faculty Instructor",
        date: l.date,
        duration: l.duration || "40 min",
        videoEmbedUrl: l.videoEmbedUrl || "https://www.youtube.com/embed/JMUxmLyrhSk",
        description: l.description,
        takeaways: l.takeaways || [],
        content: l.description,
      }));
      setAllMaterials([...localLecs, ...localNotes]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadMaterials();
    const unsubscribe = onLerniqSync((detail) => {
      if (
        detail.type === "NOTE_UPLOADED" ||
        detail.type === "NOTE_DELETED" ||
        detail.type === "LECTURE_UPLOADED" ||
        detail.type === "LECTURE_DELETED"
      ) {
        loadMaterials();
      }
    });
    return unsubscribe;
  }, []);

  const dynamicSubjects = Array.from(new Set(allMaterials.map((m) => m.subject).filter(Boolean)));
  const subjects = ["all", ...(dynamicSubjects.length > 0 ? dynamicSubjects : ["General"])];

  const filteredMaterials = allMaterials.filter((item) => {
    const matchesType = filterType === "all" || item.type === filterType;
    const matchesSubject = selectedSubject === "all" || item.subject === selectedSubject;
    const q = searchQuery.toLowerCase();
    const matchesQuery =
      item.title.toLowerCase().includes(q) ||
      item.subject.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q));
    return matchesType && matchesSubject && matchesQuery;
  });

  const handleOpenTutor = (item) => {
    navigate(`/student/chat?topic=${encodeURIComponent(item.title)}`);
  };

  const handleDownloadNote = (item) => {
    const blob = new Blob([item.content || item.description || ""], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = item.fileName || `${item.title.replace(/\s+/g, "_")}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const lectureCount = allMaterials.filter((m) => m.type === "lecture").length;
  const noteCount = allMaterials.filter((m) => m.type === "note").length;

  return (
    <div className="lectures-notes-page">
      <Navbar activeTab="lectures-notes" />

      <main className="ln-container">
        {/* ================= HEADER ================= */}
        <motion.div
          className="ln-header"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div>
            <span className="ln-badge">FACULTY CURATED MATERIAL 🎓</span>
            <h1>Lectures & Notes</h1>
            <p>
              Explore video lectures and detailed revision notes uploaded directly by your
              faculty. Study at your own pace or ask your AI Tutor for instant explanations.
            </p>
          </div>

          <div className="teacher-badge-card">
            <div className="teacher-badge-label">ASSIGNED FACULTY</div>
            <div className="teacher-badge-name">{facultyInfo.name}</div>
            <div className="teacher-badge-code">
              {facultyInfo.code ? `Classroom Code: ${facultyInfo.code} • ` : ""}{facultyInfo.subject}
            </div>
          </div>
        </motion.div>

        {/* ================= CONTROLS ================= */}
        <div className="ln-controls">
          <div className="ln-tabs-row">
            {/* Filter Tabs */}
            <div className="ln-filter-tabs">
              <button
                className={`ln-filter-tab ${filterType === "all" ? "active" : ""}`}
                onClick={() => setFilterType("all")}
              >
                All Materials ({allMaterials.length})
              </button>
              <button
                className={`ln-filter-tab ${filterType === "lecture" ? "active" : ""}`}
                onClick={() => setFilterType("lecture")}
              >
                🎥 Video Lectures ({lectureCount})
              </button>
              <button
                className={`ln-filter-tab ${filterType === "note" ? "active" : ""}`}
                onClick={() => setFilterType("note")}
              >
                📝 Study Notes ({noteCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="ln-search-box">
              <span className="ln-search-icon">🔍</span>
              <input
                type="text"
                className="ln-search-input"
                placeholder="Search lectures or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Subject Pills */}
          <div className="subject-pills">
            {subjects.map((sub) => (
              <button
                key={sub}
                className={`subject-pill ${selectedSubject === sub ? "active" : ""}`}
                onClick={() => setSelectedSubject(sub)}
              >
                {sub === "all" ? "All Subjects" : sub}
              </button>
            ))}
          </div>
        </div>

        {/* ================= MATERIALS GRID ================= */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#64748b" }}>
            <span style={{ fontSize: "32px", display: "block", marginBottom: "8px" }}>⏳</span>
            Loading classroom materials...
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              background: "#ffffff",
              borderRadius: "20px",
              border: "1px dashed #e9d5ff",
              marginTop: "20px",
            }}
          >
            <span style={{ fontSize: "40px" }}>
              {allMaterials.length === 0 ? "📚" : "🔍"}
            </span>
            <h3 style={{ margin: "12px 0 6px", color: "#1e1b4b" }}>
              {allMaterials.length === 0
                ? "No materials published yet"
                : "No matching materials found"}
            </h3>
            <p style={{ color: "#6b7280", margin: 0 }}>
              {allMaterials.length === 0
                ? "When your instructor uploads video lectures or study notes to your classroom, they will appear here automatically."
                : 'Try clearing your search query or selecting "All Subjects".'}
            </p>
          </div>
        ) : (
          <div className="ln-grid">
            {filteredMaterials.map((item, idx) => (
              <motion.div
                key={item.id}
                className="ln-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
              >
                <div>
                  <div className="ln-card-top">
                    <span className={`type-tag ${item.type}`}>
                      {item.type === "lecture" ? "🎥 Lecture" : "📝 Notes"}
                    </span>
                    <span className="subject-tag">{item.subject}</span>
                  </div>

                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>

                <div>
                  <div className="ln-meta">
                    <span>👤 {item.teacher}</span>
                    <span>{item.type === "lecture" ? `⏱️ ${item.duration}` : `📄 ${item.format}`}</span>
                  </div>

                  <div className="ln-card-actions">
                    <button
                      className="view-btn"
                      onClick={() => setActiveModalItem(item)}
                    >
                      {item.type === "lecture" ? "▶ Watch Lecture" : "📖 View Notes"}
                    </button>

                    <button
                      className="tutor-btn"
                      onClick={() => handleOpenTutor(item)}
                      title="Ask AI Tutor about this topic"
                    >
                      <span>💬 Ask AI Tutor</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* ================= VIEWER MODAL ================= */}
      {activeModalItem && (
        <div className="modal-overlay" onClick={() => setActiveModalItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className={`type-tag ${activeModalItem.type}`}>
                  {activeModalItem.type === "lecture" ? "🎥 Video Lecture" : "📝 Study Notes"}
                </span>
                <h2 style={{ margin: "8px 0 4px", fontSize: "20px", color: "#1e1b4b" }}>
                  {activeModalItem.title}
                </h2>
                <div style={{ fontSize: "13px", color: "#6b7280" }}>
                  {activeModalItem.subject} • {activeModalItem.teacher} • {activeModalItem.date}
                </div>
              </div>

              <button className="close-btn" onClick={() => setActiveModalItem(null)}>
                ×
              </button>
            </div>

            <div className="modal-body">
              {activeModalItem.type === "lecture" ? (
                <div>
                  <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", borderRadius: "16px", marginBottom: "20px", background: "#000" }}>
                    <iframe
                      src={activeModalItem.videoEmbedUrl}
                      title={activeModalItem.title}
                      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>

                  {activeModalItem.takeaways && activeModalItem.takeaways.length > 0 && (
                    <>
                      <h3 style={{ fontSize: "16px", color: "#1e1b4b", marginBottom: "8px" }}>Key Lecture Takeaways</h3>
                      <ul style={{ paddingLeft: "20px", margin: "0 0 20px" }}>
                        {activeModalItem.takeaways.map((point, i) => (
                          <li key={i} style={{ marginBottom: "6px" }}>{point}</li>
                        ))}
                      </ul>
                    </>
                  )}

                  {activeModalItem.content && (
                    <>
                      <h3 style={{ fontSize: "16px", color: "#1e1b4b", marginBottom: "8px" }}>Lecture Transcript Summary</h3>
                      <div style={{ whiteSpace: "pre-wrap", background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                        {activeModalItem.content}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div>
                  {activeModalItem.takeaways && activeModalItem.takeaways.length > 0 && (
                    <div style={{ background: "#faf5ff", border: "1px solid #e9d5ff", padding: "16px", borderRadius: "14px", marginBottom: "20px" }}>
                      <h4 style={{ margin: "0 0 8px", color: "#6d28d9" }}>📌 High-Yield Takeaways</h4>
                      <ul style={{ paddingLeft: "20px", margin: 0 }}>
                        {activeModalItem.takeaways.map((point, i) => (
                          <li key={i} style={{ marginBottom: "4px" }}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <h3 style={{ fontSize: "16px", color: "#1e1b4b", marginBottom: "12px" }}>Complete Note Contents</h3>
                  <div style={{ whiteSpace: "pre-wrap", background: "#ffffff", padding: "20px", borderRadius: "14px", border: "1px solid #e2e8f0", fontFamily: "monospace", fontSize: "13px", lineHeight: 1.6 }}>
                    {activeModalItem.content}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  style={{
                    padding: "10px 18px",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    background: "#ffffff",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                  onClick={() => setActiveModalItem(null)}
                >
                  Close
                </button>

                {activeModalItem.type === "note" && (
                  <button
                    style={{
                      padding: "10px 18px",
                      borderRadius: "12px",
                      border: "1px solid #7c3aed",
                      background: "#f5f3ff",
                      color: "#6d28d9",
                      fontWeight: "700",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                    onClick={() => handleDownloadNote(activeModalItem)}
                  >
                    <span>⬇ Download Notes</span>
                  </button>
                )}
              </div>

              <button
                className="tutor-btn"
                onClick={() => {
                  const item = activeModalItem;
                  setActiveModalItem(null);
                  handleOpenTutor(item);
                }}
              >
                <span>💬 Discuss this in AI Chat</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LecturesNotes;
