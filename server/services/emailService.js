const nodemailer = require("nodemailer");

/**
 * EDVIKO Email Service
 * Handles transactional email delivery for student/teacher verification and password resets.
 */

const getTransporter = () => {
  const user = process.env.EMAIL_USER || "pandeaditya786@gmail.com";
  const pass = process.env.EMAIL_PASS || "kjyevgkmxzhjdmha";

  if (!user || !user.trim() || !pass || !pass.trim()) {
    return null;
  }

  const cleanUser = user.trim();
  const cleanPass = pass.trim().replace(/\s+/g, "");

  // If custom SMTP host is specified (e.g. smtp.gmail.com, smtp.sendgrid.net, smtp-relay.brevo.com)
  if (process.env.EMAIL_HOST) {
    const port = parseInt(process.env.EMAIL_PORT, 10) || 465;
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST.trim(),
      port,
      secure: port === 465,
      auth: {
        user: cleanUser,
        pass: cleanPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  // Default to Gmail SMTP
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || "gmail",
    auth: {
      user: cleanUser,
      pass: cleanPass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
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
                    <div style="display: inline-block; background: #faf5ff; border: 2px dashed #7044e5; border-radius: 14px; padding: 18px 36px; text-align: center;">
                      <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #7044e5; display: block; margin-bottom: 6px;">
                        YOUR 6-DIGIT CODE
                      </span>
                      <span style="font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #1e1b4b; font-family: 'Courier New', Courier, monospace;">
                        ${otp}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; color: #64748b; text-align: center;">
                ⏳ ${expiresText || "This verification code expires in 15 minutes."}
              </p>

              <div style="background-color: #fbfaff; border-left: 4px solid #7044e5; border-radius: 6px; padding: 12px 16px; margin: 24px 0 0 0;">
                <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #475569;">
                  🛡️ <strong>Security Tip:</strong> ${tipText || "Never share this verification code with anyone. EDVIKO staff will never ask for your code."}
                </p>
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color: #fbfaff; padding: 24px 32px; border-top: 1px solid #f3e8ff; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 13px; color: #64748b;">
                Sent securely by <strong>EDVIKO Platform</strong> (${senderEmail})
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                © 2026 EDVIKO Educational Platform. All rights reserved.
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
 * Dispatch an email with fallback simulation
 */
const sendEmail = async ({ to, subject, html, text, otpDesc }) => {
  const normalizedEmail = to.toLowerCase().trim();
  const senderUser = process.env.EMAIL_USER || "pandeaditya786@gmail.com";
  const fromHeader = `EDVIKO Platform <${senderUser.trim()}>`;

  const transporter = getTransporter();

  if (!transporter) {
    console.log(`\n============================================================`);
    console.log(`📧 [EMAIL SERVICE - SIMULATION / DEV MODE]`);
    console.log(`To:      ${normalizedEmail}`);
    console.log(`Subject: ${subject}`);
    console.log(`Details: ${otpDesc}`);
    console.log(`Note:    EMAIL_USER or EMAIL_PASS not set in server/.env`);
    console.log(`============================================================\n`);
    return { success: true, simulated: true };
  }

  try {
    const info = await transporter.sendMail({
      from: fromHeader,
      to: normalizedEmail,
      subject,
      text,
      html,
    });
    console.log(`[EMAIL SERVICE] ✅ Email delivered to ${normalizedEmail} (ID: ${info.messageId})`);
    return { success: true, simulated: false, messageId: info.messageId };
  } catch (err) {
    console.error(`[EMAIL SERVICE] ❌ Failed to dispatch email to ${normalizedEmail}:`, err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Send Student Registration Verification OTP
 */
const sendStudentOtpEmail = async ({ email, name = "Learner", otp }) => {
  const subject = `🎓 Verify your EDVIKO Student Account - OTP: ${otp}`;
  const html = buildEmailTemplate({
    title: "Verify Your Student Email 🚀",
    badge: "STUDENT REGISTRATION",
    greeting: `Hello <strong>${name}</strong>,`,
    message: "Thank you for joining <strong>EDVIKO</strong>! To verify your email and complete your student profile, please enter the following 6-digit verification code:",
    otp,
  });
  const text = `Hello ${name},\n\nYour EDVIKO student registration OTP is: ${otp}\nExpires in 15 minutes.\n\nEDVIKO Team`;
  return await sendEmail({ to: email, subject, html, text, otpDesc: `Student Registration OTP: ${otp}` });
};

/**
 * Send Teacher Registration Verification OTP
 */
const sendTeacherOtpEmail = async ({ email, name = "Professor", otp }) => {
  const subject = `👨‍🏫 Verify your EDVIKO Faculty Account - OTP: ${otp}`;
  const html = buildEmailTemplate({
    title: "Verify Your Educator Email 📚",
    badge: "FACULTY REGISTRATION",
    greeting: `Hello <strong>${name}</strong>,`,
    message: "Welcome to <strong>EDVIKO Faculty Portal</strong>! To verify your educator credentials and create your classroom, please use the following 6-digit verification code:",
    otp,
  });
  const text = `Hello ${name},\n\nYour EDVIKO faculty registration OTP is: ${otp}\nExpires in 15 minutes.\n\nEDVIKO Team`;
  return await sendEmail({ to: email, subject, html, text, otpDesc: `Teacher Registration OTP: ${otp}` });
};

/**
 * Send Password Reset OTP
 */
const sendPasswordResetOtpEmail = async ({ email, name = "User", otp }) => {
  const subject = `🔒 EDVIKO Password Reset Request - OTP: ${otp}`;
  const html = buildEmailTemplate({
    title: "Reset Your Account Password 🔑",
    badge: "SECURITY ALERT",
    greeting: `Hello <strong>${name}</strong>,`,
    message: "We received a request to reset your password on <strong>EDVIKO</strong>. Enter the following verification code to proceed with creating your new password:",
    otp,
    expiresText: "This reset code expires in 15 minutes and can only be used once.",
    tipText: "If you did not request a password reset, please ignore this email. Your current password remains secure.",
  });
  const text = `Hello ${name},\n\nYour EDVIKO password reset OTP is: ${otp}\nExpires in 15 minutes.\n\nIf you did not request this, please ignore.\n\nEDVIKO Team`;
  return await sendEmail({ to: email, subject, html, text, otpDesc: `Password Reset OTP: ${otp}` });
};

module.exports = {
  sendStudentOtpEmail,
  sendTeacherOtpEmail,
  sendPasswordResetOtpEmail,
  getTransporter,
};
