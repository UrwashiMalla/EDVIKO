const nodemailer = require("nodemailer");

/**
 * EDVIKO Email Service
 * Handles transactional email delivery for student account verification using Gmail SMTP.
 * Configured via environment variables:
 * - EMAIL_USER (e.g. pandeaditya786@gmail.com)
 * - EMAIL_PASS (16-character Gmail App Password)
 */

const getTransporter = () => {
  const user = process.env.EMAIL_USER || "pandeaditya786@gmail.com";
  const pass = process.env.EMAIL_PASS;

  if (!pass || !pass.trim()) {
    return null;
  }

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
 * Generate a responsive, modern HTML email template for EDVIKO OTP Verification.
 * Designed with a premium minimalist aesthetic inspired by modern SaaS and fintech products.
 *
 * @param {Object} params
 * @param {string} params.name - Recipient student name
 * @param {string} params.email - Recipient student email
 * @param {string} params.otp - Dynamic 6-digit OTP code
 * @returns {string} Fully styled, email-safe HTML string
 */
const buildStudentOtpTemplate = ({ name, email, otp }) => {
  const recipientName = name && name.trim() ? name.trim() : "Learner";
  const senderEmail = process.env.EMAIL_USER || "pandeaditya786@gmail.com";
  const supportEmail = "support@edviko.com";

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>Verify your email address - EDVIKO</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        padding: 20px 12px !important;
      }
      .email-card {
        padding: 28px 20px !important;
        border-radius: 12px !important;
      }
      .otp-code {
        font-size: 30px !important;
        letter-spacing: 6px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; color: #0f172a;">
  <!-- PAGE WRAPPER TABLE -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; width: 100%; margin: 0; padding: 40px 16px;">
    <tr>
      <td align="center" style="padding: 0;">
        
        <!-- MAIN CONTAINER -->
        <table role="presentation" class="email-container" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; margin: 0 auto;">
          
          <!-- BRAND LOGO / HEADER -->
          <tr>
            <td style="padding: 0 0 24px 0; text-align: left;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="vertical-align: middle;">
                    <div style="width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); text-align: center; line-height: 36px;">
                      <span style="font-size: 18px; line-height: 36px; display: inline-block;">🎓</span>
                    </div>
                  </td>
                  <td style="vertical-align: middle; padding-left: 10px;">
                    <span style="font-size: 20px; font-weight: 800; letter-spacing: -0.5px; color: #0f172a; text-transform: uppercase; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                      EDVIKO
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- WHITE CARD -->
          <tr>
            <td class="email-card" style="background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 40px 36px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 10px 25px -5px rgba(0, 0, 0, 0.04);">
              
              <!-- HEADING -->
              <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #0f172a; letter-spacing: -0.5px; line-height: 1.3;">
                Verify your email address
              </h1>

              <!-- GREETING & EXPLANATION -->
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                Hello <strong>${recipientName}</strong>,
              </p>

              <p style="margin: 0 0 28px 0; font-size: 15px; line-height: 1.6; color: #475569;">
                Thank you for creating an account on <strong>EDVIKO</strong>. To complete your registration and activate your personal AI Tutor and study tools, please use the verification code below:
              </p>

              <!-- PROMINENT OTP CONTAINER -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td align="center">
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 22px 28px; text-align: center;">
                      <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin-bottom: 8px;">
                        One-Time Verification Code
                      </div>
                      <div class="otp-code" style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0f172a; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; line-height: 1.1;">
                        ${otp}
                      </div>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- EXPIRATION NOTICE -->
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.5; color: #64748b; text-align: center;">
                ⏳ This code will expire in <strong>10 minutes</strong>.
              </p>

              <!-- SECURITY NOTICE -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td style="background-color: #fdf4ff; border-left: 3px solid #7c3aed; border-radius: 4px; padding: 12px 16px;">
                    <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #581c87;">
                      <strong>Security Tip:</strong> Never share this code with anyone. EDVIKO staff will never ask for your verification code. If you didn't attempt to sign up, you can safely disregard this email.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CLOSING -->
              <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #475569;">
                Best regards,<br />
                <strong>The EDVIKO Team</strong>
              </p>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding: 28px 16px 0 16px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b; line-height: 1.5;">
                Need help? Contact our support team at <a href="mailto:${supportEmail}" style="color: #7c3aed; text-decoration: none; font-weight: 500;">${supportEmail}</a>
              </p>
              <p style="margin: 0 0 6px 0; font-size: 12px; color: #94a3b8;">
                Sent by EDVIKO Platform from ${senderEmail} to ${email}
              </p>
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                © 2026 EDVIKO. All rights reserved.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
};

/**
 * Generate plain-text fallback for email clients that do not render HTML.
 */
const buildStudentOtpPlainText = ({ name, email, otp }) => {
  const recipientName = name && name.trim() ? name.trim() : "Learner";
  const senderEmail = process.env.EMAIL_USER || "pandeaditya786@gmail.com";
  const supportEmail = "support@edviko.com";

  return `VERIFY YOUR EMAIL ADDRESS - EDVIKO

Hello ${recipientName},

Thank you for signing up for EDVIKO. To complete your account registration and activate your personal AI Tutor and study tools, please use the following one-time verification code:

-------------------------------------------
YOUR VERIFICATION CODE: ${otp}
-------------------------------------------

This verification code will expire in 10 minutes.

Security Notice:
Never share this verification code with anyone. EDVIKO staff will never ask for your code. If you did not create an account, you can safely ignore this email.

Need help? Contact support at ${supportEmail}

Sent by EDVIKO Platform (${senderEmail}) to ${email}
© 2026 EDVIKO. All rights reserved.`;
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
  const senderUser = process.env.EMAIL_USER || "pandeaditya786@gmail.com";
  const fromHeader = `EDVIKO <${senderUser}>`;
  const subject = `Verify your email address - EDVIKO (${otp})`;
  const htmlContent = buildStudentOtpTemplate({ name, email: normalizedEmail, otp });
  const textContent = buildStudentOtpPlainText({ name, email: normalizedEmail, otp });

  const transporter = getTransporter();

  if (!transporter) {
    console.log(`\n============================================================`);
    console.log(`📧 [NODEMAILER - SIMULATION / DEV MODE]`);
    console.log(`From:    ${fromHeader}`);
    console.log(`To:      ${normalizedEmail}`);
    console.log(`Subject: ${subject}`);
    console.log(`OTP:     ${otp}`);
    console.log(`Note:    EMAIL_PASS not configured in server/.env`);
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
    return {
      success: false,
      error: err.message,
    };
  }
};

module.exports = {
  sendStudentOtpEmail,
  buildStudentOtpTemplate,
  buildStudentOtpPlainText,
  getTransporter,
};
