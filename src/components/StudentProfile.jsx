import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../context/useAuth";
import { studentApi } from "../services/api";
import { getInstitutionName } from "../services/frontendStorage";
import Navbar from "./Navbar";

function StudentProfile() {
  const { user, updateUser, refreshUser } = useAuth();

  const [studentName, setStudentName] = useState(user?.name || "");
  const [gradeOrClass, setGradeOrClass] = useState("");
  const [teacherCode, setTeacherCode] = useState("");
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [institutionName, setInstitutionName] = useState(getInstitutionName());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.name) {
      setStudentName(user.name);
    }
  }, [user]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await studentApi.getDashboard();
        if (res.profile) {
          setGradeOrClass(res.profile.gradeOrClass || "College / University");
          if (res.profile.teacherId) {
            setTeacherInfo(res.profile.teacherId);
          }
        }
      } catch (err) {
        console.warn("Failed to load profile details:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
    setInstitutionName(getInstitutionName());
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      // 1. Update student name in frontend auth state & local cache
      if (studentName.trim() && updateUser) {
        updateUser({ name: studentName.trim() });
      }

      // 2. Call backend profile update
      const res = await studentApi.updateProfile({
        gradeOrClass,
        teacherCode: teacherCode.trim() || undefined,
      });

      setMessage("Profile and name updated successfully!");
      if (res.profile?.teacherId) {
        setTeacherInfo(res.profile.teacherId);
      }
      setTeacherCode("");
      await refreshUser();
    } catch (err) {
      setError(err.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#faf9ff" }}>
        <Navbar activeTab="profile" />
        <div style={{ textAlign: "center", padding: "80px 0", color: "#7c3aed", fontWeight: "600" }}>
          ⏳ Loading your profile...
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#faf9ff" }}>
      <Navbar activeTab="profile" />

      <main style={{ maxWidth: "800px", margin: "40px auto", padding: "0 24px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#1f2937", marginBottom: "8px" }}>
          Student Profile
        </h1>
        <p style={{ color: "#6b7280", marginBottom: "30px", fontSize: "15px" }}>
          Manage your student name, personal learning profile, and assigned faculty mentor.
        </p>

        {message && (
          <div style={{ padding: "12px 18px", background: "#f0fdf4", color: "#166534", borderRadius: "12px", marginBottom: "20px" }}>
            ✅ {message}
          </div>
        )}

        {error && (
          <div style={{ padding: "12px 18px", background: "#fef2f2", color: "#991b1b", borderRadius: "12px", marginBottom: "20px" }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ background: "#fff", borderRadius: "20px", padding: "32px", border: "1px solid #f3e8ff", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
          {/* Header Card */}
          <div style={{ display: "flex", alignItems: "center", gap: "20px", borderBottom: "1px solid #f3f4f6", paddingBottom: "24px", marginBottom: "24px" }}>
            <div
              style={{
                width: "70px",
                height: "70px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "28px",
                fontWeight: "bold",
              }}
            >
              {studentName?.charAt(0).toUpperCase() || "S"}
            </div>

            <div>
              <h2 style={{ margin: 0, fontSize: "22px", color: "#1f2937" }}>{studentName || user?.name}</h2>
              <div style={{ color: "#6b7280", fontSize: "14px", marginTop: "4px" }}>{user?.email}</div>
              <span style={{ display: "inline-block", marginTop: "8px", fontSize: "12px", fontWeight: 600, background: "#ede9fe", color: "#6d28d9", padding: "3px 10px", borderRadius: "6px" }}>
                Role: Student {user?.isVerified ? "• Verified" : ""}
              </span>
            </div>
          </div>

          {/* Institutional Affiliation (Configured by Teacher - Read Only for Students) */}
          <div style={{ background: "#f8fafc", padding: "18px 20px", borderRadius: "14px", border: "1px solid #e2e8f0", marginBottom: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "1px", color: "#64748b" }}>
                  AFFILIATED INSTITUTION
                </span>
                <div style={{ fontSize: "18px", fontWeight: "800", color: "#1e293b", marginTop: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>🏛️</span>
                  <span>{institutionName}</span>
                </div>
              </div>
              <span style={{ fontSize: "12px", background: "#f1f5f9", color: "#475569", padding: "4px 10px", borderRadius: "6px", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                🔒 Set by Faculty Mentor (Read-Only)
              </span>
            </div>
            <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "#64748b" }}>
              Your university/college affiliation is configured by your faculty supervisor and cannot be altered by students.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSave}>
            {/* Student Name Block */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
                Student Full Name
              </label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Enter your student full name"
                required
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: "10px",
                  border: "1px solid #e5e7eb",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
              <small style={{ color: "#6b7280", fontSize: "12px", display: "block", marginTop: "4px" }}>
                You can change your displayed student name at any time.
              </small>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
                Academic Level / Course
              </label>
              <input
                type="text"
                value={gradeOrClass}
                onChange={(e) => setGradeOrClass(e.target.value)}
                placeholder="e.g. B.Tech Computer Science / Grade 12"
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: "10px",
                  border: "1px solid #e5e7eb",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Mentor Section */}
            <div style={{ background: "#fbfaff", padding: "20px", borderRadius: "14px", border: "1px solid #ede9fe", marginBottom: "24px" }}>
              <h3 style={{ margin: "0 0 8px 0", fontSize: "16px", color: "#4c1d95" }}>Assigned Faculty Mentor</h3>
              {teacherInfo ? (
                <div style={{ fontSize: "14px", color: "#4b5563" }}>
                  Currently assigned to: <strong>{teacherInfo.name}</strong> ({teacherInfo.email})
                </div>
              ) : (
                <div style={{ fontSize: "14px", color: "#6b7280" }}>
                  No faculty mentor linked yet. Enter a teacher code below to connect.
                </div>
              )}

              <div style={{ marginTop: "14px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#4b5563", marginBottom: "4px" }}>
                  Join or Change Teacher Code (e.g. TEACH-101)
                </label>
                <input
                  type="text"
                  value={teacherCode}
                  onChange={(e) => setTeacherCode(e.target.value)}
                  placeholder="Enter teacher code"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #d8b4fe",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={saving}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                width: "100%",
                padding: "12px",
                background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                color: "#fff",
                border: "none",
                borderRadius: "12px",
                fontSize: "15px",
                fontWeight: "600",
                cursor: "pointer",
                boxShadow: "0 4px 15px rgba(124, 58, 237, 0.3)",
              }}
            >
              {saving ? "Saving..." : "Save Changes"}
            </motion.button>
          </form>
        </div>
      </main>
    </div>
  );
}

export default StudentProfile;
