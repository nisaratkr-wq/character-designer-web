import { BrowserRouter, Routes, Route } from "react-router-dom";

import HomePage from "./pages/HomePage";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import ProfilePage from "./pages/ProfilePage";
import DressUpPage from "./pages/DressUpPage";
import PopularPage from "./pages/PopularPage";

function App() {

  return (

    <BrowserRouter>

      <Routes>

        {/* หน้า Home */}
        <Route
          path="/"
          element={<HomePage />}
        />

        {/* หน้า Login */}
        <Route
          path="/login"
          element={<LoginPage />}
        />

        {/* หน้า Register */}
        <Route
          path="/register"
          element={<RegisterPage />}
        />

        {/* 🔥 หน้า Profile */}
        <Route
          path="/profile"
          element={<ProfilePage />}
        />
        {/* 🔥 หน้า DressUp*/}
        <Route path="/dressup" element={<DressUpPage />} />

        {/* 🔥 หน้า Popular */}
        <Route path="/popular" element={<PopularPage />} />
      </Routes>

    </BrowserRouter>

  );

}

export default App;