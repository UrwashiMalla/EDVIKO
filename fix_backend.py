import re

with open('/Users/mac/Desktop/new project nlp/LERNIQ/server/controllers/authController.js', 'r') as f:
    content = f.read()

# Currently we have:
# const finalEmail = email || `student_${Date.now().toString().slice(-6)}@lerniq.edu`;
# We want to change it so if email doesn't have '@', we append '@lerniq.edu'
old_email_logic = """    // Auto-generate email if not provided
    const finalEmail = email || `student_${Date.now().toString().slice(-6)}@lerniq.edu`;"""

new_email_logic = """    // Treat email as username if no @ is present
    let finalEmail = email;
    if (finalEmail && !finalEmail.includes('@')) {
      finalEmail = finalEmail + '@lerniq.edu';
    } else if (!finalEmail) {
      finalEmail = `student_${Date.now().toString().slice(-6)}@lerniq.edu`;
    }"""

content = content.replace(old_email_logic, new_email_logic)

# Replace "An account with this email already exists." with "This Username is already taken. Please choose another."
content = content.replace('An account with this email already exists.', 'This Username is already taken. Please choose another.')

with open('/Users/mac/Desktop/new project nlp/LERNIQ/server/controllers/authController.js', 'w') as f:
    f.write(content)
