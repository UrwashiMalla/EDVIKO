const nodemailer = require("nodemailer");

/**
 * LERNIQ Email Service
 * Handles transactional email delivery for student account verification using Nodemailer.
 * Sender: adityapande78@gmail.com
 */

const getTransporter = () => {
  const user = process.env.EMAIL_USER || "adityapande78@gmail.com";
  const pass = process.env.EMAIL_PASS;

  if (!pass || !pass.trim()) {
    return null;
  }

  // Gmail SMTP transporter configuration
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || "gmail",
    auth: {
      user: user.trim(),
      pass: pass.trim().replace(/\s+/g, ""),
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

/**
 * Generate responsive HTML template for Student Registration OTP
 */
const buildStudentOtpTemplate = ({ name, email, otp }) => {
  const recipientName = name ? name.trim() : "Student";
  const senderEmail = process.env.EMAIL_USER || "adityapande78@gmail.com";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your LERNIQ Account</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);" cellspacing="0" cellpadding="0">
          
          <!-- HEADER -->
          <tr>
            <td style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 32px 30px; text-align: center;">
              <div style="display: inline-block; background: rgba(255,255,255,0.2); border-radius: 12px; padding: 10px 14px; margin-bottom: 12px;">
                <span style="font-size: 28px;">🎓</span>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">LERNIQ</h1>
              <p style="margin: 6px 0 0 0; color: #e0e7ff; font-size: 14px; font-weight: 500;">AI-Powered Educational Platform</p>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="margin: 0 0 12px 0; color: #0f172a; font-size: 20px; font-weight: 700;">
                Verify Your Student Account 🚀
              </h2>
              
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                Hello <strong>${recipientName}</strong>,
              </p>

              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                Thank you for joining <strong>LERNIQ</strong>! To activate your student profile and access your AI study material, smart summaries, quiz generation, and AI Tutor, please use the following 6-digit verification code:
              </p>

              <!-- OTP BOX -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background: #f1f5f9; border: 2px dashed #6366f1; border-radius: 12px; padding: 18px 36px; text-align: center;">
                      <span style="font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #6366f1; display: block; margin-bottom: 6px;">
                        YOUR 6-DIGIT OTP CODE
                      </span>
                      <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #1e1b4b; font-family: 'Courier New', Courier, monospace;">
                        ${otp}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; color: #64748b; text-align: center;">
                ⏳ This verification code expires in <strong>10 minutes</strong>.
              </p>

              <div style="background-color: #f8fafc; border-left: 4px solid #6366f1; border-radius: 4px; padding: 12px 16px; margin: 24px 0 0 0;">
                <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #475569;">
                  🛡️ <strong>Security Tip:</strong> Never share this verification code with anyone. LERNIQ staff will never ask for your code.
                </p>
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 13px; color: #64748b;">
                Sent from: <strong>${senderEmail}</strong>
              </p>
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #94a3b8;">
                If you did not attempt to register on LERNIQ using this email (<span style="color: #64748b;">${email}</span>), please disregard this message.
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                © 2026 LERNIQ Platform. All rights reserved.
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
 * Send Student Registration OTP Email
 * @param {Object} params
 * @param {string} params.email - Recipient student email
 * @param {string} [params.name] - Recipient name
 * @param {string} params.otp - 6-digit verification code
 * @returns {Promise<{ success: boolean, messageId?: string, simulated?: boolean, error?: string }>}
 */
const sendStudentOtpEmail = async ({ email, name = "Student", otp }) => {
  const normalizedEmail = email.toLowerCase().trim();
  const senderUser = process.env.EMAIL_USER || "adityapande78@gmail.com";
  const fromHeader = `LERNIQ <${senderUser}>`;
  const subject = `🎓 Verify your LERNIQ Student Account - OTP: ${otp}`;
  const htmlContent = buildStudentOtpTemplate({ name, email: normalizedEmail, otp });
  const textContent = `Hello ${name},\n\nYour LERNIQ student account verification OTP code is: ${otp}\n\nThis code expires in 10 minutes.\nSent from: ${senderUser}\n\nIf you did not request this, please ignore this email.`;

  const transporter = getTransporter();

  if (!transporter) {
    console.log(`\n============================================================`);
    console.log(`📧 [NODEMAILER - SIMULATION / DEV MODE]`);
    console.log(`From:    ${fromHeader}`);
    console.log(`To:      ${normalizedEmail}`);
    console.log(`Subject: ${subject}`);
    console.log(`OTP:     ${otp}`);
    console.log(`Note:    To dispatch real emails to inboxes, set EMAIL_PASS (Gmail 16-character App Password) in server/.env`);
    console.log(`============================================================\n`);

    return {
      success: true,
      simulated: true,
      messageId: `simulated-${Date.now()}`,
    };
  }

  try {
    const info = await transporter.sendMail({
      from: fromHeader,
      to: normalizedEmail,
      subject,
      text: textContent,
      html: htmlContent,
    });

    console.log(`[NODEMAILER] ✅ Verification email successfully sent from ${senderUser} to ${normalizedEmail} (MessageID: ${info.messageId})`);
    return {
      success: true,
      simulated: false,
      messageId: info.messageId,
    };
  } catch (err) {
    console.error(`[NODEMAILER] ❌ Failed to send email to ${normalizedEmail}:`, err.message);
    // Don't crash signup if SMTP fails; log clear diagnostics
    return {
      success: false,
      error: err.message,
    };
  }
};

module.exports = {
  sendStudentOtpEmail,
  buildStudentOtpTemplate,
  getTransporter,
};
