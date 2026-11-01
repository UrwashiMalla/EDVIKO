import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../context/useAuth";
import { studentApi, authApi } from "../services/api";
import Navbar from "./Navbar";

function StudentProfile() {
  const { user, updateUser, refreshUser } = useAuth();

  const [studentName, setStudentName] = useState(user?.name || "");
  const [gradeOrClass, setGradeOrClass] = useState("");
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [activeTeacherProfile, setActiveTeacherProfile] = useState(null);
  const [classroomHistory, setClassroomHistory] = useState([]);
  const [newTeacherCode, setNewTeacherCode] = useState("");
  const [availableTeachers, setAvailableTeachers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingClassroom, setChangingClassroom] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.name) setStudentName(user.name);
  }, [user]);

  const fetchProfileData = async () => {
    try {
      const [dashRes, teachRes] = await Promise.all([
        studentApi.getDashboard(),
        authApi.listTeachers().catch(() => ({ teachers: [] })),
      ]);

      if (dashRes.profile) {
        setGradeOrClass(dashRes.profile.gradeOrClass || "College / University");
        if (dashRes.profile.teacherId) {
          setTeacherInfo(dashRes.profile.teacherId);
        }
        if (dashRes.profile.classroomHistory) {
          setClassroomHistory(dashRes.profile.classroomHistory);
        }
      }

      if (dashRes.activeTeacherProfile) {
        setActiveTeacherProfile(dashRes.activeTeacherProfile);
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
    fetchProfileData();
  }, []);

  // Save personal profile details
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      if (studentName.trim() && updateUser) {
        updateUser({ name: studentName.trim() });
      }

      await studentApi.updateProfile({
        name: studentName.trim(),
        gradeOrClass,
      });

      setMessage("Personal profile details updated successfully!");
      await refreshUser();
    } catch (err) {
      setError(err.message || "Failed to update profile details.");
    } finally {
      setSaving(false);
    }
  };

  // Change Classroom / Teacher
  const handleChangeClassroom = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!newTeacherCode.trim()) {
      setError("Please enter the new teacher's classroom code.");
      return;
    }

    setChangingClassroom(true);
    try {
      const res = await studentApi.changeClassroom({
        teacherCode: newTeacherCode.trim(),
      });

      setMessage(res.message || "Classroom switched successfully! All your previous learning records have been preserved.");
      setNewTeacherCode("");
      await fetchProfileData();
      await refreshUser();
    } catch (err) {
      setError(err.message || "Failed to change classroom. You may have been removed or the code is invalid.");
    } finally {
      setChangingClassroom(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#faf9ff" }}>
        <Navbar activeTab="profile" />
        <div style={{ textAlign: "center", padding: "80px 0", color: "#7c3aed", fontWeight: "600" }}>
          ⏳ Loading your profile and classroom records...
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#faf9ff" }}>
      <Navbar activeTab="profile" />

      <main style={{ maxWidth: "860px", margin: "40px auto", padding: "0 24px 60px 24px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#1f2937", marginBottom: "8px" }}>
          Student Profile & Classroom Management
        </h1>
        <p style={{ color: "#6b7280", marginBottom: "30px", fontSize: "15px" }}>
          Manage your personal learning credentials, active classroom enrollment, and view your historical teacher associations.
        </p>

        {message && (
          <div style={{ padding: "14px 20px", background: "#f0fdf4", color: "#166534", borderRadius: "14px", marginBottom: "20px", border: "1px solid #bbf7d0", fontWeight: "600" }}>
            ✅ {message}
          </div>
        )}

        {error && (
          <div style={{ padding: "14px 20px", background: "#fef2f2", color: "#991b1b", borderRadius: "14px", marginBottom: "20px", border: "1px solid #fecaca", fontWeight: "600" }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ background: "#fff", borderRadius: "24px", padding: "36px", border: "1px solid #f3e8ff", boxShadow: "0 10px 30px rgba(112, 68, 229, 0.05)" }}>
          {/* Header Card */}
          <div style={{ display: "flex", alignItems: "center", gap: "20px", borderBottom: "1px solid #f3f4f6", paddingBottom: "24px", marginBottom: "24px" }}>
            <div
              style={{
                width: "74px",
                height: "74px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #7044e5, #4f46e5)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "30px",
                fontWeight: "bold",
                boxShadow: "0 6px 16px rgba(112, 68, 229, 0.3)",
              }}
            >
              {studentName?.charAt(0).toUpperCase() || user?.username?.charAt(0).toUpperCase() || "S"}
            </div>

            <div>
              <h2 style={{ margin: 0, fontSize: "22px", color: "#1f2937" }}>{studentName || user?.name}</h2>
              <div style={{ color: "#6b7280", fontSize: "14px", marginTop: "4px" }}>
                Username: <strong>@{user?.username || user?.name}</strong> • Email: <strong>{user?.email}</strong>
              </div>
              <span style={{ display: "inline-block", marginTop: "8px", fontSize: "12px", fontWeight: 700, background: "#ede9fe", color: "#6d28d9", padding: "4px 12px", borderRadius: "8px" }}>
                Role: Student • MongoDB Account Active
              </span>
            </div>
          </div>

          {/* Form: Personal details */}
          <form onSubmit={handleSaveProfile} style={{ marginBottom: "36px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#1f2937", marginBottom: "16px" }}>
              👤 Personal Information
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>
                  Student Full Name
                </label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Enter full name"
                  required
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: "10px",
                    border: "1px solid #e5e7eb",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>
                  Academic Level / Course
                </label>
                <input
                  type="text"
                  value={gradeOrClass}
                  onChange={(e) => setGradeOrClass(e.target.value)}
                  placeholder="e.g. B.Tech Computer Science / Grade 12"
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    borderRadius: "10px",
                    border: "1px solid #e5e7eb",
                    fontSize: "14px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "10px 20px",
                background: "#7044e5",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                fontSize: "13px",
                fontWeight: "700",
                cursor: "pointer",
              }}
            >
              {saving ? "Saving Changes..." : "Save Details"}
            </button>
          </form>

          {/* Section: Active Classroom & Change Classroom */}
          <div style={{ background: "#fbfaff", borderRadius: "18px", padding: "24px", border: "1.5px solid #ede9fe", marginBottom: "30px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "14px" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "1px", color: "#7044e5" }}>
                  CURRENT ENROLLED CLASSROOM
                </span>
                <h3 style={{ fontSize: "20px", fontWeight: "800", color: "#1e1b4b", margin: "4px 0 0 0" }}>
                  {teacherInfo ? `${teacherInfo.name}'s Classroom` : "Not Enrolled in a Classroom"}
                </h3>
              </div>

              {activeTeacherProfile?.teacherCode && (
                <div style={{ background: "#ede9fe", padding: "6px 14px", borderRadius: "10px", color: "#6d28d9", fontWeight: "800", fontSize: "14px" }}>
                  Code: {activeTeacherProfile.teacherCode}
                </div>
              )}
            </div>

            {teacherInfo ? (
              <div style={{ fontSize: "14px", color: "#475569", lineHeight: "1.6", marginBottom: "20px" }}>
                <div>Instructor: <strong>{teacherInfo.name}</strong> ({teacherInfo.email})</div>
                {activeTeacherProfile?.universityOrCollege && (
                  <div>Institution: <strong>{activeTeacherProfile.universityOrCollege}</strong></div>
                )}
                {activeTeacherProfile?.department && (
                  <div>Department: <strong>{activeTeacherProfile.department}</strong></div>
                )}
              </div>
            ) : (
              <p style={{ fontSize: "14px", color: "#64748b", marginBottom: "20px" }}>
                You are currently not linked to any faculty classroom. Enter a teacher code below to connect.
              </p>
            )}

            {/* Change Classroom Form */}
            <form onSubmit={handleChangeClassroom} style={{ borderTop: "1px solid #f3efff", paddingTop: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <label style={{ fontSize: "14px", fontWeight: "700", color: "#1e1b4b" }}>
                  🔄 Change Classroom / Switch Teacher
                </label>
                {availableTeachers.length > 0 && (
                  <span style={{ fontSize: "11px", color: "#6d28d9" }}>
                    Available: {availableTeachers.map((t) => `${t.name} (${t.teacherCode})`).join(" • ")}
                  </span>
                )}
              </div>

              <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 12px 0" }}>
                Enter another teacher's classroom code to transfer. <strong>All your previous quiz attempts, notes, uploaded documents, and learning history will be safely preserved.</strong>
              </p>

              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder="Enter new Classroom Code (e.g. EDV-XXXX)"
                  value={newTeacherCode}
                  onChange={(e) => setNewTeacherCode(e.target.value.toUpperCase())}
                  required
                  style={{
                    flex: 1,
                    minWidth: "220px",
                    padding: "11px 14px",
                    borderRadius: "10px",
                    border: "1.5px solid #d8b4fe",
                    fontSize: "14px",
                    fontWeight: "600",
                    outline: "none",
                  }}
                />
                <button
                  type="submit"
                  disabled={changingClassroom}
                  style={{
                    padding: "11px 22px",
                    background: "linear-gradient(135deg, #7044e5, #4f46e5)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "10px",
                    fontSize: "14px",
                    fontWeight: "700",
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(112, 68, 229, 0.25)",
                  }}
                >
                  {changingClassroom ? "Validating with MongoDB..." : "Join New Classroom"}
                </button>
              </div>
            </form>
          </div>

          {/* Section: Historical Classroom Records */}
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#1f2937", marginBottom: "12px" }}>
              📜 Classroom History & Preserved Work
            </h3>
            <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "16px" }}>
              Your activities, quiz scores, and study materials associated with each classroom remain permanently attached to your profile.
            </p>

            {classroomHistory && classroomHistory.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {classroomHistory.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 18px",
                      borderRadius: "12px",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      fontSize: "13px",
                    }}
                  >
                    <div>
                      <strong style={{ color: "#1e293b" }}>{item.teacherName || "Faculty Instructor"}</strong>
                      <span style={{ color: "#64748b", marginLeft: "8px" }}>Code: {item.teacherCode}</span>
                    </div>
                    <div style={{ color: "#64748b" }}>
                      Joined: {new Date(item.joinedAt).toLocaleDateString()}
                      {item.leftAt ? ` • Departed: ${new Date(item.leftAt).toLocaleDateString()}` : " (Active)"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: "13px", color: "#94a3b8", fontStyle: "italic" }}>
                No prior classroom transfers on record.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default StudentProfile;
