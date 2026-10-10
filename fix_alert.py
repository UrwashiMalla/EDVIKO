with open('/Users/mac/Desktop/new project nlp/LERNIQ/src/components/StudentSignup.jsx', 'r') as f:
    content = f.read()

import re
content = re.sub(r'alert\(`Success! Your Student Login ID is: \$\{res\.studentId\}.*?`\);', 'alert(`Success! Your Username is: ${res.studentId}\\nPlease use this username to log in.`);', content, flags=re.DOTALL)

with open('/Users/mac/Desktop/new project nlp/LERNIQ/src/components/StudentSignup.jsx', 'w') as f:
    f.write(content)
