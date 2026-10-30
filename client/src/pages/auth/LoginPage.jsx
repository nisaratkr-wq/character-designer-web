import LoginForm from "../../components/auth/LoginForm";
import "../../styles/Login.css";
import { Link } from "react-router-dom";


function LoginPage() {
  return (
    <div className="login-container">
      <div className="login-card">

         {/* 🔙 ปุ่มย้อนกลับ */}
        <Link to="/">
          <button className="back-btn">← กลับหน้า Home</button>
        </Link>
        
        <h1>Welcome Back </h1>
        <p>เข้าสู่ระบบเพื่อเริ่มออกแบบตัวละคร</p>

        <LoginForm />
        <p>
        ยังไม่มีบัญชี? <Link to="/register">สมัครสมาชิก</Link>
        </p>
      </div>
    </div>
  );
}


export default LoginPage;