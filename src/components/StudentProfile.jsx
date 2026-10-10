import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../context/useAuth";
import { studentApi } from "../services/api";
import Navbar from "./Navbar";

function StudentProfile() {
  const { user, refreshUser } = useAuth();

  const [gradeOrClass, setGradeOrClass] = useState("");
  const [bio, setBio] = useState("");
  const [teacherCode, setTeacherCode] = useState("");
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await studentApi.getDashboard();
        if (res.profile) {
          setGradeOrClass(res.profile.gradeOrClass || "College / University");
          setBio(res.profile.bio || "");
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
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await studentApi.updateProfile({
        gradeOrClass,
        bio,
        teacherCode: teacherCode.trim() || undefined,
      });

      setMessage("Profile updated successfully!");
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
          Manage your personal learning profile and assigned faculty mentor.
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
              {user?.name?.charAt(0).toUpperCase() || "S"}
            </div>

            <div>
              <h2 style={{ margin: 0, fontSize: "22px", color: "#1f2937" }}>{user?.name}</h2>
              <div style={{ color: "#6b7280", fontSize: "14px", marginTop: "4px" }}>{user?.email}</div>
              <span style={{ display: "inline-block", marginTop: "8px", fontSize: "12px", fontWeight: 600, background: "#ede9fe", color: "#6d28d9", padding: "3px 10px", borderRadius: "6px" }}>
                Role: Student {user?.isVerified ? "• Verified" : ""}
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSave}>
            <div style={{ marginBottom: "20px" }}>
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

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "14px", fontWeight: 600, color: "#374151", marginBottom: "6px" }}>
                Learning Bio / Goals
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows="3"
                placeholder="Tell us what you are currently studying or preparing for..."
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
                    textTransform: "uppercase",
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
                padding: "12px 28px",
                background: "#7c3aed",
                color: "#fff",
                border: "none",
                borderRadius: "12px",
                fontWeight: "600",
                fontSize: "15px",
                cursor: "pointer",
              }}
            >
              {saving ? "Saving Changes..." : "Save Profile"}
            </motion.button>
          </form>
        </div>
      </main>
    </div>
  );
}

export default StudentProfile;
