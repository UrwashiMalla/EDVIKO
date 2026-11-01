async function test() {
  try {
    console.log("Fetching /api/auth/teachers...");
    const resTeachers = await fetch("http://127.0.0.1:5000/api/auth/teachers");
    const teachersData = await resTeachers.json();
    console.log("Teachers response:", JSON.stringify(teachersData));

    console.log("\nLogging in default Teacher...");
    const resTeacherLogin = await fetch("http://127.0.0.1:5000/api/auth/teacher/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "teacher@lerniq.edu",
        password: "Teacher@123",
      }),
    });
    const teacherLoginData = await resTeacherLogin.json();
    console.log("Teacher login response:", JSON.stringify(teacherLoginData));

    console.log("\nRegistering student without OTP...");
    const uniqueUser = "testuser_" + Date.now().toString().slice(-4);
    const resRegister = await fetch("http://127.0.0.1:5000/api/auth/student/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: uniqueUser,
        password: "Password@123",
        teacherCode: "TEACH-101",
      }),
    });
    const registerData = await resRegister.json();
    console.log("Register response:", JSON.stringify(registerData));

    console.log("\nLogging in registered student...");
    const resStudentLogin = await fetch("http://127.0.0.1:5000/api/auth/student/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: uniqueUser,
        password: "Password@123",
      }),
    });
    const studentLoginData = await resStudentLogin.json();
    console.log("Student login response:", JSON.stringify(studentLoginData));

    console.log("\nLogging in student 'u' (seeded)...");
    const resU = await fetch("http://127.0.0.1:5000/api/auth/student/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "u",
        password: "Teacher@123",
      }),
    });
    const uData = await resU.json();
    console.log("Student 'u' login response (Teacher@123):", JSON.stringify(uData));

  } catch (err) {
    console.error("Test error:", err);
  }
}

test();
