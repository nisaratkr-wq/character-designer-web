import { useLocation, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { API_BASE_URL } from "../api";
import { auth, db } from "../firebase"; // ดึง auth มาใช้
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

const getProfileCharacterNames = (userId) => {
  try {
    return JSON.parse(localStorage.getItem(`profile-character-names:${userId}`) || "{}");
  } catch {
    return {};
  }
};

function Profile() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // เก็บข้อมูล User
  const [user, setUser] = useState(location.state?.user || null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(!user);

  // 🔥 State สำหรับเก็บผลงานตัวละครที่ผู้ใช้คนนี้เคยออกแบบไว้
  const [myCharacters, setMyCharacters] = useState([]);
  const [editingCharacterId, setEditingCharacterId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [isSavingCharacter, setIsSavingCharacter] = useState(false);
  const [postCharacter, setPostCharacter] = useState(null);
  const [isPosting, setIsPosting] = useState(false);
  const [postSuccessCharacter, setPostSuccessCharacter] = useState(null);
  const [actionMessage, setActionMessage] = useState("");
  const [actionMessageType, setActionMessageType] = useState("error");

  // เช็คสถานะล็อกอินจาก Firebase
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);

        if (db) {
          try {
            const profileRef = doc(db, "users", currentUser.uid);
            const profileSnap = await getDoc(profileRef);

            if (profileSnap.exists()) {
              setUserProfile(profileSnap.data());
            } else {
              const profileData = {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName || currentUser.email?.split("@")[0] || "member",
                photoURL: currentUser.photoURL || "",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              };

              await setDoc(profileRef, profileData, { merge: true });
              setUserProfile(profileData);
            }
          } catch (firestoreError) {
            console.warn("Could not sync profile in Firestore:", firestoreError.message);
            setUserProfile({
              displayName: currentUser.displayName || currentUser.email?.split("@")[0] || "member",
              email: currentUser.email,
              uid: currentUser.uid,
            });
          }
        } else {
          setUserProfile({
            displayName: currentUser.displayName || currentUser.email?.split("@")[0] || "member",
            email: currentUser.email,
            uid: currentUser.uid,
          });
        }
      } else {
        navigate("/login");
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  // โหลดผลงานจาก backend ภายนอกผ่าน REST API
  useEffect(() => {
    const userId = user?.uid;
    if (!userId) return;

    const controller = new AbortController();
    fetch(`${API_BASE_URL}/api/saved-characters?user_id=${encodeURIComponent(userId)}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const savedCharacters = Array.isArray(data) ? data : [];
        const profileCharacterNames = getProfileCharacterNames(userId);
        setMyCharacters(savedCharacters.map((character) => ({
          ...character,
          layers: getSavedCharacterLayers(character),
          preview_image_url: character.preview_image_url || character.image || "",
          profileDisplayName: profileCharacterNames[character.id] || character.characterName || "ภาพที่บันทึกจาก DressUpPage",
        })));
      })
      .catch((err) => {
        if (err.name !== "AbortError") console.error("Error fetching saved characters:", err);
      });

    return () => controller.abort();
  }, [user?.uid]);

  const savedLayerOrder = [
    "background",
    "base",
    "shortclothes",
    "tallclothes",
    "chubbyclothes",
    "femaleclothes",
    "maleclothes",
    "face",
    "hair",
    "accessory",
  ];

  const getSavedCharacterLayers = (character) => {
    let layers = character.layers;
    if (typeof layers === "string") {
      try {
        layers = JSON.parse(layers);
      } catch {
        layers = {};
      }
    }

    if (layers && typeof layers === "object") return layers;

    return character.image ? { base: character.image } : {};
  };

  // ฟังก์ชัน Logout
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  const updateCharacter = (updatedCharacter) => {
    setMyCharacters((characters) =>
      characters.map((character) => character.id === updatedCharacter.id ? updatedCharacter : character)
    );
  };

  const handleRename = async (character) => {
    const nextName = editingName.trim();
    if (!nextName || !character?.id || !user?.uid || isSavingCharacter) return;

    setIsSavingCharacter(true);
    setActionMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/saved-characters/${character.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.uid, character_name: nextName }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = response.status === 400
          ? "ข้อมูลที่ส่งไปไม่ถูกต้อง กรุณาตรวจสอบชื่อผลงาน"
          : response.status === 404
            ? "ไม่พบตัวละครที่ต้องการแก้ไข หรือคุณไม่มีสิทธิ์แก้ไขรายการนี้"
            : result.error || `HTTP ${response.status}`;
        throw new Error(message);
      }

      const updatedCharacter = result;
      const profileCharacterNames = getProfileCharacterNames(user.uid);
      profileCharacterNames[character.id] = nextName;
      localStorage.setItem(`profile-character-names:${user.uid}`, JSON.stringify(profileCharacterNames));
      updateCharacter({ ...character, ...updatedCharacter, profileDisplayName: nextName });
      setEditingCharacterId(null);
      setEditingName("");
      setActionMessageType("success");
      setActionMessage("บันทึกการแก้ไขสำเร็จ");
    } catch (error) {
      console.error("Error renaming character:", error);
      setActionMessageType("error");
      setActionMessage(`เปลี่ยนชื่อผลงานไม่สำเร็จ: ${error.message}`);
    } finally {
      setIsSavingCharacter(false);
    }
  };

  const handlePost = async () => {
    if (!postCharacter || !user?.uid || isPosting) return;

    const displayName = userProfile?.displayName?.trim()
      || user?.displayName?.trim()
      || user?.email?.split("@")[0]?.trim()
      || "";
    if (!displayName) {
      setActionMessageType("error");
      setActionMessage("ไม่พบชื่อสมาชิก กรุณาตรวจสอบข้อมูลโปรไฟล์ก่อนโพสต์");
      return;
    }

    setIsPosting(true);
    setActionMessage("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/saved-characters/${postCharacter.id}/post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.uid,
          display_name: displayName,
        }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || `HTTP ${response.status}`);
      }
      const postedCharacter = await response.json();
      updateCharacter(postedCharacter);
      setPostCharacter(null);
      setPostSuccessCharacter({
        image: postCharacter.preview_image_url || "",
        name: postCharacter.profileDisplayName || "ภาพที่บันทึกจาก DressUpPage",
      });
    } catch (error) {
      console.error("Error posting character:", error);
      setActionMessageType("error");
      setActionMessage(error.message || "โพสต์ผลงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsPosting(false);
    }
  };

  const handleDelete = async (contentId) => {
    if (!window.confirm("คุณต้องการลบผลงานนี้หรือไม่")) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/saved-characters/${contentId}?user_id=${encodeURIComponent(user.uid)}`,
        { method: "DELETE" }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setMyCharacters((characters) => characters.filter((item) => item.id !== contentId));
    } catch (error) {
      console.error("Error deleting character:", error);
      setActionMessageType("error");
      setActionMessage("ลบผลงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fc] flex items-center justify-center text-slate-700">
        <p className="text-xl animate-pulse">กำลังโหลดข้อมูลโปรไฟล์...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f7f8fc] p-4 font-sans text-slate-700 antialiased md:p-8">
      
      {/* ส่วนหัวบนสุด: ปุ่มกลับหน้าแรก */}
      <div className="max-w-7xl mx-auto mb-6 flex w-full flex-none flex-wrap items-center gap-3">
        <Link
          to="/"
          className="inline-flex items-center space-x-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm hover:text-[#7e22ce] hover:border-purple-200 hover:bg-purple-50 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          <span>กลับหน้า Home</span>
        </Link>
      </div>

      {/* เค้าโครงหลักแบ่งเป็น ซ้าย-ขวา ด้วย Grid */}
      <div className="max-w-7xl mx-auto grid min-h-0 w-full flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-8 lg:grid-cols-3 lg:grid-rows-1 items-stretch">
        
        {/* ==========================================
            👈 ฝั่งซ้าย: ข้อมูลผู้ใช้งาน & ปุ่ม Logout
           ========================================== */}
        <div className="min-h-0 overflow-hidden bg-white rounded-2xl p-6 border border-slate-200 shadow-[0_18px_45px_rgba(30,41,59,0.08)] lg:sticky lg:top-24">
          
          {/* ส่วนรูปโปรไฟล์ */}
          <div className="flex flex-col items-center text-center mb-6">
            {user?.photoURL ? (
              <img 
                src={user.photoURL} 
                alt="Profile" 
                className="w-24 h-24 rounded-full border-4 border-purple-500 object-cover shadow-lg mb-4"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-purple-50 border-4 border-purple-500 flex items-center justify-center mb-4 shadow-lg">
                <svg className="w-12 h-12 text-purple-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
            )}
            <h1 className="text-xl font-bold text-slate-900">
              {userProfile?.displayName || user?.displayName || user?.email?.split("@")[0] || "สมาชิก"}
            </h1>
            <p className="text-xs text-purple-600 mt-1">Character Designer Member</p>
          </div>

          <hr className="border-slate-100 mb-6" />

          {/* กล่องข้อความแสดงข้อมูล */}
          <div className="space-y-4 mb-8">
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Display Name</label>
              <div className="bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 font-medium text-sm break-all">
                {userProfile?.displayName || user?.displayName || user?.email?.split("@")[0] || "สมาชิก"}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">Email Address</label>
              <div className="bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 font-medium text-sm break-all">
                {user?.email}
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">User ID (UID)</label>
              <div className="bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 text-xs font-mono break-all">
                {user?.uid}
              </div>
            </div>
          </div>

          {/* ปุ่มจัดการด้านล่าง - ปุ่ม Logout สีแดง */}
          <div className="space-y-3">
            <Link to="/dressup" className="w-full block">
              <button className="w-full bg-[#9333ea] hover:bg-[#7e22ce] text-white py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg shadow-purple-200 hover:scale-[1.02] active:scale-[0.98]">
                เริ่มออกแบบตัวละครใหม่
              </button>
            </Link>
            
            <button 
              onClick={handleLogout}
              className="w-full bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm hover:scale-[1.02] active:scale-[0.98]"
            >
              Logout
            </button>
          </div>

        </div>

        {/* ==========================================
            👉 ฝั่งขวา: แกลเลอรีรวมงานที่ออกแบบแล้ว
           ========================================== */}
        <div className="min-h-0 overflow-hidden lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200 shadow-[0_18px_45px_rgba(30,41,59,0.08)] flex flex-col">
          <div className="flex justify-between items-center mb-6">
             <div>
               <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                 <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                 </svg>
                 <span>ผลงานการออกแบบของคุณ ({myCharacters.length})</span>
               </h2>
               <p className="mt-1 text-sm text-slate-500">กรุณากดคลิกขวาเพื่อทำการดาวน์โหลดรูปภาพ</p>
             </div>
            
           </div>

          {/* ตรวจสอบว่ามีผลงานไหม */}
          <div className="min-h-0 flex-1 overflow-y-auto pr-2">
            {myCharacters.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {myCharacters.map((c) => (
                <article
                  className="transform transition-all duration-300 hover:-translate-y-1 bg-white rounded-xl overflow-hidden shadow-md border border-slate-200 hover:shadow-lg hover:border-purple-200"
                  key={c.id}
                >
                  <div className="relative aspect-[16/9] bg-slate-50 flex items-center justify-center overflow-hidden">
                    {c.preview_image_url ? (
                      <img
                        alt={c.character_name || c.characterName || "ตัวละครที่บันทึกไว้"}
                        className="absolute h-full w-full object-contain"
                        src={c.preview_image_url}
                      />
                    ) : (
                      savedLayerOrder.map((layerName, layerIndex) => {
                        const imageUrl = getSavedCharacterLayers(c)[layerName];
                        if (!imageUrl) return null;

                        return (
                          <img
                            key={`${c.id}-${layerName}`}
                            src={imageUrl}
                            alt={`${c.character_name || c.characterName || "ตัวละคร"} ${layerName}`}
                            className="absolute inset-0 h-full w-full object-contain"
                            style={{ zIndex: layerIndex + 1 }}
                          />
                        );
                      })
                    )}
                    <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2">
                      <button type="button" title="แก้ไขชื่อผลงาน" aria-label="แก้ไขชื่อผลงาน" onClick={() => { setEditingCharacterId(c.id); setEditingName(c.profileDisplayName || "ภาพที่บันทึกจาก DressUpPage"); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-600 shadow-lg ring-1 ring-slate-200 transition hover:bg-purple-50 hover:text-purple-600">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 3.487 3.651 3.651M4 20h4l10.862-10.862a2.586 2.586 0 0 0-3.651-3.651L4.349 16.349A2 2 0 0 0 4 17.763V20Z" /></svg>
                      </button>
                      <button type="button" title="โพสต์ลงแกลเลอรี" aria-label="โพสต์ลงแกลเลอรี" onClick={() => setPostCharacter(c)} disabled={c.posted || isPosting} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-purple-600 shadow-lg ring-1 ring-slate-200 transition hover:bg-purple-50 disabled:cursor-not-allowed disabled:text-slate-300">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0-4 4m4-4 4 4M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>
                      </button>
                      <button type="button" title="ลบผลงาน" aria-label="ลบผลงาน" onClick={() => handleDelete(c.id)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-red-500 shadow-lg ring-1 ring-slate-200 transition hover:bg-red-50">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18m-2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6m3 0V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m-6 5v6m4-6v6" /></svg>
                      </button>
                    </div>
                  </div>
                  <div className="p-4 flex justify-between items-center gap-3">
                    {editingCharacterId === c.id ? (
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <input value={editingName} onChange={(event) => setEditingName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && handleRename(c)} disabled={isSavingCharacter} className="min-w-0 flex-1 rounded-lg border border-purple-200 bg-white px-2 py-1 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-purple-200 disabled:opacity-60" autoFocus />
                        <button type="button" onClick={() => handleRename(c)} disabled={isSavingCharacter} className="text-xs font-semibold text-purple-600 hover:text-purple-800 disabled:cursor-wait disabled:opacity-60">{isSavingCharacter ? "กำลังบันทึก..." : "บันทึก"}</button>
                        <button type="button" onClick={() => setEditingCharacterId(null)} disabled={isSavingCharacter} className="text-xs text-slate-400 hover:text-slate-600 disabled:opacity-60">ยกเลิก</button>
                      </div>
                    ) : (
                      <span className="text-slate-800 font-medium text-sm">{c.profileDisplayName || "ภาพที่บันทึกจาก DressUpPage"}</span>
                    )}
                  </div>
                </article>
              ))}
              </div>
            ) : (
              /* กรณีไม่มีผลงาน */
              <div className="flex h-full min-h-[350px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 p-6 text-center">
                <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l8.954-8.955M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-slate-600 mb-2">คุณยังไม่มีผลงานที่ออกแบบไว้ในแกลเลอรี</p>
                <p className="text-xs text-slate-400">สร้างตัวละครแรกของคุณเพื่อแสดงที่นี่!</p>
              </div>
            )}
          </div>

        </div>

      </div>
      {postCharacter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">ยืนยันการโพสต์</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">คุณต้องการโพสต์ผลงานนี้ลงแกลอรีหรือไม่</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setPostCharacter(null)} disabled={isPosting} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">ยกเลิก</button>
              <button type="button" onClick={handlePost} disabled={isPosting} className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-wait disabled:opacity-60">{isPosting ? "กำลังโพสต์..." : "ยืนยัน"}</button>
            </div>
          </div>
        </div>
      )}
      {postSuccessCharacter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl text-green-600">✓</div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">โพสต์สำเร็จ</h3>
            <p className="mt-2 text-sm text-slate-600">โพสต์ {postSuccessCharacter.name} ลงหน้า Gallery เรียบร้อยแล้ว</p>
            <div className="mt-6 flex justify-center gap-3">
              <button type="button" onClick={() => setPostSuccessCharacter(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">ปิด</button>
              <button type="button" onClick={() => navigate("/popular")} className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">ไปหน้า Gallery </button>
            </div>
          </div>
        </div>
      )}
      {actionMessage && (
        <div className={`fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-3 text-sm shadow-lg ring-1 ${actionMessageType === "success" ? "bg-green-50 text-green-700 ring-green-100" : "bg-red-50 text-red-600 ring-red-100"}`}>
          {actionMessage}
          <button type="button" onClick={() => setActionMessage("")} className="ml-3 font-bold">ปิด</button>
        </div>
      )}
    </div>
  );
}

export default Profile;