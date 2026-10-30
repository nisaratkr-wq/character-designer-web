// โหลดไลบรารีสำหรับสร้าง API, จัดการ path, เปิด CORS และเชื่อมต่อ MySQL
const express = require("express");
const path = require("path");
const cors = require("cors");
const mysql = require("mysql2/promise");

// สร้างแอป Express และอ่านค่าการตั้งค่าจาก environment variable
const app = express();
const port = Number(process.env.PORT || 5000);
const apiBaseUrl = process.env.API_BASE_URL || `http://localhost:${port}`;

// อนุญาตให้หน้าเว็บจาก origin อื่นเรียก API และแปลง request body แบบ JSON
app.use(cors());
app.use(express.json({ limit: "25mb" }));

// เปิดให้เข้าถึงไฟล์สาธารณะและไฟล์อัปโหลดผ่าน URL
app.use(express.static(path.join(__dirname, "../client/public")));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ค่าที่ใช้เชื่อมต่อ MySQL โดยสามารถแทนที่ค่าเริ่มต้นผ่าน environment variable
const databaseName = process.env.MYSQL_DATABASE || "dressup_db";
const mysqlConfig = {
  host: process.env.MYSQL_HOST || "localhost",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
};

// กำหนด pool ของฐานข้อมูลเมื่อเริ่มเซิร์ฟเวอร์
let db;

// ส่งรายการตัวละคร หรือ 4 ตัวละครยอดนิยมเมื่อระบุ ?view=popular
app.get(["/characters", "/api/characters"], async (req, res) => {
  try {
    if (req.query.view === "popular") {
      // นับจำนวนหัวใจของแต่ละโพสต์ แล้วเรียงตามยอดหัวใจและวันที่สร้าง
      const [rows] = await db.execute(`
        SELECT image_record.image_id, image_record.title, image_record.saved_character_id,
          image_record.image_url, image_record.created_at,
          COALESCE(design_hearts.heart_count, 0) AS likes,
          saved_characters.character_name, saved_characters.post_display_name
        FROM image_record
        INNER JOIN saved_characters ON saved_characters.id = image_record.saved_character_id
        LEFT JOIN (
          SELECT image_id, COUNT(*) AS heart_count
          FROM popular_character_hearts
          GROUP BY image_id
        ) AS design_hearts ON design_hearts.image_id = image_record.image_id
        ORDER BY likes DESC, image_record.created_at DESC
        LIMIT 4
      `);
      return res.json(rows.map((character) => ({
        id: character.image_id,
        image_url: toImageUrl(character.image_url),
        created_at: character.created_at,
        likes: character.likes,
        name: character.character_name || character.title,
        displayName: character.post_display_name,
      })));
    }

    // ดึงชิ้นส่วนตัวละคร พร้อมตรวจว่ารูปเก็บเป็นข้อมูลในฐานข้อมูลหรือเป็น path
    const [rows] = await db.execute(`
      SELECT id, user_id, character_name, image_path, category,
        created_at, updated_at, description,
        image_data IS NOT NULL AS has_image_data
      FROM characters
      ORDER BY id ASC
    `);
    const characters = rows.map((character) => ({
      ...character,
      name: character.name || character.character_name,
      image_url: character.has_image_data
        ? `${apiBaseUrl}/api/characters/${character.id}/image`
        : toImageUrl(character.image_path),
    }));
    const [items] = await db.execute(`
      SELECT id, item_name, image_path, category, created_at, updated_at, description
      FROM items
      WHERE LOWER(TRIM(category)) IN ('shoesmale', 'shoesfemale')
      ORDER BY id ASC
    `);
    const shoes = items.map((item) => ({
      ...item,
      id: `item-${item.id}`,
      name: item.item_name,
      image_url: toImageUrl(item.image_path),
    }));
    return res.json([...characters, ...shoes]);
  } catch (error) {
    console.error("Error loading characters:", error.message);
    return res.status(500).json({ error: "Could not load characters" });
  }
});

// เติม base URL ให้ path รูปที่เป็น path ภายในเว็บ แต่คง URL แบบเต็มไว้ตามเดิม
function toImageUrl(imagePath) {
  if (!imagePath || !imagePath.startsWith("/")) return imagePath;
  return `${apiBaseUrl}${imagePath}`;
}

