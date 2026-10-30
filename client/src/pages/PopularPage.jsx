import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../api';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

// URL ของ API สำหรับจัดการข้อมูลการกดหัวใจ แยกจาก API หลักของแอป
const HEARTS_API_BASE_URL = import.meta.env.VITE_HEARTS_API_URL || 'http://localhost:5000';

// ไอคอน SVG ที่ใช้ซ้ำภายในหน้า
function IconHome(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 3l9 7.5V21a1.5 1.5 0 0 1-1.5 1.5h-4.5V14h-6v8.5H4.5A1.5 1.5 0 0 1 3 21z" />
    </svg>
  );
}

function IconSparkles(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3Zm8 10 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5Z" />
    </svg>
  );
}

function IconUser(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />
    </svg>
  );
}

function IconArrowRight(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m0 0-6-6m6 6-6 6" />
    </svg>
  );
}

function IconHeart(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.8 8.7c0 5.2-8.8 10.1-8.8 10.1S3.2 13.9 3.2 8.7A4.7 4.7 0 0 1 12 6.1a4.7 4.7 0 0 1 8.8 2.6Z" />
    </svg>
  );
}

export default function PopularPage() {
  // เก็บรายการตัวละคร สถานะการโหลด/ข้อผิดพลาด และข้อมูลการกดหัวใจของผู้ใช้
  const [postedCharacters, setPostedCharacters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [userId, setUserId] = useState(auth?.currentUser?.uid || '');
  const [likedCharacters, setLikedCharacters] = useState({});
  const [heartBusyIds, setHeartBusyIds] = useState({});
  const [sortOrder, setSortOrder] = useState('popular');

  // ติดตามสถานะการเข้าสู่ระบบ เพื่อให้รู้ว่าผู้ใช้คนใดกำลังกดหัวใจ
  useEffect(() => {
    if (!auth) return undefined;

    return onAuthStateChanged(auth, (currentUser) => {
      setUserId(currentUser?.uid || '');
    });
  }, []);

  // โหลดรายการตัวละครที่ถูกเผยแพร่ และยกเลิกคำขอเมื่อออกจากหน้านี้
  useEffect(() => {
    const controller = new AbortController();
    const loadPostedCharacters = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/popular-characters`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        setPostedCharacters(Array.isArray(data) ? data : []);
        setLoadError('');
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error fetching posted characters:', error);
          setPostedCharacters([]);
          setLoadError('Unable to load posted characters. Please try again later.');
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    loadPostedCharacters();
    return () => controller.abort();
  }, []);

  // ตรวจสอบว่าผู้ใช้ปัจจุบันกดหัวใจตัวละครใดไว้แล้วบ้าง
  useEffect(() => {
    if (!userId || !postedCharacters.length) return undefined;

    const controller = new AbortController();
    const loadLikedCharacters = async () => {
      const results = await Promise.all(postedCharacters.map(async (character) => {
        const characterId = character.saved_character_id || character.id;
        const query = new URLSearchParams({
          user_id: userId,
          character_id: String(characterId),
        });

        try {
          const response = await fetch(`${HEARTS_API_BASE_URL}/api/design-hearts?${query}`, {
            signal: controller.signal,
          });
          if (response.status === 404) return [characterId, false];
          if (!response.ok) throw new Error(`HTTP ${response.status}`);

          const data = await response.json();
          const hasLiked = Array.isArray(data)
            ? data.length > 0
            : Boolean(data?.liked ?? data?.exists ?? data?.id ?? data?.heart);
          return [characterId, hasLiked];
        } catch (error) {
          if (error.name !== 'AbortError') console.error('Error checking character heart:', error);
          return [characterId, false];
        }
      }));

      if (!controller.signal.aborted) setLikedCharacters(Object.fromEntries(results));
    };

    loadLikedCharacters();
    return () => controller.abort();
  }, [postedCharacters, userId]);

  // แปลงข้อมูลจาก API เป็นรูปแบบที่หน้าเว็บใช้ พร้อมเรียงตามยอดนิยมหรือล่าสุด
  const displayedCharacters = postedCharacters.map((character) => {
    const characterId = character.saved_character_id || character.id;
    const likeCount = Number(character.likes) || 0;

    return {
      id: character.id,
      characterId,
      name: character.name,
      displayName: character.displayName,
      image: character.image_url,
      postedAt: character.created_at,
      likes: likedCharacters[characterId] ? Math.max(likeCount, 1) : likeCount,
    };
  }).sort((first, second) => {
    if (sortOrder === 'popular') return second.likes - first.likes;

    const firstPostedAt = new Date(first.postedAt).getTime();
    const secondPostedAt = new Date(second.postedAt).getTime();
    return (Number.isNaN(secondPostedAt) ? 0 : secondPostedAt)
      - (Number.isNaN(firstPostedAt) ? 0 : firstPostedAt);
  });

  // แปลงวันที่เผยแพร่ให้อ่านง่าย และแสดงข้อความสำรองเมื่อวันที่ไม่ถูกต้อง
  const formatPostDate = (value) => {
    if (!value) return 'Date unavailable';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Date unavailable';
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  };

  // เพิ่มหรือลบหัวใจผ่าน API พร้อมอัปเดตสถานะและจำนวนหัวใจบนหน้าจอ
  const handleHeartToggle = async (character) => {
    if (!userId) return;

    const characterId = character.characterId || character.saved_character_id || character.id;
    if (heartBusyIds[characterId]) return;

    const isLiked = Boolean(likedCharacters[characterId]);
    const query = new URLSearchParams({ user_id: userId, character_id: String(characterId) });
    setHeartBusyIds((current) => ({ ...current, [characterId]: true }));

    try {
      const response = await fetch(
        `${HEARTS_API_BASE_URL}/api/design-hearts${isLiked ? `?${query}` : ''}`,
        {
          method: isLiked ? 'DELETE' : 'POST',
          headers: isLiked ? undefined : { 'Content-Type': 'application/json' },
          body: isLiked ? undefined : JSON.stringify({ character_id: characterId, user_id: userId }),
        },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      setLikedCharacters((current) => ({ ...current, [characterId]: !isLiked }));
      setPostedCharacters((current) => current.map((item) => {
        const itemId = item.saved_character_id || item.id;
        if (itemId !== characterId) return item;
        return { ...item, likes: Math.max(0, Number(item.likes || 0) + (isLiked ? -1 : 1)) };
      }));
    } catch (error) {
      console.error('Error toggling character heart:', error);
    } finally {
      setHeartBusyIds((current) => ({ ...current, [characterId]: false }));
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#fffaf7] text-[#29202b]">
      {/* แถบด้านบนและลิงก์ไปยังหน้าหลัก หน้าสร้างตัวละคร และโปรไฟล์ */}
      <header className="bg-[#9333ea] px-6 py-4 flex flex-wrap items-center justify-between gap-3 shadow-lg sticky top-0 z-[99]">
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
            <Link to="/dressup">
              <button className="bg-[#5a5a5a] text-sm px-5 py-2 rounded-full text-white font-medium hover:bg-opacity-80 transition-all cursor-pointer">
                เริ่มออกแบบตัวละคร
              </button>
            </Link>
            <Link to="/profile">
              <button className="bg-[#5a5a5a] text-sm px-5 py-2 rounded-full text-white font-medium hover:bg-opacity-80 transition-all cursor-pointer">
                โปรไฟล์ของฉัน
              </button>
            </Link>
          </div>
        </nav>
      </header>

      <main className="relative mx-auto flex max-w-7xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        {/* แบนเนอร์แนะนำแกลเลอรี พร้อมทางลัดไปหน้าเริ่มออกแบบ */}
        <section className="relative isolate min-h-[360px] overflow-hidden rounded-[32px] bg-[#372442] text-white shadow-2xl shadow-[#e6cde8]">
          <img src="/picture/main4.png" alt="ตัวละครกำลังสร้างสรรค์ผลงาน" className="absolute inset-0 -z-10 h-full w-full object-cover object-[70%] opacity-35 mix-blend-screen" />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#372442_5%,rgba(55,36,66,.92)_42%,rgba(55,36,66,.25)_100%)]" />
          <div className="flex min-h-[360px] max-w-xl flex-col justify-center px-6 py-10 sm:px-10">
              <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-[#f7b267]/30 bg-[#f7b267]/10 px-3 py-1 text-sm text-[#ffd29e]">
                <IconSparkles className="h-4 w-4" /> แกลเลอรีตัวละคร
              </div>
              <p className="mt-4 max-w-md text-base leading-7 text-white/70 sm:text-lg">สำรวจผลงานจากคอมมูนิตี้ แล้วหยิบแรงบันดาลใจไปสร้างคาแรกเตอร์ในแบบของคุณ</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/dressup"
                  className="inline-flex items-center gap-2 rounded-full bg-[#f7b267] px-5 py-3 font-bold text-[#241b2b] transition hover:bg-[#ffd29e]"
                >
                  เริ่มสร้างสรรค์ <IconArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 font-semibold text-slate-200 transition hover:bg-white/10"
                >
                    <IconHome className="h-4 w-4" /> ดูผลงานทั้งหมด
                </Link>
              </div>
            </div>
        </section>

        {/* ส่วนรายการผลงาน: แสดงจำนวน เลือกวิธีเรียง และแสดงการ์ดตัวละคร */}
        <section>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-1 text-sm font-bold uppercase tracking-[0.2em] text-[#c87855]">Community showcase</p>
              <h2 className="text-3xl font-black text-[#29202b]">ผลงานยอดนิยม</h2>
            </div>
            <div className="flex flex-col items-start gap-3 sm:items-end">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#806b80]">
                <IconUser className="h-4 w-4 text-[#c87855]" />
                {isLoading ? 'Loading characters...' : `${displayedCharacters.length} characters`}
              </div>
              <div className="inline-flex rounded-lg border border-[#eadde6] bg-white p-1" role="group" aria-label="เรียงลำดับตัวละคร">
                <button
                  type="button"
                  onClick={() => setSortOrder('popular')}
                  aria-pressed={sortOrder === 'popular'}
                  className={`rounded-md px-3 py-2 text-sm font-semibold transition ${sortOrder === 'popular' ? 'bg-[#9333ea] text-white' : 'text-[#806b80] hover:bg-[#fff5eb]'}`}
                >
                  ยอดนิยม
                </button>
                <button
                  type="button"
                  onClick={() => setSortOrder('latest')}
                  aria-pressed={sortOrder === 'latest'}
                  className={`rounded-md px-3 py-2 text-sm font-semibold transition ${sortOrder === 'latest' ? 'bg-[#9333ea] text-white' : 'text-[#806b80] hover:bg-[#fff5eb]'}`}
                >
                  ล่าสุด
                </button>
              </div>
            </div>
          </div>

          {/* แสดงการ์ดผลงาน หรือสถานะกำลังโหลด/ข้อผิดพลาด/ไม่มีข้อมูล */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {!isLoading && !loadError && displayedCharacters.map((char) => (
              <article
                key={char.id}
                className="group overflow-hidden rounded-[24px] border border-[#eadde6] bg-white shadow-lg shadow-[#eadde6]/50 transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="relative h-64 overflow-hidden">
                  {char.image ? (
                    <img
                      src={char.image}
                      alt={char.name}
                      className="h-full w-full object-contain transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">Image unavailable</div>
                  )}
                </div>

                <div className="p-5">
                  <p className="text-lg font-black text-[#29202b]">{char.name}</p>
                  <p className="mt-1 text-sm text-[#806b80]">โดย {char.displayName}</p>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                    <time dateTime={char.postedAt || undefined}>{formatPostDate(char.postedAt)}</time>
                    <button
                      type="button"
                      onClick={() => handleHeartToggle(char)}
                      disabled={!userId || heartBusyIds[char.characterId]}
                      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-2.5 transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${likedCharacters[char.characterId] ? 'text-red-500' : 'text-gray-400'}`}
                      aria-label={likedCharacters[char.characterId] ? 'Unlike character' : 'Like character'}
                      aria-pressed={Boolean(likedCharacters[char.characterId])}
                    >
                      <IconHeart className="h-6 w-6" aria-hidden="true" /> {char.likes}
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {!isLoading && loadError && (
              <p className="col-span-full rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700" role="alert">
                {loadError}
              </p>
            )}
            {!isLoading && !loadError && displayedCharacters.length === 0 && (
              <p className="col-span-full rounded-xl border border-slate-200 bg-white px-5 py-10 text-center text-slate-600">
                No characters have been posted yet.
              </p>
            )}
            {isLoading && (
              <p className="col-span-full py-10 text-center text-slate-600" role="status">
                Loading characters...
              </p>
            )}
          </div>

        </section>
      </main>

      {/* ส่วนท้ายของหน้า พร้อมลิงก์ข้อมูลทั่วไป */}
      <footer className="border-t border-slate-200 bg-white/80 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-center text-sm text-slate-500 sm:px-6 lg:flex-row lg:text-left lg:px-8">
          <p>© 2026 Character Designer สร้างสรรค์จากไอเดียของคุณ</p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="#" className="transition hover:text-violet-600">Terms</a>
            <a href="#" className="transition hover:text-violet-600">Privacy</a>
            <a href="#" className="transition hover:text-violet-600">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}