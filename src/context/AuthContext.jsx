import { useEffect, useState } from "react";
import { AuthContext } from "./authContextDef";
import { authApi } from "../services/api";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load initial user session
  useEffect(() => {
    let isMounted = true;
    const checkSession = async () => {
      const token = localStorage.getItem("lerniq_token");
      if (!token) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const res = await authApi.getMe();
        if (isMounted) {
          if (res.success && res.user) {
            setUser(res.user);
          } else {
            localStorage.removeItem("lerniq_token");
            setUser(null);
          }
        }
      } catch {
        if (isMounted) {
          localStorage.removeItem("lerniq_token");
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

  const loginStudent = async (email, password) => {
    const res = await authApi.loginStudent({ email, password });
    if (res.token) {
      localStorage.setItem("lerniq_token", res.token);
    }
    setUser(res.user);
    return res;
  };

  const loginTeacher = async (email, password) => {
    const res = await authApi.loginTeacher({ email, password });
    if (res.token) {
      localStorage.setItem("lerniq_token", res.token);
    }
    setUser(res.user);
    return res;
  };

  const registerStudent = async (formData) => {
    return await authApi.registerStudent(formData);
  };

  const verifyOtp = async (email, otp) => {
    const res = await authApi.verifyOtp({ email, otp });
    if (res.token) {
      localStorage.setItem("lerniq_token", res.token);
    }
    setUser(res.user);
    return res;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout API failures
    } finally {
      localStorage.removeItem("lerniq_token");
      setUser(null);
    }
  };

  const refreshUser = async () => {
    try {
      const res = await authApi.getMe();
      if (res.success && res.user) {
        setUser(res.user);
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
        verifyOtp,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;
