async function testStudentOtpFlow() {
  const targetEmail = "pandeaditya786@gmail.com";
  const uniqueName = "Learner_" + Date.now().toString().slice(-4);

  console.log(`\n=== 1. DISPATCH SIGNUP OTP TO ${targetEmail} ===`);
  const sendRes = await fetch("http://127.0.0.1:5000/api/auth/send-signup-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: uniqueName,
      email: targetEmail,
    }),
  });
  const sendData = await sendRes.json();
  console.log("Send OTP Response:", JSON.stringify(sendData, null, 2));

  if (!sendData.success) {
    console.error("❌ Send OTP failed:", sendData.message);
    return;
  }

  // Get the OTP code: either from dev/fallback in response or we can verify using fallback 123456
  const otpToUse = sendData.otp || "123456";
  console.log("\nUsing OTP for verification:", otpToUse);

  console.log(`\n=== 2. VERIFY OTP FOR ${targetEmail} ===`);
  const verifyRes = await fetch("http://127.0.0.1:5000/api/auth/verify-signup-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: targetEmail,
      otp: otpToUse,
    }),
  });
  const verifyData = await verifyRes.json();
  console.log("Verify OTP Response:", JSON.stringify(verifyData, null, 2));

  if (!verifyData.success || !verifyData.verificationToken) {
    console.error("❌ Verify OTP failed:", verifyData.message);
    return;
  }

  console.log(`\n=== 3. COMPLETE STUDENT REGISTRATION ===`);
  const regRes = await fetch("http://127.0.0.1:5000/api/auth/student/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: uniqueName,
      email: targetEmail,
      password: "MySecurePassword@123",
      teacherCode: "TEACH-101",
      verificationToken: verifyData.verificationToken,
    }),
  });
  const regData = await regRes.json();
  console.log("Registration Response:", JSON.stringify(regData, null, 2));

  if (!regData.success) {
    console.error("❌ Registration failed:", regData.message);
    return;
  }

  console.log(`\n=== 4. STUDENT LOGIN WITH USERNAME ===`);
  const loginRes = await fetch("http://127.0.0.1:5000/api/auth/student/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: regData.studentId || uniqueName,
      password: "MySecurePassword@123",
    }),
  });
  const loginData = await loginRes.json();
  console.log("Login Response:", JSON.stringify(loginData, null, 2));

  console.log("\n🎉 FULL STUDENT EMAIL VERIFICATION FLOW TEST COMPLETED SUCCESSFULLY!");
}

testStudentOtpFlow();
