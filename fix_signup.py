import re

with open('/Users/mac/Desktop/new project nlp/LERNIQ/src/components/StudentSignup.jsx', 'r') as f:
    content = f.read()

# Change "Full Name" to "Username"
content = content.replace('Full Name', 'Username')
content = content.replace('What should we call you?', 'Choose a unique username')

# Update backend call to pass username as email (without @lerniq.edu for now, backend will handle it)
# Wait, frontend is calling:
# name: name.trim(),
# password,
# We can pass `email: name.trim()` to the backend!

old_call = """      const res = await authApi.registerStudent({
        name: name.trim(),
        password,
        teacherCode: teacherCode.trim(),
      });

      alert(`Success! Your Student Login ID is: ${res.studentId}\\nPlease save this ID, you will need it to login.`);"""

new_call = """      const res = await authApi.registerStudent({
        name: name.trim(),
        email: name.trim(), // We send the username as email
        password,
        teacherCode: teacherCode.trim(),
      });

      alert(`Success! Your Username is: ${res.studentId}\\nPlease use this username to log in.`);"""

content = content.replace(old_call, new_call)

with open('/Users/mac/Desktop/new project nlp/LERNIQ/src/components/StudentSignup.jsx', 'w') as f:
    f.write(content)
