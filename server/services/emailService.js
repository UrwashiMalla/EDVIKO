const nodemailer = require("nodemailer");

/**
 * EDVIKO Email Service
 * Handles transactional email delivery for student/teacher verification and password resets.
 */

let cachedTransporter = null;
let lastCredsHash = "";

const getTransporter = () => {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !user.trim() || !pass || !pass.trim()) {
    return null;
  }

  const cleanUser = user.trim();
  const cleanPass = pass.trim().replace(/\s+/g, "");
  const host = (process.env.EMAIL_HOST || "smtp.gmail.com").trim();
  const port = parseInt(process.env.EMAIL_PORT, 10) || 465;
  const isSecure = port === 465;

  const currentCredsHash = `${cleanUser}:${cleanPass.length}:${host}:${port}`;

  if (cachedTransporter && lastCredsHash === currentCredsHash) {
    return cachedTransporter;
  }

  // Production-grade SMTP configuration with connection pooling & timeouts
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    connectionTimeout: 10000, // 10s connection timeout (prevents cloud process hangs)
    greetingTimeout: 10000,   // 10s greeting timeout
    socketTimeout: 15000,     // 15s socket timeout
    auth: {
      user: cleanUser,
      pass: cleanPass,
    },
    tls: {
      rejectUnauthorized: false, // Prevents self-signed or proxy TLS errors in containerized environments
    },
  });

  lastCredsHash = currentCredsHash;
  return cachedTransporter;
};

/**
 * Verify SMTP connection on startup or diagnostic check
 */
const verifySmtpConnection = async () => {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("[EMAIL SERVICE] ⚠️ EMAIL_USER or EMAIL_PASS not configured in server/.env");
    return { verified: false, reason: "Credentials not configured" };
  }

  try {
    const res = await transporter.verify();
    console.log("[EMAIL SERVICE] ✅ SMTP connection verified with mail server");
    return { verified: true };
  } catch (err) {
    console.error(`[EMAIL SERVICE] ❌ SMTP verification failed: ${err.message} (Code: ${err.code || "UNKNOWN"})`);
    return { verified: false, error: err.message, code: err.code };
  }
};

/**
 * Base template for EDVIKO emails
 */
const buildEmailTemplate = ({ title, badge, greeting, message, otp, tipText, expiresText }) => {
  const senderEmail = process.env.EMAIL_USER || "noreply@edviko.edu";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #faf9ff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e1b4b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #faf9ff; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 20px; border: 1px solid #f3e8ff; overflow: hidden; box-shadow: 0 10px 25px rgba(112, 68, 229, 0.08);" cellspacing="0" cellpadding="0">
          
          <!-- HEADER -->
          <tr>
            <td style="background: linear-gradient(135deg, #7044e5 0%, #4f46e5 100%); padding: 36px 30px; text-align: center;">
              <div style="display: inline-block; background: rgba(255,255,255,0.2); border-radius: 12px; padding: 10px 14px; margin-bottom: 12px;">
                <span style="font-size: 28px;">🎓</span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">EDVIKO</h1>
              <p style="margin: 6px 0 0 0; color: #e0e7ff; font-size: 14px; font-weight: 500;">AI-Powered Smart Learning Platform</p>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding: 36px 32px;">
              <div style="display: inline-block; background: #ede9fe; color: #6d28d9; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px;">
                ${badge || "VERIFICATION CODE"}
              </div>

              <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 22px; font-weight: 700;">
                ${title}
              </h2>
              
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                ${greeting}
              </p>

              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                ${message}
              </p>

              <!-- OTP BOX -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <div style="background: #faf8ff; border: 2px dashed #c4b5fd; border-radius: 16px; padding: 22px 32px; display: inline-block; letter-spacing: 10px; font-size: 34px; font-weight: 800; color: #5b21b6; font-family: 'Courier New', monospace;">
                      ${otp}
                    </div>
                  </td>
                </tr>
              </table>

              <div style="background: #f8fafc; border-radius: 12px; padding: 14px 18px; margin-bottom: 18px; border-left: 4px solid #7044e5;">
                <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.5;">
                  ⏱️ <strong>Expiration Notice:</strong> ${expiresText || "This verification code will expire in 5 minutes and can only be used once."}
                </p>
              </div>

              <div style="background: #fefce8; border-radius: 12px; padding: 12px 18px; margin-bottom: 24px; border: 1px solid #fef08a;">
                <p style="margin: 0; font-size: 12.5px; color: #854d0e; line-height: 1.45;">
                  💡 <strong>Tip:</strong> If you don't find this email in your primary inbox, please check your <strong>Spam, Junk, or Promotions</strong> folder.
                </p>
              </div>

              <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.5;">
                ${tipText || "If you did not request this verification code, please ignore this email or contact support."}
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #f1f5f9;">
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #94a3b8;">
                This is an automated security email from EDVIKO Educational Platform.
              </p>
              <p style="margin: 0; font-size: 11px; color: #cbd5e1;">
                Sent from: ${senderEmail}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

/**
 * Dispatch an email with full confirmation and audit logging
 */
const sendEmail = async ({ to, subject, html, text }) => {
  const normalizedEmail = to.toLowerCase().trim();
  const senderUser = (process.env.EMAIL_USER || "").trim();

  const transporter = getTransporter();

  if (!transporter) {
    const errorMsg = "SMTP transporter is not configured. Missing EMAIL_USER or EMAIL_PASS.";
    console.error(`[EMAIL SERVICE] ❌ Cannot send email to ${normalizedEmail}: ${errorMsg}`);
    return { success: false, error: errorMsg, simulated: false };
  }

  const mailOptions = {
    from: `"EDVIKO Verification" <${senderUser}>`,
    to: normalizedEmail,
    replyTo: senderUser,
    subject,
    text,
    html,
    priority: "high",
    headers: {
      "X-Priority": "1",
      "X-MSMail-Priority": "High",
      Importance: "high",
    },
  };

  try {
    const info = await transporter.sendMail(mailOptions);

    const isAccepted = Array.isArray(info.accepted) && info.accepted.length > 0;

    if (!isAccepted) {
      const rejectReason = (info.rejected && info.rejected.length > 0)
        ? `Recipient rejected by SMTP server: ${info.rejected.join(", ")}`
        : "Email was not accepted by SMTP server.";
      console.error(`[EMAIL SERVICE] ❌ SMTP rejected message to ${normalizedEmail}: ${rejectReason}`);
      return { success: false, error: rejectReason };
    }

    console.log(`[EMAIL SERVICE] ✅ Email accepted by SMTP server for ${normalizedEmail} (Message ID: ${info.messageId})`);
    console.log(`[EMAIL SERVICE] ℹ️ SMTP Response: ${info.response}`);

    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
      accepted: info.accepted,
    };
  } catch (err) {
    console.error(`[EMAIL SERVICE] ❌ SMTP send failed to ${normalizedEmail}: ${err.message} (Code: ${err.code || "N/A"})`);
    return {
      success: false,
      error: err.message,
      code: err.code,
    };
  }
};

