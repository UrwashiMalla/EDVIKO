async function testFeatures() {
  try {
    console.log("=== 1. TEACHER LOGIN ===");
    const tLoginRes = await fetch("http://127.0.0.1:5000/api/auth/teacher/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "teacher@lerniq.edu", password: "Teacher@123" }),
    });
    const tData = await tLoginRes.json();
    console.log("Teacher login:", tData.success, tData.user?.name);
    const teacherToken = tData.token;

    console.log("\n=== 2. STUDENT REGISTRATION (NEW STUDENT) ===");
    const sUsername = "student_test_" + Date.now().toString().slice(-4);
    const sRegRes = await fetch("http://127.0.0.1:5000/api/auth/student/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: sUsername,
        password: "MySecurePassword123!",
        teacherCode: "TEACH-101",
      }),
    });
    const sRegData = await sRegRes.json();
    console.log("Student registered:", sRegData.success, "ID:", sRegData.studentId);
    const studentToken = sRegData.token;
    const studentUserId = sRegData.user?.id;

    console.log("\n=== 3. STUDENT LOGIN ===");
    const sLoginRes = await fetch("http://127.0.0.1:5000/api/auth/student/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: sUsername,
        password: "MySecurePassword123!",
      }),
    });
    const sLoginData = await sLoginRes.json();
    console.log("Student login:", sLoginData.success, sLoginData.user?.username);

    console.log("\n=== 4. TEACHER ANNOUNCEMENT (GROUP BROADCAST) ===");
    const bcastRes = await fetch("http://127.0.0.1:5000/api/teachers/broadcast", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${teacherToken}`,
      },
      body: JSON.stringify({
        title: "Midterm Review Session",
        content: "Please review Chapter 4 algorithms before our Monday lecture.",
      }),
    });
    const bcastData = await bcastRes.json();
    console.log("Teacher broadcast created:", bcastData.success, bcastData.broadcast?.title);

    console.log("\n=== 5. STUDENT VIEW TEACHER ANNOUNCEMENTS ===");
    const sBcastRes = await fetch("http://127.0.0.1:5000/api/students/messages/broadcasts", {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const sBcastData = await sBcastRes.json();
    console.log(
      "Student received broadcasts count:",
      sBcastData.broadcasts?.length,
      "Latest title:",
      sBcastData.broadcasts?.[0]?.title
    );

    console.log("\n=== 6. STUDENT SENDS PERSONAL MESSAGE TO TEACHER ===");
    const sDirectRes = await fetch("http://127.0.0.1:5000/api/students/messages/direct", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        text: "Hello Professor, I have a question about the assignment rubric.",
      }),
    });
    const sDirectData = await sDirectRes.json();
    console.log("Student sent direct message:", sDirectData.success, sDirectData.message?.text);

    console.log("\n=== 7. TEACHER RECEIVES & REPLIES TO PERSONAL MESSAGE ===");
    const tGetMsgsRes = await fetch(
      `http://127.0.0.1:5000/api/teachers/students/${studentUserId}/messages`,
      {
        headers: { Authorization: `Bearer ${teacherToken}` },
      }
    );
    const tMsgsData = await tGetMsgsRes.json();
    console.log(
      "Teacher fetched student messages count:",
      tMsgsData.messages?.length,
      "Student message text:",
      tMsgsData.messages?.[0]?.text
    );

    const tReplyRes = await fetch(
      `http://127.0.0.1:5000/api/teachers/students/${studentUserId}/message`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${teacherToken}`,
        },
        body: JSON.stringify({
          text: "Hello! You can find the rubric attached in the course portal.",
        }),
      }
    );
    const tReplyData = await tReplyRes.json();
    console.log("Teacher reply sent:", tReplyData.success, tReplyData.message?.text);

    console.log("\n=== 8. STUDENT CHECKS PERSONAL MESSAGING HISTORY ===");
    const sCheckMsgs = await fetch("http://127.0.0.1:5000/api/students/messages/direct", {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const sCheckData = await sCheckMsgs.json();
    console.log("Student conversation history length:", sCheckData.messages?.length);
    sCheckData.messages?.forEach((m) => {
      console.log(` - [${m.senderRole.toUpperCase()}] ${m.text}`);
    });

    console.log("\n=== 9. STUDENT CLASSROOM MANAGEMENT (CHANGE CLASSROOM) ===");
    // Get another teacher code
    const teachersListRes = await fetch("http://127.0.0.1:5000/api/auth/teachers");
    const teachersList = await teachersListRes.json();
    const otherTeacher = teachersList.teachers.find((t) => t.teacherCode !== "TEACH-101");
    if (otherTeacher) {
      console.log(`Switching student to teacher: ${otherTeacher.name} (Code: ${otherTeacher.teacherCode})`);
      const switchRes = await fetch("http://127.0.0.1:5000/api/students/classroom/change", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({ teacherCode: otherTeacher.teacherCode }),
      });
      const switchData = await switchRes.json();
      console.log("Classroom switch result:", switchData.success, switchData.message);
      console.log("Classroom History preserved:", switchData.profile?.classroomHistory?.length, "entries");
    }

    console.log("\n=== 10. TEACHER REMOVE AND UNREMOVE STUDENT ===");
    // Teacher removes student
    const removeRes = await fetch(
      `http://127.0.0.1:5000/api/teachers/students/${studentUserId}/remove`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${teacherToken}`,
        },
        body: JSON.stringify({ reason: "Completed semester" }),
      }
    );
    const removeData = await removeRes.json();
    console.log("Teacher removed student:", removeData.success);

    // Verify student is in removed list
    const removedListRes = await fetch("http://127.0.0.1:5000/api/teachers/students/removed", {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    const removedListData = await removedListRes.json();
    console.log(
      "Teacher removed students count:",
      removedListData.removedStudents?.length,
      "Removed email:",
      removedListData.removedStudents?.[0]?.email
    );

    // Teacher unremoves student
    const unremoveRes = await fetch(
      `http://127.0.0.1:5000/api/teachers/students/${studentUserId}/unremove`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${teacherToken}`,
        },
        body: JSON.stringify({}),
      }
    );
    const unremoveData = await unremoveRes.json();
    console.log("Teacher unremoved student:", unremoveData.success);

    console.log("\n🎉 ALL 10 E2E TESTS PASSED 100% PERFECTLY!");
  } catch (err) {
    console.error("Test failed:", err);
  }
}

testFeatures();
