import re

with open('/Users/mac/Desktop/new project nlp/LERNIQ/src/components/StudentSignup.jsx', 'r') as f:
    content = f.read()

# Remove email state
content = re.sub(r'const \[email, setEmail\] = useState\(""\);\n', '', content)

# Remove email from validation
content = content.replace(
    'if (!name || !email || !password || !confirmPassword) {',
    'if (!name || !password || !confirmPassword) {'
)

# Update authApi call
old_call = """      await authApi.registerStudent({
        name: name.trim(),
        email: email.trim(),
        password,
        teacherCode: teacherCode.trim(),
      });

      navigate(`/student/verify-otp?email=${encodeURIComponent(email.trim())}`);"""

new_call = """      const res = await authApi.registerStudent({
        name: name.trim(),
        password,
        teacherCode: teacherCode.trim(),
      });

      alert(`Success! Your Student Login ID is: ${res.studentId}\nPlease save this ID, you will need it to login.`);
      navigate(`/student/login`);"""

content = content.replace(old_call, new_call)

# Remove Email Input HTML
email_html_regex = r'\{\/\* EMAIL \*\/\}.*?<\/div>.*?<\/div>'
content = re.sub(email_html_regex, '', content, flags=re.DOTALL)

# Remove specific texts about email
content = content.replace('<p className="field-hint">A 6-digit OTP verification code will be sent from <b>adityapande78@gmail.com</b>.</p>', '')
content = re.sub(r'<div[^>]*>\s*<span>📧</span>\s*<span>Verification email will be sent from <b>adityapande78@gmail.com</b>\.</span>\s*</div>', '', content, flags=re.DOTALL)
content = content.replace('Sending OTP Email...', 'Creating Account...')

with open('/Users/mac/Desktop/new project nlp/LERNIQ/src/components/StudentSignup.jsx', 'w') as f:
    f.write(content)
