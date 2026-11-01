const nodemailer = require("nodemailer");

async function testGmail() {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "pandeaditya786@gmail.com",
      pass: "kjyevgkmxzhjdmha",
    },
  });

  try {
    const verified = await transporter.verify();
    console.log("Transporter verified successfully!", verified);
  } catch (err) {
    console.error("Transporter verify failed:", err.message);
  }
}

testGmail();
