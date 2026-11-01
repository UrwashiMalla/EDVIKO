import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../context/useAuth";
import { studentApi } from "../services/api";
import { getInstitutionName } from "../services/frontendStorage";
import Navbar from "./Navbar";
import "./StudentProfile.css";

function StudentProfile() {
  const { user, updateUser, refreshUser } = useAuth();
  const fileInputRef = useRef(null);

  // Profile data states
  const [studentName, setStudentName] = useState(user?.name || "");
  const [gradeOrClass, setGradeOrClass] = useState("");
  const [avatar, setAvatar] = useState(user?.avatar || "");
  const [teacherCode, setTeacherCode] = useState("");
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [institutionName, setInstitutionName] = useState(getInstitutionName());

  // UI interaction states
  const [isEditing, setIsEditing] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Sync state with auth user
  useEffect(() => {
    if (user?.name) setStudentName(user.name);
    if (user?.avatar) setAvatar(user.avatar);
  }, [user]);

  // Load existing profile details from backend
  useEffect(() => {
    let ignore = false;
    const fetchProfile = async () => {
      try {
        const res = await studentApi.getDashboard();
        if (!ignore && res.profile) {
          setGradeOrClass(res.profile.gradeOrClass || "College / University");
          if (res.profile.avatar && !avatar) {
            setAvatar(res.profile.avatar);
          }
          if (res.profile.teacherId) {
            setTeacherInfo(res.profile.teacherId);
          }
        }
      } catch (err) {
        console.warn("Failed to load profile details:", err.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchProfile();
    setInstitutionName(getInstitutionName());

    return () => {
      ignore = true;
    };
  }, []);

  // Calculate profile completion based strictly on existing required profile fields
  const completionItems = [
    { label: "Student Full Name", done: Boolean(studentName && studentName.trim()) },
    { label: "Email Address", done: Boolean(user?.email) },
    { label: "Email Verification", done: Boolean(user?.isVerified) },
    { label: "Academic Level / Course", done: Boolean(gradeOrClass && gradeOrClass.trim()) },
    { label: "Profile Picture", done: Boolean(avatar) },
    { label: "Faculty Mentor", done: Boolean(teacherInfo) },
  ];
  const completedCount = completionItems.filter((i) => i.done).length;
  const completionPercentage = Math.round((completedCount / completionItems.length) * 100);

  // Missing field hints
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
          // Normalize and resize to max 360x360 px for fast loading and crisp resolution
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

          // Update frontend context and localStorage immediately
          if (updateUser) {
            updateUser({ avatar: base64Avatar });
          }

          // Persist to backend database
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
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // ==========================================
  // SAVE PROFILE CHANGES
  // ==========================================
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      // 1. Update student name in auth state & local cache
      if (studentName.trim() && updateUser) {
        updateUser({ name: studentName.trim() });
      }

      // 2. Call backend profile update
      const res = await studentApi.updateProfile({
        name: studentName.trim(),
        gradeOrClass: gradeOrClass.trim(),
        teacherCode: teacherCode.trim() || undefined,
        avatar,
      });

      setMessage("Profile changes saved successfully!");
      if (res.profile?.teacherId) {
        setTeacherInfo(res.profile.teacherId);
      }
      setTeacherCode("");
      setIsEditing(false);

      if (refreshUser) {
        await refreshUser();
      }

      setTimeout(() => setMessage(""), 5000);
    } catch (err) {
      setError(err.message || "Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="student-profile-container">
        <Navbar activeTab="profile" />
        <div style={{ textAlign: "center", padding: "100px 0", color: "#7c3aed", fontWeight: "700" }}>
          ⏳ Loading student profile...
        </div>
      </div>
    );
  }

  const initialLetter = studentName ? studentName.trim().charAt(0).toUpperCase() : (user?.name?.charAt(0).toUpperCase() || "S");

  return (
    <div className="student-profile-container">
      <Navbar activeTab="profile" />

      <main className="profile-main-content">
        {/* Page Header */}
        <div className="profile-page-header">
          <h1>Student Profile</h1>
          <p>Manage your student credentials, learning details, and faculty mentor connection.</p>
        </div>

        {/* Success Alert */}
        {message && (
          <motion.div
            className="profile-alert profile-alert-success"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span>✅ {message}</span>
            <button className="alert-dismiss-btn" onClick={() => setMessage("")}>✕</button>
          </motion.div>
        )}

        {/* Error Alert */}
        {error && (
          <motion.div
            className="profile-alert profile-alert-error"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span>⚠️ {error}</span>
            <button className="alert-dismiss-btn" onClick={() => setError("")}>✕</button>
          </motion.div>
        )}

        {/* =========================================================
            1. HERO CARD (Avatar + Name + Status + Edit Action)
        ========================================================== */}
        <motion.div
          className="profile-hero-card"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="hero-left">
            {/* Circular Profile Avatar with Camera Button */}
            <div className="profile-avatar-wrapper">
              <div className="profile-avatar-circle">
                {avatar ? (
                  <img src={avatar} alt={studentName} className="profile-avatar-img" />
                ) : (
                  <div className="profile-avatar-fallback">{initialLetter}</div>
                )}
                {isUploadingAvatar && (
                  <div className="profile-avatar-spinner">⏳</div>
                )}
              </div>

              {/* Camera Upload Button */}
              <label
                className="profile-avatar-camera-btn"
                title="Click to upload or change profile photo"
              >
                <span className="camera-icon">📷</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/*"
                  onChange={handleAvatarFileChange}
                  disabled={isUploadingAvatar}
                  style={{ display: "none" }}
                />
              </label>
            </div>

            {/* Student Name & Email Details */}
            <div className="hero-details">
              <h2>{studentName || user?.name || "Student"}</h2>
              <div className="hero-email">
                <span>{user?.email}</span>
                <span className={`verification-pill ${user?.isVerified ? "verified" : "unverified"}`}>
                  {user?.isVerified ? "✓ Verified" : "⚠️ Unverified"}
                </span>
              </div>
              <div className="hero-badges">
                <span className="role-badge">🎓 Student Account</span>
                {gradeOrClass && (
                  <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>
                    • {gradeOrClass}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Edit Profile Action Toggle */}
          <button
            type="button"
            className={`edit-profile-toggle-btn ${isEditing ? "active" : ""}`}
            onClick={() => {
              setIsEditing(!isEditing);
              setError("");
            }}
          >
            <span>{isEditing ? "✕ Cancel Editing" : "✎ Edit Profile"}</span>
          </button>
        </motion.div>

        {/* =========================================================
            2. PROFILE COMPLETION INDICATOR
        ========================================================== */}
        <div className="profile-completion-card">
          <div className="completion-header">
            <span className="completion-title">
              <span>🎯</span>
              <span>Profile Strength & Completion</span>
            </span>
            <span className="completion-pct">{completionPercentage}%</span>
          </div>

          <div className="completion-bar-track">
            <div
              className="completion-bar-fill"
              style={{ width: `${completionPercentage}%` }}
            ></div>
          </div>

          <p className="completion-tip">
            {completionPercentage === 100 ? (
              <span>✨ Excellent! All core profile information is complete.</span>
            ) : (
              <span>
                💡 Suggestion: Complete <strong>{missingFields.slice(0, 2).join(", ")}</strong> to reach 100%.
              </span>
            )}
          </p>
        </div>

        {/* =========================================================
            3. PROFILE DETAILS CARD (View Mode vs Edit Mode)
        ========================================================== */}
        <motion.div
          className="profile-details-card"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="details-card-header">
            <h3>{isEditing ? "Edit Student Details" : "Academic & Profile Information"}</h3>
            {!isEditing && (
              <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
                Click "Edit Profile" above to make changes
              </span>
            )}
          </div>

          {/* VIEW MODE: Structured Tiles */}
          {!isEditing ? (
            <div className="details-grid">
              {/* Full Name */}
              <div className="detail-tile">
                <div className="tile-label">
                  <span>👤</span>
                  <span>Student Full Name</span>
                </div>
                <div className="tile-value">{studentName || "Not set"}</div>
                <div className="tile-subtext">Displayed across your dashboard and quizzes</div>
              </div>

              {/* Email Address */}
              <div className="detail-tile">
                <div className="tile-label">
                  <span>✉️</span>
                  <span>Email Address</span>
                </div>
                <div className="tile-value">{user?.email || "Not set"}</div>
                <div className="tile-subtext">Primary contact and login identifier</div>
              </div>

              {/* Academic Level */}
              <div className="detail-tile">
                <div className="tile-label">
                  <span>📚</span>
                  <span>Academic Level / Course</span>
                </div>
                <div className="tile-value">{gradeOrClass || "College / University"}</div>
                <div className="tile-subtext">Customizes your AI tutor explanations</div>
              </div>

              {/* Affiliated Institution (Locked) */}
              <div className="detail-tile institution-tile">
                <div className="tile-label">
                  <span>🏛️</span>
                  <span>Affiliated Institution</span>
                  <span className="lock-badge">🔒 Read-Only</span>
                </div>
                <div className="tile-value">{institutionName}</div>
                <div className="tile-subtext">Configured by your faculty mentor</div>
              </div>

              {/* Assigned Faculty Mentor */}
              <div className="detail-tile full-width">
                <div className="tile-label">
                  <span>👨‍🏫</span>
                  <span>Assigned Faculty Mentor</span>
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
                      Connected mentor for notes, quizzes, and academic evaluations.
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="tile-value" style={{ color: "#64748b", fontWeight: "500" }}>
                      No faculty mentor linked yet.
                    </div>
                    <div className="tile-subtext">
                      Click "Edit Profile" to enter your teacher's code (e.g. TEACH-101).
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* EDIT MODE: Form Inputs */
            <form onSubmit={handleSave} className="profile-edit-form">
              {/* Full Name */}
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

              {/* Academic Level */}
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

              {/* Affiliated Institution (Read-Only) */}
              <div className="detail-tile institution-tile" style={{ margin: "4px 0" }}>
                <div className="tile-label">
                  <span>🏛️</span>
                  <span>Affiliated Institution</span>
                  <span className="lock-badge">🔒 Set by Faculty Mentor (Read-Only)</span>
                </div>
                <div className="tile-value">{institutionName}</div>
                <div className="tile-subtext">
                  Your university/college affiliation is managed by your faculty supervisor.
                </div>
              </div>

              {/* Mentor Code Box */}
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
                    Join or Change Teacher Code (e.g. TEACH-101)
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

              {/* Form Action Buttons */}
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
      </main>
    </div>
  );
}

export default StudentProfile;
