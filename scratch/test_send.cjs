const nodemailer = require("nodemailer");

async function testSend() {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "pandeaditya786@gmail.com",
      pass: "kjyevgkmxzhjdmha",
    },
  });

  try {
    const info = await transporter.sendMail({
      from: '"EDVIKO Platform" <pandeaditya786@gmail.com>',
      to: "pandeaditya786@gmail.com",
      subject: "EDVIKO Test Verification Code",
      text: "Your verification code is: 123456",
      html: "<h3>Your verification code is: <strong>123456</strong></h3>",
    });
    console.log("Email sent successfully! Message ID:", info.messageId);
  } catch (err) {
    console.error("Email send failed:", err);
  }
}

testSend();
