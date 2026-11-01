const fs = require('fs');
let content = fs.readFileSync('src/context/AuthContext.jsx', 'utf8');
content = content.replace(/\r\n/g, '\n');
const target = `  const verifyOtp = async (email, otp) => {
    return await authApi.verifyStudentOtp({ email, otp });
  };`;
const replacement = `  const verifyOtp = async (email, otp) => {
    const res = await authApi.verifyStudentOtp({ email, otp });
    if (res.token) {
      localStorage.setItem("lerniq_token", res.token);
    }
    if (res.user) {
      localStorage.setItem("lerniq_user", JSON.stringify(res.user));
      setUser(res.user);
    }
    return res;
  };`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync('src/context/AuthContext.jsx', content, 'utf8');
  console.log('Successfully updated AuthContext.jsx');
} else {
  console.log('Target not found');
}
