import re

with open('/Users/mac/Desktop/new project nlp/LERNIQ/src/components/StudentLogin.jsx', 'r') as f:
    content = f.read()

# Update UI labels
content = content.replace('<label>Email Address</label>', '<label>Student Login ID</label>')
content = content.replace('placeholder="Enter your student email"', 'placeholder="Enter your Student ID (e.g. student_123456)"')
content = content.replace('type="email"', 'type="text"')
content = content.replace('Please enter both email and password.', 'Please enter both Student ID and password.')
content = content.replace('<span>✉️</span>', '<span>🆔</span>')

# Update the submission logic to handle the ID
old_logic = """    try {
      await loginStudent(email.trim(), password);"""

new_logic = """    try {
      let finalId = email.trim();
      if (!finalId.includes('@')) {
        finalId = finalId + '@lerniq.edu';
      }
      await loginStudent(finalId, password);"""

content = content.replace(old_logic, new_logic)

with open('/Users/mac/Desktop/new project nlp/LERNIQ/src/components/StudentLogin.jsx', 'w') as f:
    f.write(content)
