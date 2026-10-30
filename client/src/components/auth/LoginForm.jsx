// ใช้เก็บข้อมูลใน input
import { useState } from "react";

// เรียก Firebase auth ที่เราสร้างไว้
import { auth, db } from "../../firebase";

// ฟังก์ชัน login ของ Firebase
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

// ใช้เปลี่ยนหน้าเว็บ
import { useNavigate } from "react-router-dom";

function LoginForm() {

  // คำสั่งสำหรับเปลี่ยนหน้า
  const navigate = useNavigate();

  // state เก็บ email
  const [email, setEmail] = useState("");

  // state เก็บ password
  const [password, setPassword] = useState("");

  // ฟังก์ชันทำงานตอนกด Login
  const handleLogin = async (e) => {

    // กันหน้า reload
    e.preventDefault();

    try {

      // 🔥 Login ด้วย Firebase
      const userCredential = await signInWithEmailAndPassword(
        auth,       // auth ของ firebase
        email,      // email ที่กรอก
        password    // password ที่กรอก
      );

      const user = userCredential.user;

      if (db) {
        try {
          const userRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userRef);

          if (!userSnap.exists()) {
            await setDoc(
              userRef,
              {
                uid: user.uid,
                email: user.email,
                displayName: user.email?.split("@")[0] || "member",
                photoURL: user.photoURL || "",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          }
        } catch (firestoreError) {
          console.warn("Firestore profile sync skipped:", firestoreError.message);
        }
      }

      // แจ้งเตือน
      alert("เข้าสู่ระบบสำเร็จ 🎉");

      // 🔥 กลับหน้า Home
      navigate("/");

    } catch (error) {

      // ถ้า login ไม่สำเร็จ
      alert("Login ไม่สำเร็จ: " + error.message);
    }
  };

  return (

    // form เมื่อ submit จะเรียก handleLogin
    <form className="login-form" onSubmit={handleLogin}>

      {/* input email */}
      <input
        type="email"
        placeholder="Email"

        // เก็บค่าที่พิมพ์ลง state
        onChange={(e) => setEmail(e.target.value)}
      />

      {/* input password */}
      <input
        type="password"
        placeholder="Password"

        // เก็บค่าที่พิมพ์ลง state
        onChange={(e) => setPassword(e.target.value)}
      />

      {/* ปุ่ม submit */}
      <button type="submit">
        Login
      </button>

    </form>
  );
}

// export ให้ไฟล์อื่นใช้ได้
export default LoginForm;