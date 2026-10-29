import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";

export default function ProtectedRoute({ role, children }) {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          background: "#faf9ff",
          fontSize: "18px",
          fontWeight: 600,
          color: "#6b46c1",
        }}
      >
        <span>🎓 Loading EDVIKO...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    const redirectPath = role === "teacher" ? "/teacher/login" : "/student/login";
    return <Navigate to={redirectPath} state={{ from: location }} replace />;
  }

  if (role && user.role !== role) {
    const defaultDashboard = user.role === "teacher" ? "/teacher/dashboard" : "/student/dashboard";
    return <Navigate to={defaultDashboard} replace />;
  }

  return children;
}
