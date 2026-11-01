import { useEffect, useState } from "react";
import { AuthContext } from "./authContextDef";
import { authApi } from "../services/api";

const getStoredUser = () => {
  try {
    const raw = localStorage.getItem("lerniq_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);
  const [loading, setLoading] = useState(() => {
    const token = localStorage.getItem("lerniq_token");
    const cached = getStoredUser();
    return Boolean(token && !cached);
  });

  // Verify and sync session in background
  useEffect(() => {
    let isMounted = true;
    const checkSession = async () => {
      const token = localStorage.getItem("lerniq_token");
      if (!token) {
        if (isMounted) {
          setUser(null);
          localStorage.removeItem("lerniq_user");
          setLoading(false);
        }
        return;
      }

      try {
        const res = await authApi.getMe();
        if (isMounted) {
          if (res.success && res.user) {
            setUser(res.user);
            localStorage.setItem("lerniq_user", JSON.stringify(res.user));
          } else {
            localStorage.removeItem("lerniq_token");
            localStorage.removeItem("lerniq_user");
            setUser(null);
          }
        }
      } catch {
        if (isMounted && !getStoredUser()) {
          localStorage.removeItem("lerniq_token");
          localStorage.removeItem("lerniq_user");
          setUser(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    checkSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const loginStudent = async (username, password) => {
    const res = await authApi.loginStudent({ username, password });
    if (res.token) {
      localStorage.setItem("lerniq_token", res.token);
    }
    if (res.user) {
      localStorage.setItem("lerniq_user", JSON.stringify(res.user));
      setUser(res.user);
    }
    return res;
  };

  const loginTeacher = async (email, password) => {
    const res = await authApi.loginTeacher({ email, password });
    if (res.token) {
      localStorage.setItem("lerniq_token", res.token);
    }
    if (res.user) {
      localStorage.setItem("lerniq_user", JSON.stringify(res.user));
      setUser(res.user);
    }
    return res;
  };

  const registerStudent = async (formData) => {
    const res = await authApi.registerStudent(formData);
    if (res.token) {
      localStorage.setItem("lerniq_token", res.token);
    }
    if (res.user) {
      localStorage.setItem("lerniq_user", JSON.stringify(res.user));
      setUser(res.user);
    }
    return res;
  };

  const registerTeacher = async (formData) => {
    const res = await authApi.registerTeacher(formData);
    if (res.token) {
      localStorage.setItem("lerniq_token", res.token);
    }
    if (res.user) {
      localStorage.setItem("lerniq_user", JSON.stringify(res.user));
      setUser(res.user);
    }
    return res;
  };

  const verifyOtp = async (email, otp) => {
    return await authApi.verifyStudentOtp({ email, otp });
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout API failures
    } finally {
      localStorage.removeItem("lerniq_token");
      localStorage.removeItem("lerniq_user");
      setUser(null);
    }
  };

  const updateUser = (updates) => {
    setUser((prev) => {
      const merged = { ...prev, ...updates };
      localStorage.setItem("lerniq_user", JSON.stringify(merged));
      return merged;
    });
  };

  const refreshUser = async () => {
    try {
      const res = await authApi.getMe();
      if (res.success && res.user) {
        setUser(res.user);
        localStorage.setItem("lerniq_user", JSON.stringify(res.user));
      }
    } catch (err) {
      console.warn("User refresh error:", err.message);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        isAuthenticated: Boolean(user),
        loading,
        loginStudent,
        loginTeacher,
        registerStudent,
        registerTeacher,
        verifyOtp,
        logout,
        updateUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
