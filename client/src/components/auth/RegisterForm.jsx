import { useState } from "react";
import { auth, db } from "../../firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

function RegisterForm() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const displayName = email.split("@")[0];

      if (db) {
        try {
          await setDoc(
            doc(db, "users", user.uid),
            {
              uid: user.uid,
              email: user.email,
              displayName,
              photoURL: user.photoURL || "",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch (firestoreError) {
          console.warn("Firestore profile sync skipped:", firestoreError.message);
        }
      }

      await updateProfile(user, { displayName });

      alert("สมัครสมาชิกสำเร็จ 🎉");

      // 🔥 เด้งไปหน้า Home
      navigate("/");

      // ถ้าอยากเด้งไปหน้า Login ใช้อันนี้แทน
      // navigate("/login");

    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="login-form" onSubmit={handleRegister}>
      <input
        type="email"
        placeholder="Email"
        required
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="Password (อย่างน้อย 6 ตัว)"
        required
        onChange={(e) => setPassword(e.target.value)}
      />

      {error && <p style={{ color: "red" }}>{error}</p>}

      <button type="submit">Register</button>
    </form>
  );
}

export default RegisterForm;