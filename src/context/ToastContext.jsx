import { createContext, useContext, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./Toast.css";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = "success", duration = 3500) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Avoid duplicate identical toasts within 1 second
    setToasts((prev) => {
      const isDuplicate = prev.some(
        (t) => t.message === message && Date.now() - t.createdAt < 1200
      );
      if (isDuplicate) return prev;
      return [...prev, { id, message, type, createdAt: Date.now() }];
    });

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <div className="lerniq-toast-container" aria-live="polite">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              className={`lerniq-toast lerniq-toast-${toast.type}`}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              onClick={() => removeToast(toast.id)}
            >
              <span className="lerniq-toast-icon">
                {toast.type === "success" && "✓"}
                {toast.type === "error" && "⚠️"}
                {toast.type === "info" && "ℹ️"}
                {toast.type === "warning" && "⚡"}
              </span>
              <span className="lerniq-toast-msg">{toast.message}</span>
              <button
                className="lerniq-toast-close"
                onClick={(e) => {
                  e.stopPropagation();
                  removeToast(toast.id);
                }}
                aria-label="Close"
              >
                ×
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export { ToastContext };
