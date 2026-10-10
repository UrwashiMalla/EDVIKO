import re

with open('/Users/mac/Desktop/new project nlp/LERNIQ/src/components/StudentLogin.jsx', 'r') as f:
    content = f.read()

content = content.replace('Student Login ID', 'Username')
content = content.replace('Enter your Student ID (e.g. student_123456)', 'Enter your Username (e.g. rahul123)')

with open('/Users/mac/Desktop/new project nlp/LERNIQ/src/components/StudentLogin.jsx', 'w') as f:
    f.write(content)