// ส่งข้อมูลรูปของตัวละครที่เก็บเป็น binary ในฐานข้อมูล
app.get("/api/characters/:id/image", async (req, res) => {
  try {
    const [rows] = await db.execute(
      "SELECT image_data, image_type FROM characters WHERE id = ?",
      [Number(req.params.id)]
    );

    if (!rows.length || !rows[0].image_data) {
      return res.status(404).send("Image not found in database");
    }

    res.type(rows[0].image_type || "image/png");
    return res.send(rows[0].image_data);
  } catch (error) {
    console.error("Error loading character image:", error.message);
    return res.status(500).send("Could not load character image");
  }
});

// บันทึกรูปแบบ Base64 ลงในฐานข้อมูลและคืน URL สำหรับเรียกรูปภายหลัง
app.post("/api/characters/:id/image", async (req, res) => {
  const { image_data: imageData, image_type: imageType } = req.body;
  if (typeof imageData !== "string" || !imageData.trim()) {
    return res.status(400).json({ error: "image_data is required" });
  }

  // ตัดส่วนหัว data URL ออกก่อนแปลง Base64 เป็น binary
  const base64Data = imageData.replace(/^data:[^;]+;base64,/, "");
  try {
    const [result] = await db.execute(
      "UPDATE characters SET image_data = ?, image_type = ? WHERE id = ?",
      [Buffer.from(base64Data, "base64"), imageType || "image/png", Number(req.params.id)]
    );
    if (!result.affectedRows) return res.status(404).json({ error: "Character not found" });
    return res.json({ image_url: `${apiBaseUrl}/api/characters/${req.params.id}/image` });
  } catch (error) {
    console.error("Error saving character image:", error.message);
    return res.status(500).json({ error: "Could not save character image" });
  }
});

// สร้างตัวละครที่ผู้ใช้บันทึกไว้ โดยเก็บชั้นภาพและ assets เป็น JSON
app.post("/api/saved-characters", async (req, res) => {
  const { user_id, characterName, layers, assets, preview_image_url: previewImageUrl } = req.body;

  if (!user_id || !layers || typeof layers !== "object") {
    return res.status(400).json({ error: "user_id and layers are required" });
  }

  try {
    const [result] = await db.execute(
      "INSERT INTO saved_characters (user_id, character_name, layers, assets, preview_image_url, posted) VALUES (?, ?, ?, ?, ?, ?)",
      [user_id, characterName || "ตัวละครใหม่", JSON.stringify(layers), JSON.stringify(assets || {}), previewImageUrl || null, false]
    );
    const [rows] = await db.execute("SELECT * FROM saved_characters WHERE id = ?", [result.insertId]);
    return res.status(201).json(formatCharacter(rows[0]));
  } catch (error) {
    console.error("Error saving character:", error.message);
    return res.status(500).json({ error: "Could not save character" });
  }
});

// แก้ไขชื่อ ชั้นภาพ หรือภาพตัวอย่างของตัวละครที่เป็นของผู้ใช้
app.put("/api/saved-characters/:id", async (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const characterId = Number(req.params.id);
  const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
  // ตรวจว่าฟิลด์ใดถูกส่งมาจริง เพื่อให้อัปเดตเฉพาะฟิลด์นั้น
  const hasCharacterName = Object.prototype.hasOwnProperty.call(body, "character_name");
  const hasLayers = Object.prototype.hasOwnProperty.call(body, "layers");
  const hasPreviewImageUrl = Object.prototype.hasOwnProperty.call(body, "preview_image_url");

  if (!Number.isInteger(characterId) || characterId <= 0) {
    return res.status(400).json({ error: "Invalid saved character id" });
  }
  if (!userId) {
    return res.status(400).json({ error: "user_id is required" });
  }
  if (!hasCharacterName && !hasLayers && !hasPreviewImageUrl) {
    return res.status(400).json({ error: "At least one character field is required" });
  }

  // สร้างคำสั่ง UPDATE และค่าที่ผูกกับ placeholder ตามฟิลด์ที่ผ่านการตรวจสอบ
  const updates = [];
  const values = [];
  if (hasCharacterName) {
    if (typeof body.character_name !== "string" || !body.character_name.trim()) {
      return res.status(400).json({ error: "character_name must be a non-empty string" });
    }
    updates.push("character_name = ?");
    values.push(body.character_name.trim());
  }
  if (hasLayers) {
    if (!body.layers || typeof body.layers !== "object" || Array.isArray(body.layers)) {
      return res.status(400).json({ error: "layers must be a valid JSON object" });
    }
    updates.push("layers = ?");
    values.push(JSON.stringify(body.layers));
  }
  if (hasPreviewImageUrl) {
    if (typeof body.preview_image_url !== "string") {
      return res.status(400).json({ error: "preview_image_url must be a string" });
    }
    updates.push("preview_image_url = ?");
    values.push(body.preview_image_url);
  }

  try {
    // ยืนยันว่าตัวละครมีอยู่และเป็นของผู้ใช้ที่ระบุก่อนแก้ไข
    const [existingRows] = await db.execute(
      "SELECT id FROM saved_characters WHERE id = ? AND user_id = ?",
      [characterId, userId]
    );
    if (!existingRows.length) {
      return res.status(404).json({ error: "Saved character not found for this user" });
    }

    await db.execute(
      `UPDATE saved_characters SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`,
      [...values, characterId, userId]
    );
    const [rows] = await db.execute("SELECT * FROM saved_characters WHERE id = ?", [characterId]);
    return res.json(formatCharacter(rows[0]));
  } catch (error) {
    console.error("Error updating saved character:", error.message);
    return res.status(500).json({ error: "Could not update saved character" });
  }
});