/**
 * Send Student Registration Verification OTP
 */
const sendStudentOtpEmail = async ({ email, name = "Learner", otp }) => {
  const subject = `EDVIKO Verification Code: ${otp}`;
  const html = buildEmailTemplate({
    title: "Verify Your Student Email 🚀",
    badge: "STUDENT REGISTRATION",
    greeting: `Hello <strong>${name}</strong>,`,
    message: "Thank you for joining <strong>EDVIKO</strong>! To verify your student email and complete your enrollment, please enter the following 6-digit verification code:",
    otp,
    expiresText: "This verification code will expire in 5 minutes.",
  });
  const text = `Hello ${name},\n\nYour EDVIKO student registration code is: ${otp}\nThis code expires in 5 minutes.\n\nIf you did not request this, please ignore.\n\nEDVIKO Team`;
  return await sendEmail({ to: email, subject, html, text });
};

/**
 * Send Teacher Registration Verification OTP
 */
const sendTeacherOtpEmail = async ({ email, name = "Professor", otp }) => {
  const subject = `EDVIKO Faculty Verification Code: ${otp}`;
  const html = buildEmailTemplate({
    title: "Verify Your Educator Email 📚",
    badge: "FACULTY REGISTRATION",
    greeting: `Hello <strong>${name}</strong>,`,
    message: "Welcome to <strong>EDVIKO Faculty Portal</strong>! To verify your educator credentials and create your classroom, please use the following 6-digit verification code:",
    otp,
    expiresText: "This verification code will expire in 5 minutes.",
  });
  const text = `Hello ${name},\n\nYour EDVIKO faculty verification code is: ${otp}\nThis code expires in 5 minutes.\n\nIf you did not request this, please ignore.\n\nEDVIKO Team`;
  return await sendEmail({ to: email, subject, html, text });
};

/**
 * Send Password Reset OTP
 */
const sendPasswordResetOtpEmail = async ({ email, name = "User", otp }) => {
  const subject = `EDVIKO Password Reset Code: ${otp}`;
  const html = buildEmailTemplate({
    title: "Reset Your Account Password 🔑",
    badge: "SECURITY ALERT",
    greeting: `Hello <strong>${name}</strong>,`,
    message: "We received a request to reset your password on <strong>EDVIKO</strong>. Enter the following verification code to proceed with creating your new password:",
    otp,
    expiresText: "This reset code expires in 5 minutes and can only be used once.",
    tipText: "If you did not request a password reset, please ignore this email. Your current password remains secure.",
  });
  const text = `Hello ${name},\n\nYour EDVIKO password reset code is: ${otp}\nThis code expires in 5 minutes.\n\nIf you did not request this, please ignore.\n\nEDVIKO Team`;
  return await sendEmail({ to: email, subject, html, text });
};

module.exports = {
  sendStudentOtpEmail,
  sendTeacherOtpEmail,
  sendPasswordResetOtpEmail,
  verifySmtpConnection,
  getTransporter,
};
