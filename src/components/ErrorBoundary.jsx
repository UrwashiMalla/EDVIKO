import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            background: "linear-gradient(135deg, #fbfaff 0%, #f3e8ff 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: "520px",
              width: "100%",
              background: "#ffffff",
              borderRadius: "24px",
              padding: "36px 32px",
              boxShadow: "0 20px 45px rgba(109, 40, 217, 0.12)",
              border: "1px solid #ede9fe",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "#fef2f2",
                color: "#dc2626",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "30px",
                margin: "0 auto 16px auto",
              }}
            >
              ⚠️
            </div>

            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1e1b4b", margin: "0 0 8px 0" }}>
              Something went wrong loading this page
            </h2>

            <p style={{ color: "#64748b", fontSize: "14px", lineHeight: 1.5, margin: "0 0 20px 0" }}>
              We ran into an unexpected issue while rendering this section. You can refresh the page or return to the main role selection screen.
            </p>

            {this.state.error && (
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "12px 14px",
                  color: "#991b1b",
                  fontSize: "12px",
                  fontFamily: "monospace",
                  textAlign: "left",
                  marginBottom: "24px",
                  maxHeight: "120px",
                  overflowY: "auto",
                  wordBreak: "break-word",
                }}
              >
                {this.state.error.toString()}
              </div>
            )}

            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                onClick={this.handleReload}
                style={{
                  padding: "12px 20px",
                  background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "12px",
                  fontWeight: "700",
                  fontSize: "14px",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(124, 58, 237, 0.25)",
                }}
              >
                🔄 Refresh Page
              </button>
              <button
                onClick={this.handleGoHome}
                style={{
                  padding: "12px 20px",
                  background: "#f1f5f9",
                  color: "#334155",
                  border: "none",
                  borderRadius: "12px",
                  fontWeight: "700",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                ← Go to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
