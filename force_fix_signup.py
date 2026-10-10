import re

with open('/Users/mac/Desktop/new project nlp/LERNIQ/src/components/StudentSignup.jsx', 'r') as f:
    content = f.read()

# We need to inject email: name.trim() into the authApi.registerStudent call
pattern = r'(authApi\.registerStudent\(\{\s*name:\s*name\.trim\(\),\s*)(password,\s*teacherCode:\s*teacherCode\.trim\(\),\s*\}\);)'
replacement = r'\1email: name.trim(),\n        \2'

new_content = re.sub(pattern, replacement, content)

# Change the alert message to say "Username"
old_alert = r'alert\(`Success! Your Student Login ID is: \$\{res\.studentId\}\\nPlease save this ID, you will need it to login\.`\);'
new_alert = r'alert(`Success! Your Username is: ${res.studentId}\\nPlease use this username to log in.`);'
new_content = re.sub(old_alert, new_alert, new_content)

with open('/Users/mac/Desktop/new project nlp/LERNIQ/src/components/StudentSignup.jsx', 'w') as f:
    f.write(new_content)