// เปลี่ยนชื่อตัวละครที่บันทึกไว้ 
app.patch("/api/saved-characters/:id", async (req, res) => {
  const characterId = Number(req.params.id);
  const userId = typeof req.body.user_id === "string" ? req.body.user_id.trim() : "";
  const characterName = typeof req.body.characterName === "string" ? req.body.characterName.trim() : "";

  if (!Number.isInteger(characterId) || characterId <= 0) {
    return res.status(400).json({ error: "Invalid saved character id" });
  }
  if (!userId || !characterName) {
    return res.status(400).json({ error: "characterName is required" });
  }

  const [existingRows] = await db.execute(
    "SELECT id FROM saved_characters WHERE id = ? AND user_id = ?",
    [characterId, userId]
  );
  if (!existingRows.length) return res.status(404).json({ error: "Saved character not found for this user" });

  await db.execute(
    "UPDATE saved_characters SET character_name = ? WHERE id = ? AND user_id = ?",
    [characterName, characterId, userId]
  );

  const [rows] = await db.execute("SELECT * FROM saved_characters WHERE id = ?", [characterId]);
  return res.json(formatCharacter(rows[0]));
});

// เผยแพร่ตัวละครเป็นโพสต์ โดยใช้ transaction ป้องกันข้อมูลโพสต์ซ้ำหรืออัปเดตไม่ครบ
app.post("/api/saved-characters/:id/post", async (req, res) => {
  const characterId = Number(req.params.id);
  const userId = typeof req.body.user_id === "string" ? req.body.user_id.trim() : "";
  const displayName = typeof req.body.display_name === "string" ? req.body.display_name.trim() : "";
  if (!Number.isInteger(characterId) || characterId <= 0 || !userId) {
    return res.status(400).json({ error: "A valid saved character id and user_id are required" });
  }
  if (!displayName) {
    return res.status(400).json({ error: "display_name is required" });
  }

  const connection = await db.getConnection();
  try {
    // ล็อกแถวตัวละครระหว่างทำรายการ เพื่อป้องกันการเผยแพร่ซ้ำพร้อมกัน
    await connection.beginTransaction();
    const [characters] = await connection.execute(
      "SELECT * FROM saved_characters WHERE id = ? AND user_id = ? FOR UPDATE",
      [characterId, userId]
    );
    if (!characters.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Saved character not found for this user" });
    }

    const character = characters[0];
    if (!character.preview_image_url) {
      await connection.rollback();
      return res.status(422).json({ error: "Saved character has no image to post" });
    }

    // ตรวจว่ามีโพสต์ของตัวละครนี้อยู่แล้วหรือไม่ ก่อนสร้าง image_record ใหม่
    const [existingRecords] = await connection.execute(
      "SELECT image_id FROM image_record WHERE saved_character_id = ? LIMIT 1",
      [characterId]
    );
    const alreadyPosted = existingRecords.length > 0;
    if (!alreadyPosted) {
      await connection.execute(
        "INSERT INTO image_record (title, saved_character_id, user_id, image_url, created_at, likes) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 0)",
        [character.character_name || "ตัวละครใหม่", characterId, userId, character.preview_image_url]
      );
    }

    await connection.execute(
      "UPDATE saved_characters SET posted = TRUE, posted_at = COALESCE(posted_at, CURRENT_TIMESTAMP), post_display_name = ? WHERE id = ? AND user_id = ?",
      [displayName, characterId, userId]
    );
    const [updatedCharacters] = await connection.execute(
      "SELECT * FROM saved_characters WHERE id = ?",
      [characterId]
    );
    const [imageRecords] = await connection.execute(
      "SELECT image_id, title, saved_character_id, user_id, image_url, created_at, likes FROM image_record WHERE saved_character_id = ?",
      [characterId]
    );
    await connection.commit();
    return res.status(alreadyPosted ? 200 : 201).json({
      ...formatCharacter(updatedCharacters[0]),
      imageRecord: imageRecords[0],
      alreadyPosted,
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error posting saved character:", error.message);
    return res.status(500).json({ error: "Could not post saved character" });
  } finally {
    // คืน connection กลับเข้า pool ไม่ว่ารายการจะสำเร็จหรือเกิดข้อผิดพลาด
    connection.release();
  }
});

// ลบตัวละครของผู้ใช้ตาม id; คืน 404 หากไม่พบแถวที่ตรงกัน
app.delete("/api/saved-characters/:id", async (req, res) => {
  const [result] = await db.execute(
    "DELETE FROM saved_characters WHERE id = ? AND user_id = ?",
    [Number(req.params.id), req.query.user_id]
  );
  if (!result.affectedRows) return res.status(404).json({ error: "Saved character not found" });

  return res.status(204).send();
});

// ดึงตัวละครที่ผู้ใช้บันทึกไว้ทั้งหมด เรียงจากรายการใหม่ไปเก่า
app.get("/api/saved-characters", async (req, res) => {
  const [rows] = await db.execute(
    `SELECT saved_characters.*,
      EXISTS (
        SELECT 1 FROM image_record
        WHERE image_record.saved_character_id = saved_characters.id
      ) AS posted
    FROM saved_characters
    WHERE user_id = ?
    ORDER BY created_at DESC`,
    [req.query.user_id]
  );
  return res.json(rows.map(formatCharacter));
});

// ดึงรายละเอียดตัวละครที่บันทึกไว้หนึ่งรายการ โดยตรวจทั้ง id และเจ้าของ
app.get("/api/saved-characters/:id", async (req, res) => {
  const characterId = Number(req.params.id);
  const userId = typeof req.query.user_id === "string" ? req.query.user_id.trim() : "";

  if (!Number.isInteger(characterId) || characterId <= 0) {
    return res.status(400).json({ error: "Invalid saved character id" });
  }
  if (!userId) {
    return res.status(400).json({ error: "user_id is required" });
  }

  const [rows] = await db.execute(
    "SELECT * FROM saved_characters WHERE id = ? AND user_id = ?",
    [characterId, userId]
  );
  if (!rows.length) return res.status(404).json({ error: "Saved character not found for this user" });

  return res.json(formatCharacter(rows[0]));
});

// ดึงโพสต์ตัวละครทั้งหมดที่เผยแพร่ เพื่อแสดงในหน้ารายการยอดนิยม
app.get("/api/popular-characters", async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT image_record.image_id, image_record.title, image_record.saved_character_id,
        image_record.image_url, image_record.created_at, image_record.likes,
        saved_characters.character_name, saved_characters.post_display_name
    FROM image_record
    INNER JOIN saved_characters ON saved_characters.id = image_record.saved_character_id
    ORDER BY image_record.created_at DESC`
    );
    return res.json(rows.map((character) => ({
      id: character.image_id,
      saved_character_id: character.saved_character_id,
      image_url: toImageUrl(character.image_url),
      created_at: character.created_at,
      likes: character.likes,
      name: character.character_name || character.title,
      displayName: character.post_display_name || "สมาชิก",
    })));
  } catch (error) {
    console.error("Error loading popular characters:", error.message);
    return res.status(500).json({ error: "Could not load popular characters" });
  }
});

// ตรวจว่าผู้ใช้กดหัวใจให้โพสต์ตัวละครที่ระบุไว้แล้วหรือไม่
app.get("/api/design-hearts", async (req, res) => {
  const userId = typeof req.query.user_id === "string" ? req.query.user_id.trim() : "";
  const characterId = Number(req.query.character_id);
  if (!userId || !Number.isInteger(characterId) || characterId <= 0) {
    return res.status(400).json({ error: "A valid user_id and character_id are required" });
  }

  try {
    const [rows] = await db.execute(
      `SELECT popular_character_hearts.image_id
      FROM popular_character_hearts
      INNER JOIN image_record ON image_record.image_id = popular_character_hearts.image_id
      WHERE popular_character_hearts.user_id = ?
        AND (image_record.saved_character_id = ? OR (image_record.saved_character_id IS NULL AND image_record.image_id = ?))
      LIMIT 1`,
      [userId, characterId, characterId]
    );
    return res.json({ liked: rows.length > 0 });
  } catch (error) {
    console.error("Error checking design heart:", error.message);
    return res.status(500).json({ error: "Could not check design heart" });
  }
});

// เพิ่มหัวใจให้โพสต์ โดยป้องกันการนับซ้ำของผู้ใช้คนเดิม
app.post("/api/design-hearts", async (req, res) => {
  const userId = typeof req.body.user_id === "string" ? req.body.user_id.trim() : "";
  const characterId = Number(req.body.character_id);
  if (!userId || !Number.isInteger(characterId) || characterId <= 0) {
    return res.status(400).json({ error: "A valid user_id and character_id are required" });
  }

  const connection = await db.getConnection();
  try {
    // ใช้ transaction และล็อกโพสต์ระหว่างตรวจสอบ/เพิ่มหัวใจ
    await connection.beginTransaction();
    const [records] = await connection.execute(
      `SELECT image_id FROM image_record
      WHERE saved_character_id = ? OR (saved_character_id IS NULL AND image_id = ?)
      LIMIT 1 FOR UPDATE`,
      [characterId, characterId]
    );
    if (!records.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Posted character not found" });
    }

    const [result] = await connection.execute(
      // INSERT IGNORE อาศัย unique key เพื่อไม่ให้ผู้ใช้กดหัวใจซ้ำในฐานข้อมูล
      "INSERT IGNORE INTO popular_character_hearts (user_id, image_id) VALUES (?, ?)",
      [userId, records[0].image_id]
    );
    if (result.affectedRows) {
      await connection.execute(
        "UPDATE image_record SET likes = likes + 1 WHERE image_id = ?",
        [records[0].image_id]
      );
    }
    await connection.commit();
    return res.status(result.affectedRows ? 201 : 200).json({ liked: true });
  } catch (error) {
    await connection.rollback();
    console.error("Error creating design heart:", error.message);
    return res.status(500).json({ error: "Could not create design heart" });
  } finally {
    connection.release();
  }
});

// ถอนหัวใจจากโพสต์ และลดจำนวน likes เฉพาะเมื่อมีหัวใจให้ลบจริง
app.delete("/api/design-hearts", async (req, res) => {
  const userId = typeof req.query.user_id === "string" ? req.query.user_id.trim() : "";
  const characterId = Number(req.query.character_id);
  if (!userId || !Number.isInteger(characterId) || characterId <= 0) {
    return res.status(400).json({ error: "A valid user_id and character_id are required" });
  }

  const connection = await db.getConnection();
  try {
    // ล็อกโพสต์และลบหัวใจภายใน transaction เพื่อให้จำนวน likes สอดคล้องกัน
    await connection.beginTransaction();
    const [records] = await connection.execute(
      `SELECT image_id FROM image_record
      WHERE saved_character_id = ? OR (saved_character_id IS NULL AND image_id = ?)
      LIMIT 1 FOR UPDATE`,
      [characterId, characterId]
    );
    if (!records.length) {
      await connection.rollback();
      return res.status(404).json({ error: "Posted character not found" });
    }

    const imageId = records[0].image_id;
    const [result] = await connection.execute(
      "DELETE FROM popular_character_hearts WHERE user_id = ? AND image_id = ?",
      [userId, imageId]
    );
    if (result.affectedRows) {
      await connection.execute(
        "UPDATE image_record SET likes = GREATEST(likes - 1, 0) WHERE image_id = ?",
        [imageId]
      );
    }
    await connection.commit();
    return res.json({ liked: false });
  } catch (error) {
    await connection.rollback();
    console.error("Error deleting design heart:", error.message);
    return res.status(500).json({ error: "Could not delete design heart" });
  } finally {
    connection.release();
  }
});

// จัดรูปแบบข้อมูลจากฐานข้อมูลให้เป็นรูปแบบเดียวกับที่ API ส่งให้หน้าเว็บ
function formatCharacter(character) {
  return {
    id: character.id,
    user_id: character.user_id,
    characterName: character.character_name,
    layers: typeof character.layers === "string" ? JSON.parse(character.layers) : character.layers,
    assets: typeof character.assets === "string" ? JSON.parse(character.assets) : (character.assets || {}),
    preview_image_url: character.preview_image_url || "",
    posted: Boolean(character.posted),
    createdAt: character.created_at,
    postedAt: character.posted_at,
    postDisplayName: character.post_display_name || "",
  };
}

// เตรียมฐานข้อมูลและตารางที่จำเป็น จากนั้นเริ่มรับคำขอ HTTP
async function startServer() {
  // สร้างฐานข้อมูลหากยังไม่มี แล้วสร้าง connection pool สำหรับใช้งานจริง
  const adminDb = await mysql.createConnection(mysqlConfig);
  await adminDb.execute(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\``);
  await adminDb.end();

  db = mysql.createPool({ ...mysqlConfig, database: databaseName, connectionLimit: 10 });

  // เพิ่มคอลัมน์เก็บรูปในตาราง characters เฉพาะกรณีฐานข้อมูลเดิมยังไม่มี
  const [imageColumns] = await db.execute(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'characters' AND COLUMN_NAME IN ('image_data', 'image_type')",
    [databaseName]
  );
  const existingImageColumns = new Set(imageColumns.map((column) => column.COLUMN_NAME));
  if (!existingImageColumns.has("image_data")) {
    await db.execute("ALTER TABLE characters ADD COLUMN image_data LONGBLOB NULL");
  }
  if (!existingImageColumns.has("image_type")) {
    await db.execute("ALTER TABLE characters ADD COLUMN image_type VARCHAR(100) NULL");
  }

  // สร้างตารางตัวละครที่ผู้ใช้บันทึกไว้ หากยังไม่มี
  await db.execute(`
    CREATE TABLE IF NOT EXISTS saved_characters (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      character_name VARCHAR(255) NOT NULL,
      layers JSON NOT NULL,
      posted BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      posted_at TIMESTAMP NULL DEFAULT NULL
    )
  `);
  const [savedCharacterColumns] = await db.execute(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'saved_characters' AND COLUMN_NAME IN ('posted', 'posted_at', 'assets', 'preview_image_url', 'post_display_name')",
    [databaseName]
  );
  const existingSavedCharacterColumns = new Set(savedCharacterColumns.map((column) => column.COLUMN_NAME));
  // ปรับโครงสร้างตารางเดิมให้รองรับสถานะโพสต์, assets, รูปตัวอย่าง และชื่อที่ใช้แสดง
  if (!existingSavedCharacterColumns.has("posted")) {
    await db.execute("ALTER TABLE saved_characters ADD COLUMN posted BOOLEAN NOT NULL DEFAULT FALSE");
  }
  if (!existingSavedCharacterColumns.has("posted_at")) {
    await db.execute("ALTER TABLE saved_characters ADD COLUMN posted_at TIMESTAMP NULL DEFAULT NULL");
  }
  if (!existingSavedCharacterColumns.has("assets")) {
    await db.execute("ALTER TABLE saved_characters ADD COLUMN assets JSON NULL");
  }
  if (!existingSavedCharacterColumns.has("preview_image_url")) {
    await db.execute("ALTER TABLE saved_characters ADD COLUMN preview_image_url MEDIUMTEXT NULL");
  }
  if (!existingSavedCharacterColumns.has("post_display_name")) {
    await db.execute("ALTER TABLE saved_characters ADD COLUMN post_display_name VARCHAR(255) NULL");
  }
  await db.execute("ALTER TABLE saved_characters MODIFY COLUMN preview_image_url LONGTEXT NULL");

  // สร้างตารางโพสต์ที่เผยแพร่ โดยเชื่อมกลับไปยังตัวละครที่บันทึกไว้
  await db.execute(`
    CREATE TABLE IF NOT EXISTS image_record (
      image_id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      image_url LONGTEXT NOT NULL,
      description TEXT NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      saved_character_id INT NULL,
      user_id VARCHAR(255) NULL,
      likes INT NOT NULL DEFAULT 0,
      UNIQUE KEY unique_image_record_saved_character (saved_character_id),
      CONSTRAINT fk_image_record_saved_character
        FOREIGN KEY (saved_character_id) REFERENCES saved_characters(id) ON DELETE CASCADE
    )
  `);
  const [imageRecordColumns] = await db.execute(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'image_record'",
    [databaseName]
  );
  const existingImageRecordColumns = new Set(imageRecordColumns.map((column) => column.COLUMN_NAME));
  // เพิ่มหรือปรับชนิดคอลัมน์ให้เข้ากับโครงสร้างที่ API ใช้งาน
  if (!existingImageRecordColumns.has("title")) {
    await db.execute("ALTER TABLE image_record ADD COLUMN title VARCHAR(255) NOT NULL DEFAULT 'Character'");
  } else {
    await db.execute("ALTER TABLE image_record MODIFY COLUMN title VARCHAR(255) NOT NULL");
  }
  if (!existingImageRecordColumns.has("image_url")) {
    await db.execute("ALTER TABLE image_record ADD COLUMN image_url LONGTEXT NOT NULL");
  } else {
    await db.execute("ALTER TABLE image_record MODIFY COLUMN image_url LONGTEXT NOT NULL");
  }
  if (!existingImageRecordColumns.has("saved_character_id")) {
    await db.execute("ALTER TABLE image_record ADD COLUMN saved_character_id INT NULL");
  }
  if (!existingImageRecordColumns.has("user_id")) {
    await db.execute("ALTER TABLE image_record ADD COLUMN user_id VARCHAR(255) NULL");
  }
  if (!existingImageRecordColumns.has("likes")) {
    await db.execute("ALTER TABLE image_record ADD COLUMN likes INT NOT NULL DEFAULT 0");
  }
  const [imageRecordIndexes] = await db.execute(
    "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'image_record' AND INDEX_NAME = 'unique_image_record_saved_character'",
    [databaseName]
  );
  if (!imageRecordIndexes.length) {
    await db.execute("ALTER TABLE image_record ADD UNIQUE KEY unique_image_record_saved_character (saved_character_id)");
  }

  // ตรวจและเพิ่ม foreign key เพื่อให้การลบตัวละครลบโพสต์ที่เกี่ยวข้องตามไปด้วย
  const [imageRecordRelations] = await db.execute(
    "SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'image_record' AND COLUMN_NAME = 'saved_character_id' AND REFERENCED_TABLE_NAME = 'saved_characters'",
    [databaseName]
  );
  if (!imageRecordRelations.length) {
    await db.execute(`
      ALTER TABLE image_record
      ADD CONSTRAINT fk_image_record_saved_character
      FOREIGN KEY (saved_character_id) REFERENCES saved_characters(id) ON DELETE CASCADE
    `);
  }

  // ย้ายข้อมูลตัวละครเดิมที่ถูกเผยแพร่แล้วให้มีรายการใน image_record
  await db.execute(`
    INSERT IGNORE INTO image_record (title, saved_character_id, user_id, image_url, created_at, likes)
    SELECT COALESCE(character_name, 'ตัวละครใหม่'), id, user_id, preview_image_url, COALESCE(posted_at, created_at), 0
    FROM saved_characters
    WHERE posted = TRUE AND preview_image_url IS NOT NULL AND preview_image_url <> ''
  `);

  // สร้างตารางหัวใจ พร้อม unique key ป้องกันผู้ใช้กดหัวใจโพสต์เดียวกันซ้ำ
  await db.execute(`
    CREATE TABLE IF NOT EXISTS popular_character_hearts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      image_id INT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_design_heart_user_image (user_id, image_id),
      CONSTRAINT fk_popular_character_heart_image_record
        FOREIGN KEY (image_id) REFERENCES image_record(image_id) ON DELETE CASCADE
    )
  `);

  // เริ่มเปิด HTTP server หลังจากเตรียมฐานข้อมูลเสร็จแล้ว
  app.listen(port, () => {
    console.log(`Server running on ${apiBaseUrl} using MySQL database ${databaseName}`);
  });
}

// หากการเชื่อมต่อหรือเตรียมฐานข้อมูลล้มเหลว ให้แสดงข้อผิดพลาดและหยุดโปรเซส
startServer().catch((error) => {
  console.error("Could not start server with MySQL:", error.message);
  process.exit(1);
});