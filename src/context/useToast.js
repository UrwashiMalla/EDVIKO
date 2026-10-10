import { useContext } from "react";
import { ToastContext } from "./ToastContext";

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Graceful fallback if used outside provider
    return {
      showToast: (msg) => console.log("[Toast fallback]:", msg),
      removeToast: () => {},
    };
  }
  return context;
}
