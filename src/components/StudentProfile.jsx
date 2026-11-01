import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../context/useAuth";
import { studentApi, authApi } from "../services/api";
import { getInstitutionName } from "../services/frontendStorage";
import Navbar from "./Navbar";
import "./StudentProfile.css";

function StudentProfile() {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef(null);

  // Profile data states
  const [studentName, setStudentName] = useState(user?.name || "");
  const [gradeOrClass, setGradeOrClass] = useState("");
  const [avatar, setAvatar] = useState(user?.avatar || "");
  const [teacherCode, setTeacherCode] = useState("");
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [activeTeacherProfile, setActiveTeacherProfile] = useState(null);
  const [classroomHistory, setClassroomHistory] = useState([]);
  const [availableTeachers, setAvailableTeachers] = useState([]);
  const [institutionName, setInstitutionName] = useState(getInstitutionName() || "University / College");

  // UI interaction states
  const [isEditing, setIsEditing] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingClassroom, setChangingClassroom] = useState(false);
  const [newTeacherCode, setNewTeacherCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Sync state with auth user
  useEffect(() => {
    if (user?.name) setStudentName(user.name);
    if (user?.avatar) setAvatar(user.avatar);
  }, [user]);

  // Load existing profile details from backend
  const fetchProfile = async () => {
    try {
      const [dashRes, teachRes] = await Promise.all([
        studentApi.getDashboard(),
        authApi.listTeachers().catch(() => ({ teachers: [] })),
      ]);

      if (dashRes.profile) {
        setGradeOrClass(dashRes.profile.gradeOrClass || "College / University");
        if (dashRes.profile.avatar && !avatar) {
          setAvatar(dashRes.profile.avatar);
        }
        if (dashRes.profile.teacherId) {
          setTeacherInfo(dashRes.profile.teacherId);
        }
        if (dashRes.profile.classroomHistory) {
          setClassroomHistory(dashRes.profile.classroomHistory);
        }
      }

      if (dashRes.activeTeacherProfile) {
        setActiveTeacherProfile(dashRes.activeTeacherProfile);
        if (dashRes.activeTeacherProfile.universityOrCollege) {
          setInstitutionName(dashRes.activeTeacherProfile.universityOrCollege);
        }
      }

      if (teachRes.teachers) {
        setAvailableTeachers(teachRes.teachers);
      }
    } catch (err) {
      console.warn("Failed to load profile details:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    const inst = getInstitutionName();
    if (inst) setInstitutionName(inst);
  }, []);

  // Calculate profile completion based strictly on existing required profile fields
  const completionItems = [
    { label: "Student Full Name", done: Boolean(studentName && studentName.trim()) },
    { label: "Email Address", done: Boolean(user?.email) },
    { label: "Academic Level / Course", done: Boolean(gradeOrClass && gradeOrClass.trim()) },
    { label: "Profile Picture", done: Boolean(avatar) },
    { label: "Faculty Mentor / Classroom", done: Boolean(teacherInfo) },
  ];
  const completedCount = completionItems.filter((i) => i.done).length;
  const completionPercentage = Math.round((completedCount / completionItems.length) * 100);
  const missingFields = completionItems.filter((i) => !i.done).map((i) => i.label);

  // ==========================================
  // PROFILE IMAGE UPLOAD & RESIZING
  // ==========================================
  const handleAvatarFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (JPG, PNG, or WEBP).");
      return;
    }

    setIsUploadingAvatar(true);
    setError("");
    setMessage("");

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const canvas = document.createElement("canvas");
          const maxDim = 360;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          const base64Avatar = canvas.toDataURL("image/jpeg", 0.88);

          setAvatar(base64Avatar);

          if (updateUser) {
            updateUser({ avatar: base64Avatar });
          }

          await studentApi.updateProfile({ avatar: base64Avatar });

          setMessage("Profile picture updated successfully!");
          setTimeout(() => setMessage(""), 4000);
        } catch (err) {
          setError("Failed to save profile picture: " + (err.message || "Please try again."));
        } finally {
          setIsUploadingAvatar(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      };
      img.onerror = () => {
        setError("Failed to process image file. Please try another image.");
        setIsUploadingAvatar(false);
      };
      img.src = event.target.result;
    };
    reader.onerror = () => {
      setError("Failed to read image file.");
      setIsUploadingAvatar(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = async () => {
    try {
      setIsUploadingAvatar(true);
      setError("");
      setAvatar("");
      if (updateUser) {
        updateUser({ avatar: "" });
      }
      await studentApi.updateProfile({ avatar: "" });
      setMessage("Profile picture removed.");
      setTimeout(() => setMessage(""), 4000);
    } catch (err) {
      setError("Failed to remove avatar: " + err.message);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // ==========================================
  // SAVE PROFILE DETAILS
  // ==========================================
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      if (studentName.trim() && updateUser) {
        updateUser({ name: studentName.trim() });
      }

      const res = await studentApi.updateProfile({
        name: studentName.trim(),
        gradeOrClass: gradeOrClass.trim(),
        avatar,
      });

      // If user also provided teacherCode in edit form
      if (teacherCode && teacherCode.trim()) {
        try {
          const switchRes = await studentApi.changeClassroom({ teacherCode: teacherCode.trim() });
          if (switchRes.profile) {
            setTeacherInfo(switchRes.profile.teacherId);
            if (switchRes.profile.classroomHistory) {
              setClassroomHistory(switchRes.profile.classroomHistory);
            }
          }
        } catch (switchErr) {
          setError("Profile saved, but teacher code update failed: " + switchErr.message);
          setSaving(false);
          return;
        }
      }

      setMessage("Profile changes saved successfully!");
      if (res.profile?.teacherId) {
        setTeacherInfo(res.profile.teacherId);
      }
      setTeacherCode("");
      setIsEditing(false);
      setTimeout(() => setMessage(""), 4000);
    } catch (err) {
      setError(err.message || "Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // CHANGE CLASSROOM / TEACHER
  // ==========================================
  const handleChangeClassroom = async (e) => {
    e.preventDefault();
    if (!newTeacherCode.trim()) {
      setError("Please enter or select a valid classroom code.");
      return;
    }

    setChangingClassroom(true);
    setMessage("");
    setError("");

    try {
      const res = await studentApi.changeClassroom({ teacherCode: newTeacherCode.trim() });
      setMessage(res.message || "Successfully joined new classroom!");
      if (res.profile) {
        setTeacherInfo(res.profile.teacherId);
        if (res.profile.classroomHistory) {
          setClassroomHistory(res.profile.classroomHistory);
        }
      }
      setNewTeacherCode("");
      setTimeout(() => setMessage(""), 5000);
    } catch (err) {
      setError(err.message || "Failed to switch classroom.");
    } finally {
      setChangingClassroom(false);
    }
  };

  if (loading) {
    return (
      <div className="student-profile-page">
        <Navbar />
        <main className="profile-container">
          <div className="profile-loading-state">
            <div className="spinner"></div>
            <p>Loading your profile...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="student-profile-page">
      <Navbar />

      <main className="profile-container">
        {/* Alerts / Feedback */}
        {message && (
          <motion.div
            className="profile-alert success"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span>✅</span>
            <span>{message}</span>
          </motion.div>
        )}

        {error && (
          <motion.div
            className="profile-alert error"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span>⚠️</span>
            <span>{error}</span>
          </motion.div>
        )}

        {/* TOP HERO PROFILE CARD */}
        <motion.div
          className="profile-hero-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="hero-left">
            {/* AVATAR WRAPPER */}
            <div className="avatar-wrapper">
              {avatar ? (
                <img src={avatar} alt={studentName} className="avatar-img" />
              ) : (
                <div className="avatar-placeholder">
                  <span>{(studentName || user?.name || "S").charAt(0).toUpperCase()}</span>
                </div>
              )}

              {/* CAMERA OVERLAY BUTTON */}
              <button
                type="button"
                className="avatar-upload-badge"
                title="Upload profile picture"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
              >
                {isUploadingAvatar ? "⏳" : "📷"}
              </button>

              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarFileChange}
              />
            </div>

            {/* IDENTITY & ROLES */}
            <div className="identity-block">
              <div className="identity-badges">
                <span className="role-tag student">STUDENT</span>
                <span className="institution-tag">🏛️ {institutionName}</span>
              </div>
              <h1 className="student-display-name">{studentName || "Student"}</h1>
              <p className="student-username">
                @{user?.username || (user?.email ? user.email.split("@")[0] : "student")}
              </p>
              {avatar && (
                <button
                  type="button"
                  className="remove-avatar-btn"
                  onClick={handleRemoveAvatar}
                  disabled={isUploadingAvatar}
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>

          {/* TOP RIGHT: EDIT TOGGLE BUTTON */}
          <div className="hero-right">
            {!isEditing ? (
              <button
                type="button"
                className="edit-profile-btn"
                onClick={() => {
                  setIsEditing(true);
                  setMessage("");
                  setError("");
                }}
              >
                <span>✏️</span>
                <span>Edit Profile</span>
              </button>
            ) : (
              <button
                type="button"
                className="cancel-edit-btn"
                onClick={() => {
                  setIsEditing(false);
                  setError("");
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </motion.div>

        {/* PROFILE COMPLETION PROGRESS CARD */}
        <motion.div
          className="completion-card"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="completion-header">
            <div>
              <h3>Profile Completion</h3>
              <p>Keep your student details accurate for personalized AI summaries and faculty evaluations.</p>
            </div>
            <div className="completion-badge">
              <strong>{completionPercentage}%</strong>
            </div>
          </div>

          <div className="progress-track-bg">
            <motion.div
              className="progress-fill"
              initial={{ width: 0 }}
              animate={{ width: `${completionPercentage}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>

          {missingFields.length > 0 ? (
            <div className="missing-items-hint">
              <span className="hint-icon">💡</span>
              <span>Complete for 100%: </span>
              <strong>{missingFields.join(" • ")}</strong>
            </div>
          ) : (
            <div className="missing-items-hint complete">
              <span className="hint-icon">🎉</span>
              <span>All essential profile information is complete!</span>
            </div>
          )}
        </motion.div>

        {/* MAIN PROFILE DETAILS CARD */}
        <motion.div
          className="profile-details-card"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <div className="section-title-row">
            <h2>Academic & Account Information</h2>
            <span className="section-subtitle">
              {isEditing ? "Modify your profile settings below" : "View your official enrolled details"}
            </span>
          </div>

          {!isEditing ? (
            <div className="details-grid">
              {/* Full Name */}
              <div className="detail-tile">
                <div className="tile-label">
                  <span>👤</span>
                  <span>Full Name</span>
                </div>
                <div className="tile-value">{studentName || "Not set"}</div>
                <div className="tile-subtext">Displayed across your tests, certificates, and chat.</div>
              </div>

              {/* Username */}
              <div className="detail-tile">
                <div className="tile-label">
                  <span>🆔</span>
                  <span>Username</span>
                </div>
                <div className="tile-value">{user?.username || user?.name || "Student"}</div>
                <div className="tile-subtext">Used to sign in directly to your EDVIKO account.</div>
              </div>

              {/* Email */}
              <div className="detail-tile">
                <div className="tile-label">
                  <span>✉️</span>
                  <span>Email Address</span>
                </div>
                <div className="tile-value">{user?.email || "No email"}</div>
                <div className="tile-subtext">Associated with your account and activity records.</div>
              </div>

              {/* Academic Level */}
              <div className="detail-tile">
                <div className="tile-label">
                  <span>📚</span>
                  <span>Academic Level / Course</span>
                </div>
                <div className="tile-value">{gradeOrClass || "College / University"}</div>
                <div className="tile-subtext">Guides the EDVIKO AI tutor's conceptual explanations.</div>
              </div>

              {/* Connected Faculty Mentor */}
              <div className="detail-tile full-width mentor-tile">
                <div className="tile-label">
                  <span>👨‍🏫</span>
                  <span>Assigned Faculty / Mentor</span>
                </div>
                {teacherInfo ? (
                  <div>
                    <div className="tile-value">
                      {teacherInfo.name}{" "}
                      <span style={{ fontSize: "13px", fontWeight: "600", color: "#6d28d9" }}>
                        ({teacherInfo.email})
                      </span>
                    </div>
                    <div className="tile-subtext" style={{ marginTop: "6px" }}>
                      Classroom Code: <strong>{activeTeacherProfile?.teacherCode || "TEACH-101"}</strong> • Connected mentor for notes, quizzes, and academic evaluations.
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="tile-value" style={{ color: "#64748b", fontWeight: "500" }}>
                      No faculty mentor linked yet.
                    </div>
                    <div className="tile-subtext">
                      Click "Edit Profile" or use the classroom switcher below to connect with an instructor.
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSave} className="profile-edit-form">
              <div className="form-group">
                <label>Student Full Name <span>*</span></label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Enter your student full name"
                  required
                />
                <small>You can change your displayed student name anytime.</small>
              </div>

              <div className="form-group">
                <label>Academic Level / Course</label>
                <input
                  type="text"
                  value={gradeOrClass}
                  onChange={(e) => setGradeOrClass(e.target.value)}
                  placeholder="e.g. B.Tech Computer Science / Grade 12"
                />
                <small>Helps the EDVIKO AI Tutor tune explanations to your level.</small>
              </div>

              <div className="mentor-edit-box">
                <div className="tile-label" style={{ color: "#4c1d95", marginBottom: "8px" }}>
                  <span>👨‍🏫</span>
                  <span>Faculty Mentor Connection</span>
                </div>
                {teacherInfo ? (
                  <p style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#475569" }}>
                    Currently linked with: <strong>{teacherInfo.name}</strong> ({teacherInfo.email})
                  </p>
                ) : (
                  <p style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#64748b" }}>
                    No faculty mentor linked yet. Enter your instructor's code below to join their class.
                  </p>
                )}

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: "12px", color: "#475569" }}>
                    Change Teacher Code (e.g. TEACH-101)
                  </label>
                  <input
                    type="text"
                    value={teacherCode}
                    onChange={(e) => setTeacherCode(e.target.value)}
                    placeholder="Enter teacher code"
                    style={{ borderColor: "#d8b4fe" }}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="cancel-edit-btn"
                  onClick={() => {
                    setIsEditing(false);
                    setError("");
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="save-profile-btn"
                  disabled={saving}
                >
                  {saving ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            </form>
          )}
        </motion.div>

        {/* CHANGE CLASSROOM & CLASSROOM HISTORY SECTION */}
        <motion.div
          className="profile-details-card"
          style={{ marginTop: "24px" }}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <div className="section-title-row">
            <h2>🏫 Classroom Management</h2>
            <span className="section-subtitle">
              Switch your teacher or classroom anytime. All previous quiz scores and study materials remain safely preserved.
            </span>
          </div>

          <form onSubmit={handleChangeClassroom} className="classroom-switch-form">
            <div className="classroom-switch-row">
              <div className="classroom-input-wrap">
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Enter New Classroom Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. TEACH-101 or EDV-XXXX"
                  value={newTeacherCode}
                  onChange={(e) => setNewTeacherCode(e.target.value.toUpperCase())}
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: "10px",
                    border: "1.5px solid #cbd5e1",
                    fontSize: "14px",
                    fontWeight: "600",
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>

              {availableTeachers.length > 0 && (
                <div className="classroom-input-wrap">
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                    Or Pick Available Faculty
                  </label>
                  <select
                    onChange={(e) => setNewTeacherCode(e.target.value)}
                    value={newTeacherCode}
                    style={{
                      width: "100%",
                      padding: "11px 14px",
                      borderRadius: "10px",
                      border: "1.5px solid #cbd5e1",
                      fontSize: "14px",
                      fontWeight: "600",
                      background: "#fff",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  >
                    <option value="">-- Select Instructor --</option>
                    {availableTeachers.map((t) => (
                      <option key={t.teacherCode} value={t.teacherCode}>
                        {t.name} ({t.teacherCode} - {t.department})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={changingClassroom || !newTeacherCode.trim()}
                className="classroom-switch-btn"
              >
                {changingClassroom ? "Connecting..." : "Switch Classroom →"}
              </button>
            </div>
          </form>

          {/* Classroom History Timeline */}
          <div className="history-timeline">
            <h3>Classroom & Teacher History</h3>
            {classroomHistory && classroomHistory.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {classroomHistory.map((item, idx) => (
                  <div key={idx} className="history-card-item">
                    <div>
                      <strong style={{ color: "#1e293b", fontSize: "14px" }}>{item.teacherName || "Faculty Instructor"}</strong>
                      <span style={{ color: "#64748b", marginLeft: "8px", fontWeight: "600" }}>Code: {item.teacherCode}</span>
                      {!item.leftAt && <span className="history-active-tag">Active</span>}
                    </div>
                    <div style={{ color: "#64748b", fontSize: "12px", fontWeight: "500" }}>
                      Joined: {new Date(item.joinedAt).toLocaleDateString()}
                      {item.leftAt ? ` • Departed: ${new Date(item.leftAt).toLocaleDateString()}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: "13px", color: "#64748b" }}>
                No previous classrooms on record.
              </p>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}

export default StudentProfile;
