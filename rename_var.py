import re

with open('/Users/mac/Desktop/new project nlp/LERNIQ/src/components/StudentLogin.jsx', 'r') as f:
    content = f.read()

content = content.replace('const [email, setEmail]', 'const [username, setUsername]')
content = content.replace('setEmail(e.target.value)', 'setUsername(e.target.value)')
content = content.replace('value={email}', 'value={username}')
content = content.replace('!email ', '!username ')
content = content.replace('let finalId = email.trim();', 'let finalId = username.trim();')
content = content.replace('encodeURIComponent(email.trim())', 'encodeURIComponent(username.trim())')

with open('/Users/mac/Desktop/new project nlp/LERNIQ/src/components/StudentLogin.jsx', 'w') as f:
    f.write(content)
