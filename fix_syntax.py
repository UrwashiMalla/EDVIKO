import re

with open('/Users/mac/Desktop/new project nlp/LERNIQ/src/components/StudentSignup.jsx', 'r') as f:
    content = f.read()

bad_snippet = """            </div>

            
              
            </div>"""

good_snippet = """            </div>"""

content = content.replace(bad_snippet, good_snippet)

with open('/Users/mac/Desktop/new project nlp/LERNIQ/src/components/StudentSignup.jsx', 'w') as f:
    f.write(content)
