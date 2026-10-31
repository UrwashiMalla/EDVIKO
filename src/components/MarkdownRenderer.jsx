import React, { useState, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import "./MarkdownRenderer.css";

// Helper to recursively extract plain text from React elements for clipboard copying
const extractPlainText = (node) => {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractPlainText).join("");
  if (React.isValidElement(node) && node.props && node.props.children) {
    return extractPlainText(node.props.children);
  }
  return "";
};

/**
 * Pre/Code block container with language tag and copy button
 */
function CodeBlockPre({ children, ...props }) {
  const [copied, setCopied] = useState(false);

  // The child of <pre> in react-markdown is typically <code>
  const codeElem = React.Children.only(children);
  const className = codeElem?.props?.className || "";
  const match = /language-(\w+)/.exec(className);
  const lang = match ? match[1] : "code";

  const handleCopy = () => {
    const rawCode = extractPlainText(codeElem).replace(/\n$/, "");
    if (!rawCode) return;
    navigator.clipboard.writeText(rawCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="edviko-code-card">
      <div className="edviko-code-header">
        <span className="edviko-code-lang">
          <span className="edviko-code-icon">⚡</span>
          {lang}
        </span>
        <button
          type="button"
          className="edviko-code-copy-btn"
          onClick={handleCopy}
          title="Copy code to clipboard"
        >
          {copied ? "✓ Copied!" : "📋 Copy code"}
        </button>
      </div>
      <pre className="edviko-code-pre" {...props}>
        {codeElem}
      </pre>
    </div>
  );
}

/**
 * Custom MarkdownRenderer for EDVIKO AI Tutor
 * Delivers ChatGPT-level readability, typography, and layout formatting.
 */
function MarkdownRenderer({ content, className = "" }) {
  if (!content) return null;

  return (
    <div className={`edviko-markdown-root ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Code block wrapper
          pre: CodeBlockPre,

          // Inline code vs block code
          code({ node, className, children, ...props }) {
            const isInline = !className && !String(children).includes("\n");
            if (isInline) {
              return (
                <code className="edviko-inline-code" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },

          // Responsive table wrapper
          table({ children, ...props }) {
            return (
              <div className="edviko-table-wrapper">
                <table className="edviko-markdown-table" {...props}>
                  {children}
                </table>
              </div>
            );
          },

          // Blockquotes
          blockquote({ children, ...props }) {
            return (
              <blockquote className="edviko-markdown-blockquote" {...props}>
                <div className="edviko-blockquote-bar" />
                <div className="edviko-blockquote-content">{children}</div>
              </blockquote>
            );
          },

          // Headings with clear visual hierarchy
          h1({ children, ...props }) {
            return (
              <h1 className="edviko-md-h1" {...props}>
                {children}
              </h1>
            );
          },
          h2({ children, ...props }) {
            return (
              <h2 className="edviko-md-h2" {...props}>
                {children}
              </h2>
            );
          },
          h3({ children, ...props }) {
            return (
              <h3 className="edviko-md-h3" {...props}>
                {children}
              </h3>
            );
          },
          h4({ children, ...props }) {
            return (
              <h4 className="edviko-md-h4" {...props}>
                {children}
              </h4>
            );
          },

          // Paragraphs
          p({ children, ...props }) {
            return (
              <p className="edviko-md-p" {...props}>
                {children}
              </p>
            );
          },

          // Lists
          ul({ children, ...props }) {
            return (
              <ul className="edviko-md-ul" {...props}>
                {children}
              </ul>
            );
          },
          ol({ children, ...props }) {
            return (
              <ol className="edviko-md-ol" {...props}>
                {children}
              </ol>
            );
          },
          li({ children, ...props }) {
            return (
              <li className="edviko-md-li" {...props}>
                {children}
              </li>
            );
          },

          // Horizontal rule
          hr(props) {
            return <hr className="edviko-md-hr" {...props} />;
          },

          // Bold text
          strong({ children, ...props }) {
            return (
              <strong className="edviko-md-strong" {...props}>
                {children}
              </strong>
            );
          },

          // Links
          a({ href, children, ...props }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="edviko-md-link"
                {...props}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default memo(MarkdownRenderer);
