import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../api";
import { auth } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";

function DressUpPage() {
  // ใช้เปลี่ยนหน้า และเก็บสถานะผู้ใช้กับหน้าต่างยืนยันการออกจากหน้านี้
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);

  // ติดตามสถานะล็อกอินจาก Firebase และยกเลิกการติดตามเมื่อออกจากหน้านี้
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // หมวดไอเท็มหลักที่ใช้สร้างตัวละคร
  const categories = [
    { id: "base", name: "เบสตัว" },
    { id: "face", name: "ใบหน้า" },
    { id: "hair", name: "ผม" },
    { id: "clothes", name: "เสื้อผ้า" },
    { id: "accessory", name: "เครื่องประดับ" },
    { id: "background", name: "พื้นหลัง" },
  ];

  const [activeCategory, setActiveCategory] = useState("base");
  const [clothesBodyShape, setClothesBodyShape] = useState("all");
  const [clothesType, setClothesType] = useState("all");
  const [accessorySubcategory, setAccessorySubcategory] = useState("headwear");
  const [shoeGender, setShoeGender] = useState("all");
  const [characters, setCharacters] = useState([]);
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [unavailableItemId, setUnavailableItemId] = useState(null);

  // โหลดรายการชิ้นส่วนตัวละครจาก API แล้วแปลงข้อมูลแบบ layers ให้เป็นรายการแสดงผล
  useEffect(() => {
    const controller = new AbortController();

    const loadCharacters = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/characters`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (!Array.isArray(data)) {
          throw new Error("Invalid characters response");
        }

        const characterItems = data.flatMap((character) => {
          if (!character || typeof character !== "object") {
            throw new Error("Invalid character in response");
          }

          const characterName =
            character.name || character.character_name || character.characterName || "ตัวละคร";
          if (character.layers && typeof character.layers === "object" && !Array.isArray(character.layers)) {
            return Object.entries(character.layers)
              .filter(([, imageUrl]) => typeof imageUrl === "string" && imageUrl)
              .map(([category, imageUrl]) => ({
                id: `${character.id || characterName}-${category}`,
                name: `${characterName} (${category})`,
                category,
                description: category,
                image_path: imageUrl,
                image_url: imageUrl,
              }));
          }

          return [{ ...character, name: characterName }];
        });
        setCharacters(characterItems);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Error fetching characters:", err);
          setFetchError("ไม่สามารถโหลดข้อมูลตัวละครได้");
        }
      } finally {
        setIsLoadingCharacters(false);
      }
    };

    loadCharacters();
    return () => controller.abort();
  }, []);

  // เก็บ URL รูปภาพของแต่ละชั้นที่จะนำมาซ้อนเป็นตัวละครหนึ่งตัว
  const [equippedLayers, setEquippedLayers] = useState({
    base: null,
    face: null,
    hair: null,
    maleclothes: null,
    femaleclothes: null,
    chubbyclothes: null,
    tallclothes: null,
    shortclothes: null,
    accessory: null,
    background: null,
  });
  // เก็บรายละเอียดของไอเท็มที่เลือกไว้ เพื่อส่งไปบันทึกพร้อมตัวละคร
  const [selectedAssets, setSelectedAssets] = useState({});

  // ลบไอเท็มเฉพาะหมวดออกจากทั้งภาพตัวอย่างและรายการรายละเอียด
  const handleRemoveLayer = (categoryKey) => {
    setEquippedLayers((prev) => ({
      ...prev,
      [categoryKey]: null,
    }));
    setSelectedAssets((prev) => {
      const next = { ...prev };
      delete next[categoryKey];
      return next;
    });
  };

  // ล้างทุกเลเยอร์และรายละเอียดไอเท็ม เพื่อเริ่มออกแบบใหม่
  const handleClearAll = () => {
    setEquippedLayers({
      base: null,
      face: null,
      hair: null,
      maleclothes: null,
      femaleclothes: null,
      chubbyclothes: null,
      tallclothes: null,
      shortclothes: null,
      accessory: null,
      background: null,
    });
    setSelectedAssets({});
  };

  // วาดภาพโดยรักษาสัดส่วนทั้งหมดไว้ และจัดให้อยู่กึ่งกลางพื้นที่ canvas
  const drawImageContain = (context, image, canvasSize) => {
    const scale = Math.min(canvasSize / image.naturalWidth, canvasSize / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    context.drawImage(image, (canvasSize - width) / 2, (canvasSize - height) / 2, width, height);
  };

  // วาดภาพให้เต็ม canvas โดยยอมตัดส่วนเกินที่ขอบภาพออก
  const drawImageCover = (context, image, canvasSize) => {
    const scale = Math.max(canvasSize / image.naturalWidth, canvasSize / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    context.drawImage(image, (canvasSize - width) / 2, (canvasSize - height) / 2, width, height);
  };

  // ประกอบเลเยอร์ทั้งหมดบน canvas ตามลำดับ แล้วส่งออกเป็น PNG แบบ base64
  const createCompositeImage = async () => {
    const canvas = document.createElement("canvas");
    const canvasSize = 800;
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const context = canvas.getContext("2d");

    // PNG with white background keeps the exported character clean and opaque.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvasSize, canvasSize);

    const loadImage = (src) => new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`โหลดรูป ${src} ไม่สำเร็จ`));
      image.src = src;
    });

    const layerOrder = [
      { key: "background", mode: "cover" },
      { key: "base" },
      { key: "shortclothes" },
      { key: "tallclothes" },
      { key: "chubbyclothes" },
      { key: "femaleclothes" },
      { key: "maleclothes" },
      { key: "face" },
      { key: "hair" },
      { key: "accessory" },
    ];

    for (const layer of layerOrder) {
      const imageUrl = equippedLayers[layer.key];
      if (!imageUrl) continue;
      const image = await loadImage(imageUrl);
      if (layer.mode === "cover") {
        drawImageCover(context, image, canvasSize);
      } else {
        drawImageContain(context, image, canvasSize);
      }
    }

    return canvas.toDataURL("image/png");
  };

  // ตรวจสอบข้อมูลและบัญชีผู้ใช้ สร้างภาพรวม ส่งไปบันทึกที่ API แล้วเปิดหน้าโปรไฟล์
  const handleSaveCharacter = async () => {
    if (selectedItems.length === 0) {
      setSaveMessage("กรุณาเลือกไอเท็มก่อนบันทึก");
      return;
    }

    if (!user?.uid) {
      setSaveMessage("กรุณาเข้าสู่ระบบก่อนบันทึกตัวละคร");
      return;
    }

    setIsSaving(true);
    setSaveMessage("");

    try {
      const previewImageUrl = await createCompositeImage();
      const response = await fetch(`${API_BASE_URL}/api/saved-characters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.uid,
          characterName: `ตัวละครของ ${user?.email || "ผู้ใช้"}`,
          layers: equippedLayers,
          assets: selectedAssets,
          preview_image_url: previewImageUrl,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const savedCharacter = await response.json();
      navigate("/profile", { state: { savedCharacter } });
    } catch (error) {
      console.error("Error saving character:", error);
      setSaveMessage("บันทึกไม่สำเร็จ กรุณาตรวจสอบว่า server พอร์ต 5000 กำลังทำงาน");
    } finally {
      setIsSaving(false);
    }
  };

  // สร้างรายการไอเท็มที่เลือกอยู่สำหรับแสดงในแผงด้านขวา
  const getSelectedItemsList = () => {
    const list = [];
    if (equippedLayers.base) {
      list.push({ id: "base", name: "เบสตัว", icon: "👤", hint: "พื้นฐานของตัวละคร" });
    }
    if (equippedLayers.face) {
      list.push({ id: "face", name: "ใบหน้า", icon: "😊", hint: "ลักษณะใบหน้า" });
    }
    if (equippedLayers.hair) {
      list.push({ id: "hair", name: "ผม", icon: "💇", hint: "สไตล์ผม" });
    }
    if (equippedLayers.maleclothes) {
      list.push({ id: "maleclothes", name: "เสื้อผ้าชาย", icon: "👔", hint: "ชุดสำหรับผู้ชาย" });
    }
    if (equippedLayers.femaleclothes) {
      list.push({ id: "femaleclothes", name: "เสื้อผ้าหญิง", icon: "👗", hint: "ชุดสำหรับผู้หญิง" });
    }
    if (equippedLayers.chubbyclothes) {
      list.push({ id: "chubbyclothes", name: "เสื้อผ้าคนอวบ", icon: "🧥", hint: "ชุดสำหรับรูปร่างอวบ" });
    }
    if (equippedLayers.tallclothes) {
      list.push({ id: "tallclothes", name: "เสื้อผ้าคนสูง", icon: "🧍‍♂️", hint: "ชุดสำหรับคนสูง" });
    }
    if (equippedLayers.shortclothes) {
      list.push({ id: "shortclothes", name: "เสื้อผ้าคนเตี้ย", icon: "🧍‍♀️", hint: "ชุดสำหรับคนเตี้ย" });
    }
    if (equippedLayers.accessory) {
      list.push({ id: "accessory", name: "เครื่องประดับ", icon: "💎", hint: "ของตกแต่ง" });
    }
    if (equippedLayers.background) {
      list.push({ id: "background", name: "พื้นหลัง", icon: "🌊", hint: "ฉากที่ใช้" });
    }
    return list;
  };

  // รายการไอเท็มปัจจุบันที่ใช้ทั้งแสดงผลและตรวจสอบก่อนบันทึก
  const selectedItems = getSelectedItemsList();

  // เลือก URL รูปภาพจากฟิลด์ที่ API อาจส่งมา และเติม base URL ให้ path ภายใน
  const getImageSource = (character) => {
    if (character.image_url) return character.image_url;
    if (character.imageUrl) return character.imageUrl;
    if (typeof character.image === "string") {
      if (character.image.startsWith("http://") || character.image.startsWith("https://")) {
        return character.image;
      }
      if (character.image.startsWith("/")) {
        return `${API_BASE_URL}${character.image}`;
      }
    }
    return character.image || "";
  };

  // รวมชื่อฟิลด์ที่อาจบรรจุ path รูปภาพไว้ใช้ตรวจสอบหมวดหมู่
  const getImagePathForCheck = (character) => {
    return (
      character.image_path ||
      character.imagePath ||
      character.imageUrl ||
      character.image_url ||
      character.image ||
      ""
    ).toString();
  };

  const baseTypes = ["male", "female", "chubby", "tall", "short"];
  const clothingBaseTypes = baseTypes.map((baseType) => `${baseType}clothes`);

  const normalizeBaseType = (value) => {
    if (typeof value !== "string") return null;
    const normalized = value.toLowerCase().trim().replace(/clothes$/, "");
    return baseTypes.includes(normalized) ? normalized : null;
  };

  const getBaseType = (character) => {
    const metadataBase =
      character.base_type ||
      character.baseType ||
      character.body_shape ||
      character.bodyShape;
    const normalizedMetadataBase = normalizeBaseType(metadataBase);
    if (normalizedMetadataBase) return normalizedMetadataBase;

    const imagePath = getImagePathForCheck(character).toLowerCase();
    const pathSegments = imagePath.split(/[\\/]/);
    const baseFileName = (pathSegments[pathSegments.length - 1] || "").replace(/\.[^.]+$/, "");
    return normalizeBaseType(baseFileName) ||
      normalizeBaseType(character.character_name) ||
      normalizeBaseType(character.name);
  };

  // ข้อจำกัดของเสื้อผ้าอ่านจากหมวด/โฟลเดอร์ ส่วนหมวดอื่นจำกัดเมื่อ metadata หรือ path ระบุเบสไว้
  const getSupportedBases = (character) => {
    const supportedBaseMetadata =
      character.supported_bases ??
      character.supportedBases ??
      character.compatible_bases ??
      character.compatibleBases ??
      character.allowed_bases ??
      character.allowedBases ??
      character.base_type ??
      character.baseType ??
      character.body_shape ??
      character.bodyShape;
    if (supportedBaseMetadata !== undefined && supportedBaseMetadata !== null) {
      const values = Array.isArray(supportedBaseMetadata)
        ? supportedBaseMetadata
        : [supportedBaseMetadata];
      return values.map(normalizeBaseType).filter(Boolean);
    }

    const category = (character.category || character.description || "").toString().toLowerCase();
    const imagePath = getImagePathForCheck(character).toLowerCase();
    const clothingType = clothingBaseTypes.find((baseType) =>
      category === baseType || imagePath.split(/[\\/]/).includes(baseType)
    );
    if (clothingType === "maleclothes" || clothingType === "femaleclothes") {
      return ["male", "female"];
    }
    if (clothingType) return [normalizeBaseType(clothingType)];

    const pathSegments = imagePath.split(/[\\/]/);
    const pathBase = pathSegments
      .map(normalizeBaseType)
      .find(Boolean);
    return pathBase ? [pathBase] : [];
  };

  const getCurrentBaseType = () => {
    if (selectedAssets.base?.baseType) return selectedAssets.base.baseType;
    const currentBase = characters.find(
      (character) => getImageSource(character) === equippedLayers.base
    );
    return currentBase ? getBaseType(currentBase) : null;
  };

  const getAssetSupportedBases = (asset, categoryKey) => {
    if (Array.isArray(asset?.supportedBases)) return asset.supportedBases;
    const character = characters.find(
      (item) => getImageSource(item) === asset?.imageUrl
    );
    return character ? getSupportedBases(character) : clothingBaseTypes.includes(categoryKey)
      ? [normalizeBaseType(categoryKey)]
      : [];
  };

  const isItemAllowedForBase = (character, baseType) => {
    const supportedBases = getSupportedBases(character);
    return !baseType || supportedBases.length === 0 || supportedBases.includes(baseType);
  };

  // ตรวจสอบเบสก่อนเลือก และถอดรายการที่ใช้ข้ามเบสเมื่อเปลี่ยนโครงร่าง
  const handleSelectAsset = (categoryKey, imagePath, itemName, icon, character) => {
    const isBase = categoryKey === "base";
    const nextBaseType = isBase ? getBaseType(character) : getCurrentBaseType();
    const supportedBases = getSupportedBases(character);

    if (!isBase && !isItemAllowedForBase(character, nextBaseType)) {
      setUnavailableItemId(character.id || `${imagePath}-${categoryKey}`);
      return;
    }

    setUnavailableItemId(null);
    const selectedAsset = {
      name: itemName || categoryKey,
      category: categoryKey,
      imageUrl: imagePath,
      icon: icon || "",
      supportedBases,
      ...(isBase ? { baseType: nextBaseType } : {}),
    };

    if (isBase) {
      setEquippedLayers((prev) => {
        const next = { ...prev, base: imagePath };
        Object.keys(selectedAssets).forEach((key) => {
          if (key === "base" || key === "background" || !prev[key]) return;
          const asset = selectedAssets[key];
          const allowedBases = getAssetSupportedBases(asset, key);
          if (allowedBases.length > 0 && !allowedBases.includes(nextBaseType)) {
            next[key] = null;
          }
        });
        return next;
      });
      setSelectedAssets((prev) => {
        const next = { ...prev, base: selectedAsset };
        Object.keys(prev).forEach((key) => {
          if (key === "base" || key === "background") return;
          const allowedBases = getAssetSupportedBases(prev[key], key);
          if (allowedBases.length > 0 && !allowedBases.includes(nextBaseType)) {
            delete next[key];
          }
        });
        return next;
      });
      return;
    }

    setEquippedLayers((prev) => ({
      ...prev,
      [categoryKey]: imagePath,
    }));
    setSelectedAssets((prev) => ({
      ...prev,
      [categoryKey]: selectedAsset,
    }));
  };

  const clothingBodyShapes = [
    { id: "all", name: "ทั้งหมด" },
    { id: "maleclothes", name: "ชาย" },
    { id: "femaleclothes", name: "หญิง" },
    { id: "chubbyclothes", name: "อวบ" },
    { id: "tallclothes", name: "สูง" },
    { id: "shortclothes", name: "เตี้ย" },
  ];

  const clothingTypes = [
    { id: "all", name: "ทั้งหมด", pattern: null },
    { id: "formal", name: "ชุดทางการ", pattern: /formal/i },
    { id: "casual", name: "ชุดลำลอง", pattern: /normal|casual/i },
    { id: "work", name: "ชุดทำงาน", pattern: /work/i },
    { id: "sport", name: "ชุดออกกำลังกาย", pattern: /sport/i },
    { id: "sleep", name: "ชุดนอน", pattern: /sleep/i },
    { id: "swim", name: "ชุดว่ายน้ำ", pattern: /swim/i },
  ];

  const getClothingBodyShape = (character) => {
    const category = (character.category || character.description || "").toString().toLowerCase();
    const imagePath = getImagePathForCheck(character).toLowerCase();
    return clothingBodyShapes
      .slice(1)
      .find(({ id }) => category === id || imagePath.includes(`/${id}/`))?.id;
  };

  const getClothingType = (character) => {
    const searchableText = [
      character.character_name,
      character.name,
      getImagePathForCheck(character),
    ]
      .filter((value) => typeof value === "string")
      .join(" ");
    return clothingTypes.find(({ pattern }) => pattern?.test(searchableText))?.id;
  };

  const accessorySubcategories = [
    { id: "shoes", name: "รองเท้า" },
    { id: "headwear", name: "เครื่องประดับหัว" },
    { id: "glasses", name: "แว่นตา" },
    { id: "bags", name: "กระเป๋า" },
  ];

  const getAccessorySearchText = (character) =>
    [
      character.category,
      character.description,
      character.character_name,
      character.name,
      getImagePathForCheck(character),
    ]
      .filter((value) => typeof value === "string")
      .map((value) => value.replace(/([a-z])([A-Z])/g, "$1 $2"))
      .join(" ")
      .toLowerCase();

  const getAccessoryType = (character) => {
    const category = String(character.category || "").toLowerCase();
    if (category === "shoesmale" || category === "shoesfemale") return "shoes";

    const searchableText = getAccessorySearchText(character);

    if (/(^|[^a-z])(shoe|shoes|footwear)([^a-z]|$)/i.test(searchableText)) return "shoes";
    if (/(^|[^a-z])(hat|bow|headwear)([^a-z]|$)/i.test(searchableText)) return "headwear";
    if (/(^|[^a-z])(glasses|eyewear)([^a-z]|$)/i.test(searchableText)) return "glasses";
    if (/(^|[^a-z])(bag|bags)([^a-z]|$)/i.test(searchableText)) return "bags";
    return null;
  };

  const getShoeGender = (character) => {
    const category = String(character.category || "").toLowerCase();

    if (category === "shoesfemale") return "female";
    if (category === "shoesmale") return "male";

    const searchableText = getAccessorySearchText(character);

    if (/(^|[^a-z])female([^a-z]|$)/i.test(searchableText)) return "female";
    if (/(^|[^a-z])male([^a-z]|$)/i.test(searchableText)) return "male";
    return null;
  };

  // ตรวจว่าข้อมูลหรือ path ของรูปภาพตรงกับหมวดที่ผู้ใช้กำลังเลือกหรือไม่
  const matchesCategory = (character, categoryKey) => {
    const category = (character.category || "").toString().toLowerCase();
    const desc = (character.description || "").toString().toLowerCase();
    const imgPath = getImagePathForCheck(character).toLowerCase();

    switch (categoryKey) {
      case "base":
        return category === "base" || desc === "base" || imgPath.includes("/base/");
      case "face":
        return category === "face" || desc === "face" || imgPath.includes("/face/");
      case "hair":
        return imgPath.includes("/hair/");
      case "maleclothes":
        return imgPath.includes("/maleclothes/");
      case "femaleclothes":
        return imgPath.includes("/femaleclothes/");
      case "chubbyclothes":
        return imgPath.includes("/chubbyclothes/");
      case "tallclothes":
        return imgPath.includes("/tallclothes/");
      case "shortclothes":
        return imgPath.includes("/shortclothes/");
      case "clothes":
        return (
          getClothingBodyShape(character) &&
          (clothesBodyShape === "all" ||
            getClothingBodyShape(character) === clothesBodyShape) &&
          (clothesType === "all" || getClothingType(character) === clothesType)
        );
      case "accessory":
        return getAccessoryType(character) !== null;
      case "accessory-subcategory":
        return (
          getAccessoryType(character) === accessorySubcategory &&
          (accessorySubcategory !== "shoes" ||
            shoeGender === "all" ||
            getShoeGender(character) === shoeGender)
        );
      case "background":
        return category === "background" || desc === "background" || imgPath.includes("/background/");
      default:
        return false;
    }
  };

  // กรองรายการไอเท็มให้เหลือเฉพาะหมวดและหมวดย่อยที่กำลังเปิด
  const filteredCharacters = characters.filter((ch) =>
    matchesCategory(ch, activeCategory === "accessory" ? "accessory-subcategory" : activeCategory)
  );
  // ดำเนินการตามตัวเลือกในกล่องยืนยัน: กลับหน้าหลัก หรือออกจากระบบ
  const handleConfirmAction = async () => {
    if (confirmAction === "home") {
      window.location.href = "/";
    } else if (confirmAction === "logout") {
      await signOut(auth);
      window.location.href = "/";
    }
    setShowConfirm(false);
    setConfirmAction(null);
  };

  // เปิดกล่องยืนยัน พร้อมจำไว้ว่าผู้ใช้ต้องการทำรายการใด
  const openConfirm = (action) => {
    setConfirmAction(action);
    setShowConfirm(true);
  };

  return (
    <div className="min-h-screen bg-[#f3f4f9] font-sans antialiased text-[#15121b]">
      {/* แถบนำทาง: กลับหน้าหลัก แสดงบัญชีผู้ใช้ และเข้าสู่ระบบ/ออกจากระบบ */}
      <header className="bg-[#9333ea] px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-lg">
        <div className="flex items-center space-x-2">
          <span className="text-xl font-extrabold tracking-tight text-white">Character Designer</span>
        </div>
        <nav className="flex items-center space-x-4">
          <button
            onClick={() => openConfirm("home")}
            className="bg-[#5a5a5a] text-sm px-5 py-2 rounded-full text-white font-medium hover:bg-opacity-80 transition-all cursor-pointer"
          >
            หน้าแรก
          </button>
          {user ? (
            <div className="flex items-center space-x-4">
              <span className="text-white text-sm font-medium">{user.email}</span>
              <button
                onClick={() => openConfirm("logout")}
                className="bg-red-600 text-sm px-5 py-2 rounded-full text-white font-medium hover:bg-opacity-80 transition-all cursor-pointer"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link to="/login"><button className="bg-[#5a5a5a] text-sm px-5 py-2 rounded-full text-white font-medium hover:bg-opacity-80 transition-all cursor-pointer">เข้าสู่ระบบ</button></Link>
          )}
        </nav>
      </header>

      {/* กล่องยืนยันก่อนออกจากหน้า เพื่อเตือนว่าการออกแบบที่ยังไม่บันทึกอาจสูญหาย */}
      {showConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">ยืนยันการออกจากหน้านี้</h3>
            <p className="mt-3 text-sm text-gray-600">
              หากคุณออกจากหน้านี้ตอนนี้ การเปลี่ยนแปลงที่คุณกำลังทำอาจจะไม่ได้ถูกบันทึกไว้
            </p>
            <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowConfirm(false);
                    setConfirmAction(null);
                  }}
                  className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleConfirmAction}
                  className="rounded-full bg-[#9333ea] px-4 py-2 text-sm font-medium text-white hover:bg-[#7e22ce]"
                >
                  ยืนยัน
                </button>
              </div>
            </div>
          </div>
        )}

      {/* พื้นที่ทำงานหลัก แบ่งเป็นแผงเลือกไอเท็ม ภาพตัวอย่าง และรายการที่เลือก */}
      <main className="max-w-[1440px] mx-auto p-4 md:p-6 grid grid-cols-1 xl:grid-cols-[1fr_1.4fr_0.8fr] gap-4 md:gap-6 items-start">
        
        {/* 1️⃣ ฝั่งซ้าย - เลือกไอเท็มเพื่อสวมใส่ */}
        <div className="xl:col-span-1">
          <p className="mb-2 px-1 text-xs text-gray-600">
            หมายเหตุ เบสตัวละครบางตัวไม่สามารถใส่ชุดของเบสตัวละครอื่นได้
          </p>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 min-h-[520px]">
            <div className="grid grid-cols-3 gap-2 mb-6">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setUnavailableItemId(null);
                  setActiveCategory(cat.id);
                  if (cat.id === "clothes") {
                    setClothesBodyShape("all");
                    setClothesType("all");
                  }
                  if (cat.id === "accessory") {
                    setAccessorySubcategory("headwear");
                    setShoeGender("all");
                  }
                }}
                className={`text-xs py-2.5 px-1 rounded-lg font-bold border transition-all cursor-pointer ${
                  activeCategory === cat.id ? "bg-[#9333ea] text-white border-[#9333ea] shadow-md" : "bg-white text-black border-gray-200 hover:bg-purple-50"
                }`}
              >
                {cat.name}
              </button>
            ))}
            </div>

          {/* ปุ่มกรองหมวดย่อยเสื้อผ้า แสดงเฉพาะเมื่อเปิดหมวดเสื้อผ้า */}
          {activeCategory === "clothes" && (
            <div className="mt-2 mb-4 space-y-3">
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">ประเภทรูปร่าง</p>
                <div className="flex w-full min-w-0 flex-nowrap gap-2 overflow-x-auto pb-1">
                  {clothingBodyShapes.map((shape) => (
                    <button
                      key={shape.id}
                      type="button"
                      onClick={() => setClothesBodyShape(shape.id)}
                      className={`shrink-0 text-xs py-2 px-3 rounded-lg font-bold border transition-all cursor-pointer ${
                        clothesBodyShape === shape.id ? "bg-[#9333ea] text-white border-[#9333ea] shadow-md" : "bg-white text-black border-gray-200 hover:bg-purple-50"
                      }`}
                    >
                      {shape.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">ประเภทชุด</p>
                <div className="flex flex-wrap gap-2">
                  {clothingTypes.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setClothesType(type.id)}
                      className={`text-xs py-2 px-3 rounded-lg font-bold border transition-all cursor-pointer ${
                        clothesType === type.id ? "bg-[#9333ea] text-white border-[#9333ea] shadow-md" : "bg-white text-black border-gray-200 hover:bg-purple-50"
                      }`}
                    >
                      {type.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeCategory === "accessory" && (
            <div className="mt-2 mb-4 space-y-3">
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">หมวดหมู่เครื่องประดับ</p>
                <div className="flex flex-wrap gap-2">
                  {accessorySubcategories.map((subcategory) => (
                    <button
                      key={subcategory.id}
                      type="button"
                      onClick={() => {
                        setAccessorySubcategory(subcategory.id);
                        setShoeGender("all");
                        setUnavailableItemId(null);
                      }}
                      aria-pressed={accessorySubcategory === subcategory.id}
                      className={`text-xs py-2 px-3 rounded-lg font-bold border transition-all cursor-pointer ${
                        accessorySubcategory === subcategory.id
                          ? "bg-[#9333ea] text-white border-[#9333ea] shadow-md"
                          : "bg-white text-black border-gray-200 hover:bg-purple-50"
                      }`}
                    >
                      {subcategory.name}
                    </button>
                  ))}
                </div>
              </div>
              {accessorySubcategory === "shoes" && (
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">ประเภทรองเท้า</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "all", name: "ทั้งหมด" },
                      { id: "male", name: "ชาย" },
                      { id: "female", name: "หญิง" },
                    ].map((gender) => (
                      <button
                        key={gender.id}
                        type="button"
                        onClick={() => setShoeGender(gender.id)}
                        aria-pressed={shoeGender === gender.id}
                        className={`text-xs py-2 px-3 rounded-lg font-bold border transition-all cursor-pointer ${
                          shoeGender === gender.id
                            ? "bg-[#9333ea] text-white border-[#9333ea] shadow-md"
                            : "bg-white text-black border-gray-200 hover:bg-purple-50"
                        }`}
                      >
                        {gender.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* รายการไอเท็มจาก backend พร้อมสถานะโหลด ข้อผิดพลาด และผลการกรอง */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-700">
                {activeCategory === "clothes"
                  ? "เสื้อผ้า"
                  : activeCategory === "accessory"
                    ? accessorySubcategories.find(({ id }) => id === accessorySubcategory)?.name
                    : "ตัวอย่างตัวละคร"}
              </p>
              {isLoadingCharacters ? (
                <span className="text-xs text-gray-400">กำลังโหลด...</span>
              ) : fetchError ? (
                <span className="text-xs text-red-500">{fetchError}</span>
              ) : (
                <span className="text-xs text-gray-400">{filteredCharacters.length} รายการ</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 max-h-[420px] overflow-auto pr-1">
              {isLoadingCharacters && (
                <div className="col-span-2 rounded-2xl bg-gray-50 border border-gray-200 p-4 text-center text-sm text-gray-500">
                  กำลังโหลดข้อมูลจากเซิร์ฟเวอร์...
                </div>
              )}

              {!isLoadingCharacters && fetchError && (
                <div className="col-span-2 rounded-2xl bg-red-50 border border-red-200 p-4 text-center text-sm text-red-600">
                  {fetchError}
                </div>
              )}

              {!isLoadingCharacters && !fetchError && filteredCharacters.length === 0 && (
                <div className="col-span-2 rounded-2xl bg-gray-50 border border-gray-200 p-4 text-center text-sm text-gray-500">
                  {activeCategory === "clothes"
                    ? "ไม่พบเสื้อผ้าในหมวดหมู่นี้"
                    : activeCategory === "accessory"
                      ? "ไม่พบรายการในหมวดหมู่นี้"
                    : "ยังไม่มีตัวอย่างในหมวดนี้"}
                </div>
              )}

              {!isLoadingCharacters && !fetchError && filteredCharacters.map((character) => {
                const imageUrl = getImageSource(character);
                const selectedKey = activeCategory === "clothes"
                  ? getClothingBodyShape(character)
                  : activeCategory;
                const displayCategoryName = activeCategory === "clothes"
                  ? `${clothingTypes.find(({ id }) => id === getClothingType(character))?.name || "เสื้อผ้า"} (${clothingBodyShapes.find(({ id }) => id === selectedKey)?.name || "ทั้งหมด"})`
                  : categories.find((cat) => cat.id === activeCategory)?.name || "base";
                const itemId = character.id || `${imageUrl}-${selectedKey}`;
                const isUnsupported = activeCategory !== "base" &&
                  !isItemAllowedForBase(character, getCurrentBaseType());
                return (
                  <div
                    key={itemId}
                    className="rounded-3xl border border-gray-100 bg-white shadow-sm overflow-hidden"
                    onPointerEnter={() => {
                      if (isUnsupported) setUnavailableItemId(itemId);
                    }}
                    onPointerLeave={() => {
                      setUnavailableItemId((current) => current === itemId ? null : current);
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectAsset(selectedKey, imageUrl, character.name, "", character)}
                      aria-disabled={isUnsupported}
                      title={isUnsupported ? "ไม่สามารถสวมชุดนี้กับเบสตัวละครนี้ได้" : undefined}
                      className={`group h-full w-full text-left ${
                        isUnsupported ? "cursor-not-allowed" : "cursor-pointer"
                      }`}
                    >
                      <div className="aspect-square bg-gray-100 overflow-hidden flex items-center justify-center">
                        <img
                          src={imageUrl}
                          alt={character.name}
                          className={`h-full w-full object-contain transition-transform duration-200 ${
                            isUnsupported ? "opacity-40" : "group-hover:scale-105"
                          }`}
                        />
                      </div>
                      <div className="p-3">
                        <p className={`text-[11px] ${isUnsupported ? "text-red-600" : "text-gray-500"}`}>
                          {isUnsupported ? "ไม่สามารถเลือกกับเบสนี้ได้" : `กดเพื่อเลือกในหมวด ${displayCategoryName}`}
                        </p>
                        {unavailableItemId === itemId && isUnsupported && (
                          <p role="status" aria-live="polite" className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-700">
                            ไม่สามารถสวมชุดนี้กับเบสตัวละครนี้ได้
                          </p>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* แสดงปุ่มลบพื้นหลังเมื่อผู้ใช้เปิดหมวดพื้นหลัง */}
          {activeCategory === "background" && (
            <div>

              {/* ปุ่มลบพื้นหลังฝั่งซ้าย */}
              <button 
                onClick={() => handleRemoveLayer("background")}
                className="mt-4 text-xs text-black bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-lg font-bold hover:bg-gray-200 transition-colors cursor-pointer"
              >
                ลบพื้นหลัง
              </button>
            </div>
          )}
        </div>
        </div>

        {/* พื้นที่ตรงกลาง: แสดงภาพตัวละครโดยซ้อนพื้นหลังและชิ้นส่วนตามลำดับเลเยอร์ */}
        <div className="xl:col-span-1 flex flex-col items-center justify-center min-h-[520px] p-2 md:p-4">
          <div className="bg-white p-4 md:p-5 rounded-3xl shadow-md w-full max-w-[560px] aspect-square flex flex-col overflow-hidden relative border border-gray-50">
            <div className="w-full h-full rounded-2xl bg-gray-100 overflow-hidden relative flex items-center justify-center">
                {/* พื้นหลังอยู่ชั้นล่างสุด */}
                {equippedLayers.background && (
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-all duration-300"
                    style={{ backgroundImage: `url('${equippedLayers.background}')`, zIndex: 0 }}
                  ></div>
                )}

                {/* ข้อความแนะนำเมื่อยังไม่ได้เลือกไอเท็มใดเลย */}
                {!equippedLayers.background && !equippedLayers.base && !equippedLayers.face && !equippedLayers.hair && !equippedLayers.accessory && !equippedLayers.maleclothes && !equippedLayers.femaleclothes && !equippedLayers.chubbyclothes && !equippedLayers.tallclothes && !equippedLayers.shortclothes && (
                  <p className="text-gray-400 font-medium">กรุณาเลือกไอเท็มเพื่อออกแบบตัวละคร</p>
                )}

                {/* โครงร่างตัวละครอยู่เหนือพื้นหลัง */}
                {equippedLayers.base && (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 10 }}>
                    <img src={equippedLayers.base} alt="Character Base" className="max-w-full max-h-full object-contain" />
                  </div>
                )}

                {/* วาดเสื้อผ้าทุกประเภทย่อยที่เลือกไว้เหนือโครงร่าง */}
                {[
                  "maleclothes",
                  "femaleclothes",
                  "chubbyclothes",
                  "tallclothes",
                  "shortclothes",
                ].map((key) => (
                  equippedLayers[key] ? (
                    <div key={key} className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 20 }}>
                      <img src={equippedLayers[key]} alt={key} className="max-w-full max-h-full object-contain" />
                    </div>
                  ) : null
                ))}

                {/* ใบหน้าอยู่เหนือเสื้อผ้า */}
                {equippedLayers.face && (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 30 }}>
                    <img src={equippedLayers.face} alt="Face" className="max-w-full max-h-full object-contain" />
                  </div>
                )}

                {/* ผมอยู่เหนือใบหน้า */}
                {equippedLayers.hair && (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 40 }}>
                    <img src={equippedLayers.hair} alt="Hair" className="max-w-full max-h-full object-contain" />
                  </div>
                )}

                {/* เครื่องประดับอยู่ชั้นหน้าสุด */}
                {equippedLayers.accessory && (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 50 }}>
                    <img src={equippedLayers.accessory} alt="Accessory" className="max-w-full max-h-full object-contain" />
                  </div>
                )}

            </div>
          </div>
        </div>

        {/* แผงขวา: สรุปไอเท็มที่เลือก ลบทีละชิ้น ล้างทั้งหมด หรือบันทึกตัวละคร */}
        <div className="xl:col-span-1 bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100 min-h-[520px] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm text-gray-800">ไอเท็มที่เลือกไว้</h3>
                <p className="text-xs text-gray-400">รายการเรียงจากพื้นฐานก่อน</p>
              </div>
              <span className="rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-semibold text-[#9333ea]">
                {selectedItems.length} ชิ้น
              </span>
            </div>

            <div className="space-y-2 max-h-[320px] overflow-auto pr-1">
              {selectedItems.map((item) => (
                <div key={item.id} className="bg-gradient-to-r from-gray-50 to-white border border-gray-100 rounded-xl px-3 py-3 flex items-center justify-between shadow-sm">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-lg">
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
                      <p className="text-[11px] text-gray-400 truncate">{item.hint}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleRemoveLayer(item.id)}
                    className="ml-2 text-red-500 font-bold hover:text-red-700 text-sm p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {selectedItems.length === 0 && (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
                  <p className="text-sm text-gray-400">ยังไม่มีไอเท็มที่เลือก</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2 pt-4">
            <button onClick={handleClearAll} className="w-full bg-white text-red-500 hover:bg-red-50 py-2.5 rounded-xl font-bold text-sm border border-red-100 transition-all text-center cursor-pointer">ลบทั้งหมด</button>
            <button onClick={handleSaveCharacter} disabled={isSaving} className="w-full bg-gradient-to-r from-[#a855f7] to-[#9333ea] hover:opacity-90 disabled:opacity-60 text-white py-3 rounded-xl font-bold text-sm transition-all shadow-md text-center cursor-pointer disabled:cursor-wait">
              {isSaving ? "กำลังบันทึก..." : "เสร็จสิ้น"}
            </button>
            {saveMessage && <p className="text-center text-xs text-gray-500">{saveMessage}</p>}
          </div>
        </div>

      </main>
    </div>
  );
}

export default DressUpPage;