import RegisterForm from "../../components/auth/RegisterForm";
import { Link } from "react-router-dom";
import "../../styles/Register.css";

function RegisterPage() {
  return (
    <div className="login-container">
      <div className="login-card">

        <Link to="/" className="back-btn">← กลับหน้า Home</Link>

        <h1>Create Account</h1>
        <p>สมัครสมาชิกเพื่อเริ่มใช้งาน</p>

        <RegisterForm />

        <p>
          มีบัญชีแล้ว? <Link to="/login">เข้าสู่ระบบ</Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;