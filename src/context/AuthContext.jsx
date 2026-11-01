import { useEffect, useState } from "react";
import { AuthContext } from "./authContextDef";
import { authApi } from "../services/api";

const getStoredUser = () => {
  try {
    const raw = localStorage.getItem("edviko_user") || localStorage.getItem("lerniq_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const getStoredToken = () => {
  return localStorage.getItem("edviko_token") || localStorage.getItem("lerniq_token");
};

const formatUserSession = (rawUser, extra = {}) => {
  if (!rawUser) return null;
  const profile = extra.profile || rawUser.profile || null;
  const teacherCode = profile?.teacherCode || extra.classroomCode || rawUser.teacherCode || null;
  return {
    ...rawUser,
    profile,
    teacherCode,
  };
};

const setSession = (token, user) => {
  if (token) {
    localStorage.setItem("edviko_token", token);
    localStorage.setItem("lerniq_token", token);
  }
  if (user) {
    localStorage.setItem("edviko_user", JSON.stringify(user));
    localStorage.setItem("lerniq_user", JSON.stringify(user));
  }
};

const clearSession = () => {
  localStorage.removeItem("edviko_token");
  localStorage.removeItem("lerniq_token");
  localStorage.removeItem("edviko_user");
  localStorage.removeItem("lerniq_user");
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);
  const [loading, setLoading] = useState(() => {
    const token = getStoredToken();
    const cached = getStoredUser();
    return Boolean(token && !cached);
  });

  // Verify and sync session in background
  useEffect(() => {
    let isMounted = true;
    const checkSession = async () => {
      const token = getStoredToken();
      if (!token) {
        if (isMounted) {
          setUser(null);
          clearSession();
          setLoading(false);
        }
        return;
      }

      try {
        const res = await authApi.getMe();
        if (isMounted) {
          if (res.success && res.user) {
            const formatted = formatUserSession(res.user, res);
            setUser(formatted);
            setSession(token, formatted);
          } else {
            clearSession();
            setUser(null);
          }
        }
      } catch {
        if (isMounted && !getStoredUser()) {
          clearSession();
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
    if (res.token && res.user) {
      setSession(res.token, res.user);
      setUser(res.user);
    }
    return res;
  };

  const loginTeacher = async (email, password) => {
    const res = await authApi.loginTeacher({ email, password });
    if (res.token && res.user) {
      const formatted = formatUserSession(res.user, res);
      setSession(res.token, formatted);
      setUser(formatted);
    }
    return res;
  };

  const registerStudent = async (formData) => {
    const res = await authApi.registerStudent(formData);
    if (res.token && res.user) {
      setSession(res.token, res.user);
      setUser(res.user);
    }
    return res;
  };

  const registerTeacher = async (formData) => {
    const res = await authApi.registerTeacher(formData);
    if (res.token && res.user) {
      setSession(res.token, res.user);
      setUser(res.user);
    }
    return res;
  };

  const verifyOtp = async (email, otp) => {
    const res = await authApi.verifyStudentOtp({ email, otp });
    if (res.token && res.user) {
      setSession(res.token, res.user);
      setUser(res.user);
    }
    return res;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout API failures
    } finally {
      clearSession();
      setUser(null);
    }
  };

  const updateUser = (updates) => {
    setUser((prev) => {
      const merged = { ...prev, ...updates };
      setSession(null, merged);
      return merged;
    });
  };

  const refreshUser = async () => {
    try {
      const res = await authApi.getMe();
      if (res.success && res.user) {
        const formatted = formatUserSession(res.user, res);
        setUser(formatted);
        setSession(null, formatted);
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
