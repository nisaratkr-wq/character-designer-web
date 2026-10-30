import { useEffect, useState } from "react";
import { API_BASE_URL } from "../api";
// ดึง db และ auth จาก firebase config
import { db, auth } from "../firebase";
// Firestore
import { doc, getDoc } from "firebase/firestore";
// Firebase Authentication
import { onAuthStateChanged, signOut } from "firebase/auth";
// React Router
import { Link } from "react-router-dom";

const getCharacterImageSource = (character) => {
  const image = character.image_url || character.image;
  if (!image) return "https://via.placeholder.com/150";
  if (/^(data:|https?:\/\/|\/)/i.test(image)) return image;
  return `data:image/png;base64,${image}`;
};

const formatCharacterDate = (value) => {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
};

function HomePage() {
  // 🔥 เก็บข้อมูล user ที่ login
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  // 🔥 เก็บ character
  const [characters, setCharacters] = useState([]);
  // ─── ✨ ระบบ Carousel รูปภาพ 3 รูป ───
  const heroImages = [
    "/picture/main1.png",
    "/picture/main4.png", 
    "/picture/main3.png", 
  ];

  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % heroImages.length);
  };
  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + heroImages.length) % heroImages.length);
  };

  // ตั้งเวลาสไลด์หมุนอัตโนมัติทุกๆ 5 วินาที
  useEffect(() => {
    const slideInterval = setInterval(nextSlide, 5000);
    return () => clearInterval(slideInterval);
  }, []);
  // ───────────────────────────────────────────

  // =========================
  // 🔥 เช็คสถานะ Login
  // =========================
  useEffect(() => {
    if (!auth) {
      setUser(null);
      setUserProfile(null);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser && db) {
        try {
          const profileRef = doc(db, "users", currentUser.uid);
          const profileSnap = await getDoc(profileRef);
          setUserProfile(profileSnap.exists() ? profileSnap.data() : null);
        } catch (firestoreError) {
          console.warn("Could not load profile from Firestore:", firestoreError.message);
          setUserProfile({
            displayName: currentUser.displayName || currentUser.email?.split("@")[0] || "member",
            email: currentUser.email,
            uid: currentUser.uid,
          });
        }
      } else {
        setUserProfile(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // =========================
  // 🔥 โหลด character จาก backend
  // =========================
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/popular-characters`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const popularCharacters = Array.isArray(data) ? data : [];
        popularCharacters.sort((first, second) => (Number(second.likes) || 0) - (Number(first.likes) || 0));
        setCharacters(popularCharacters.slice(0, 5));
      })
      .catch((err) => console.error("Error fetching popular characters:", err));
  }, []);

  return (
    <div className="min-h-screen bg-[#15121b] text-[#e7e0ed] font-sans antialiased relative">
      {/* ========================================================
          NAVBAR (MainHeader)
      ========================================================== */}
      <header className="bg-[#9333ea] px-6 py-4 flex justify-between items-center sticky top-0 z-[99] shadow-lg relative">
        <div className="flex items-center space-x-2">
          <span className="text-xl font-extrabold tracking-tight text-white hidden sm:inline">
            Character Designer
          </span>
        </div>
        
        <nav className="flex flex-wrap items-center justify-end gap-3 sm:gap-4 relative z-[100]">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/">
              <button className="bg-[#5a5a5a] text-sm px-5 py-2 rounded-full text-white font-medium hover:bg-opacity-80 transition-all cursor-pointer">
                หน้าแรก
              </button>
            </Link>
            <Link to="/popular">
              <button className="bg-[#5a5a5a] text-sm px-5 py-2 rounded-full text-white font-medium hover:bg-opacity-80 transition-all cursor-pointer">
                แกลเลอรีตัวละคร
              </button>
            </Link>
          </div>

          {user ? (
            <div className="flex items-center gap-2 sm:gap-3 ml-1 sm:ml-2">
              <span className="text-sm text-white/90 whitespace-nowrap">
                {userProfile?.displayName || user.displayName || user.email?.split("@")[0] || "สมาชิก"}
              </span>
              <Link to="/profile">
                <button className="bg-[#5a5a5a] text-sm px-5 py-2 rounded-full text-white font-medium hover:bg-opacity-80 transition-all cursor-pointer">
                  โปรไฟล์ของฉัน
                </button>
              </Link>

              <button
                onClick={() => signOut(auth)}
                className="bg-red-600 text-sm px-5 py-2 rounded-full text-white font-medium hover:bg-opacity-80 transition-all cursor-pointer whitespace-nowrap"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link to="/login">
              <button className="bg-[#5a5a5a] text-sm px-5 py-2 rounded-full text-white font-medium hover:bg-opacity-80 transition-all cursor-pointer whitespace-nowrap">
                เข้าสู่ระบบ
              </button>
            </Link>
          )}
        </nav>
      </header>

      {/* ========================================================
          HERO SECTION & MAIN CONTENT
      ========================================================== */}
      <main className="relative z-10">
        <section className="relative w-full overflow-hidden bg-black h-[500px] md:h-[600px] z-10">
          {/* ตัวคอนเทนเนอร์รูปภาพสลับเอฟเฟกต์นุ่มนวล */}
          <div className="relative h-full w-full z-10">
            {heroImages.map((imgSrc, index) => (
              <img
                key={index}
                alt={`Slide ${index + 1}`}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
                  index === currentSlide ? "opacity-60" : "opacity-0"
                }`}
                src={imgSrc}
              />
            ))}
          </div>

          {/* ข้อความคงที่ด้านหน้าสไลด์ */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#15121b] via-transparent to-black/30 flex items-center px-6 z-20">
            <div className="max-w-7xl mx-auto w-full px-4 md:px-12 text-left">
              <h1 className="text-4xl md:text-7xl font-extrabold mb-6 text-white tracking-tight drop-shadow-2xl">
                {user
                  ? `ยินดีต้อนรับ ${userProfile?.displayName || user.displayName || user.email?.split("@")[0] || "สมาชิก"}`
                  : "Welcome to Character Designer"}
              </h1>
              <p className="text-white/90 text-lg md:text-2xl mb-10 drop-shadow-md">
                เริ่มออกแบบตัวละครของคุณเองได้แล้ววันนี้!
              </p>
              
              {/* บังคับเข้าสู่ระบบก่อนเริ่มออกแบบตัวละคร */}
              {user ? (
                <Link to="/dressup">
                  <button className="bg-[#9333ea] hover:bg-[#a855f7] text-white px-12 py-4 rounded-full text-xl font-bold transition-all shadow-2xl hover:scale-105 active:scale-95 w-fit cursor-pointer">
                    เริ่มออกแบบตัวละคร
                  </button>
                </Link>
              ) : (
                <Link to="/login">
                  <button className="bg-[#5a5a5a] hover:bg-[#6b6b6b] text-white/80 px-12 py-4 rounded-full text-xl font-bold transition-all shadow-2xl hover:scale-105 active:scale-95 w-fit cursor-pointer flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    เข้าสู่ระบบเพื่อเริ่มออกแบบ
                  </button>
                </Link>
              )}
            </div>
          </div>

          {/* ปุ่มลูกศรควบคุมซ้าย (Prev) */}
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all cursor-pointer"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>

          {/* ปุ่มลูกศรควบคุมขวา (Next) */}
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-all cursor-pointer"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>

          {/* ปุ่มจุดกลมบอกตำแหน่งด้านล่าง (Indicators) */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex space-x-3">
            {heroImages.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-3 h-3 rounded-full transition-all cursor-pointer ${
                  index === currentSlide ? "bg-white scale-125" : "bg-white/40 hover:bg-white/60"
                }`}
              />
            ))}
          </div>
        </section>

        {/* =========================
            POPULAR SECTION (Gallery)
        ========================== */}
        <section className="max-w-7xl mx-auto px-6 py-16">
          <h2 className="text-3xl font-bold text-center mb-12 text-white">
            ดีไซน์ยอดนิยม
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
            {characters.slice(0, 5).map((c) => (
              <article
                className="character-card group overflow-hidden rounded-[20px] border border-[#eadde6] bg-white text-[#29202b] shadow-lg shadow-[#eadde6]/50 transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                key={c.id}
              >
                <div className="aspect-square overflow-hidden bg-white">
                  <img
                    alt={c.name}
                    className="h-full w-full object-contain transition duration-500 group-hover:scale-[1.02]"
                    src={getCharacterImageSource(c)}
                  />
                </div>
                <div className="p-5">
                  <p className="truncate text-lg font-black">{c.name}</p>
                  <p className="mt-1 text-sm text-[#806b80]">โดย {c.displayName || "สมาชิก"}</p>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                    <time dateTime={c.created_at || undefined}>{formatCharacterDate(c.created_at)}</time>
                    <div className="inline-flex items-center gap-1.5 text-slate-400" aria-label={`${Number(c.likes) || 0} hearts`}>
                      <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
                      </svg>
                      <span>{Number(c.likes) || 0}</span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-12 flex justify-center">
            <Link to="/popular">
              <button className="bg-[#9333ea] hover:bg-[#a855f7] text-white px-8 py-3 rounded-full text-lg font-bold transition-all shadow-lg hover:scale-105 active:scale-95 w-fit">
                ดูแกลเลอรีทั้งหมด
              </button>
            </Link>
          </div>
        </section>
      </main>

      {/* =========================
          FOOTER
      ========================== */}
      <footer className="bg-[#0f0d15] border-t border-white/10 py-12 px-6 mt-20 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-center md:text-left">
            <p className="text-gray-400 text-sm font-medium">
              © 2026 Character Designer. Created for the imaginative.
            </p>
            <p className="text-gray-500 text-xs mt-2">Version 1.0</p>
            <p className="text-gray-500 text-xs mt-3">
              Thank you everyone for taking the time to try and play my small project.
            </p>
          </div>
          <nav className="flex flex-wrap justify-center gap-6">
            <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Feedback</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export default HomePage;