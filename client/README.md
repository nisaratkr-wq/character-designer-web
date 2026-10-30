# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

# Student Task Tracker

โปรเจกต์นี้เป็นตัวอย่างงาน `React + Firebase` สำหรับคนเริ่มต้น ใช้ทำเว็บจัดการรายการงานแบบง่าย และเก็บข้อมูลไว้ใน Firebase

เอกสารนี้เขียนสำหรับคนที่ยังไม่ค่อยถนัดเขียนโปรแกรม โดยจะอธิบายตั้งแต่โปรเจกต์นี้คืออะไร ต้องเตรียมอะไรบ้าง สร้าง Firebase ยังไง และเปิดโปรเจกต์บนเครื่องยังไง

## โปรเจกต์นี้ทำอะไรได้

เมื่อเปิดเว็บนี้ คุณจะสามารถ:

- เพิ่ม task ใหม่จากฟอร์ม
- ดูรายการ task ทั้งหมดบนหน้าเว็บ
- กดเปลี่ยนสถานะ task ว่าทำเสร็จแล้วหรือยัง
- เก็บข้อมูล task ลง `Firestore Database`

## เทคโนโลยีที่ใช้

- `React` ใช้สร้างหน้าเว็บ
- `Vite` ใช้สำหรับรันโปรเจกต์ระหว่างพัฒนา
- `Firebase` ใช้เป็น backend
- `Authentication` ใช้ทำระบบล็อกอิน
- `Firestore Database` ใช้เก็บข้อมูล task

## ก่อนเริ่ม ต้องมีอะไรบ้าง

สิ่งที่ควรมีในเครื่อง:

- `Node.js`
- `npm`
- บัญชี Google สำหรับเข้าใช้ Firebase

ถ้าในเครื่องมี Node.js แล้ว สามารถเช็กได้ด้วยคำสั่ง:

```bash
node -v
npm -v
```

## ภาพรวมการทำงานของโปรเจกต์

ลำดับการทำงานของโปรเจกต์นี้แบบง่าย ๆ คือ:

1. ผู้ใช้กรอกข้อมูล task บนหน้าเว็บ
2. React รับค่าจากฟอร์ม
3. React ส่งข้อมูลไปที่ Firebase
4. Firestore บันทึกข้อมูล
5. หน้าเว็บดึงข้อมูลกลับมาแสดง

## ขั้นตอนที่ 1: สร้าง Firebase Project

1. เข้าเว็บไซต์ [Firebase Console](https://console.firebase.google.com/)
2. กด `Create a project`
3. ตั้งชื่อโปรเจกต์
4. กดสร้างโปรเจกต์ให้เสร็จ
5. เมื่อเข้าหน้าโปรเจกต์แล้ว ให้กดไอคอน `</>` หรือ `Web` เพื่อเพิ่ม Web App
6. ตั้งชื่อ App
7. กด `Register app`

หลังจากนั้น Firebase จะโชว์ชุดข้อมูล config สำหรับเชื่อมโปรเจกต์เว็บ ให้เก็บข้อมูลเหล่านี้ไว้:

- `apiKey`
- `authDomain`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`

## ขั้นตอนที่ 2: เปิดใช้งาน Authentication

Authentication คือระบบสำหรับทำล็อกอิน

วิธีเปิด:

1. เปิด Firebase Console ของโปรเจกต์
2. มองเมนูด้านซ้าย
3. หาเมนู `Build`
4. ใต้ `Build` ให้กด `Authentication`
5. กด `Get started`
6. ไปที่แท็บ `Sign-in method`
7. เปิด `Email/Password`
8. กด `Save`

หมายเหตุ:

- `Email/Password` คือแบบที่ใช้ email และ password ปกติ
- `Email link (passwordless sign-in)` ยังไม่จำเป็นสำหรับโปรเจกต์นี้

## ขั้นตอนที่ 3: สร้าง Firestore Database

Firestore คือฐานข้อมูลที่ใช้เก็บ task

วิธีสร้าง:

1. เปิด Firebase Console ของโปรเจกต์
2. ไปที่เมนู `Build`
3. กด `Firestore Database`
4. กด `Create database`
5. เลือก `Start in test mode`
6. เลือก region
7. กดสร้างให้เสร็จ

หลังจากสร้างแล้ว โปรเจกต์นี้จะใช้ collection ชื่อ `tasks`

## ขั้นตอนที่ 4: ตั้งค่าไฟล์ `.env`

ไฟล์ `.env` คือไฟล์ที่เก็บค่าการเชื่อมต่อ Firebase ของโปรเจกต์นี้

ทำตามนี้:

1. เปิดโฟลเดอร์โปรเจกต์นี้
2. สร้างไฟล์ชื่อ `.env`
3. คัดลอกค่าจากไฟล์ `.env.example` มาใส่
4. นำค่าจาก Firebase Console มาแทนที่ข้อความ `your_*`

ค่าที่ต้องใส่มีดังนี้:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

ไฟล์ตัวอย่างอยู่ที่ [.env.example](/Users/aejunk/Documents/project-2026/react-101/.env.example)

## ขั้นตอนที่ 5: ติดตั้ง package ของโปรเจกต์

เปิด terminal ในโฟลเดอร์โปรเจกต์ แล้วรัน:

```bash
npm install
```

คำสั่งนี้จะติดตั้ง library ที่โปรเจกต์ต้องใช้ เช่น React และ Firebase

## ขั้นตอนที่ 6: รันโปรเจกต์

หลังจากติดตั้งเสร็จ ให้รันคำสั่ง:

```bash
npm run dev
```

เมื่อรันสำเร็จ ใน terminal จะมีลิงก์ขึ้นมา เช่น:

```text
http://127.0.0.1:4173/
```

ให้นำลิงก์นั้นไปเปิดใน browser

หมายเหตุ:

- บางครั้งเลขพอร์ตอาจไม่ใช่ `4173`
- ให้ใช้ลิงก์ล่าสุดที่แสดงใน terminal เป็นหลัก

## จะรู้ได้ยังไงว่าเชื่อม Firebase สำเร็จแล้ว

เมื่อเปิดหน้าเว็บแล้ว ให้ดูส่วนสถานะบนหน้าแอป

สิ่งที่ควรสังเกต:

- ถ้าขึ้น `Connected config` แปลว่าไฟล์ `.env` ถูกอ่านแล้ว
- ถ้าขึ้น `Firestore: ready` แปลว่า Firestore พร้อมใช้งาน
- ถ้าขึ้น `Auth: ready` แปลว่า Authentication พร้อมใช้งาน

ถ้ายังไม่ขึ้น ให้ตรวจ 3 อย่างนี้:

1. ค่าใน `.env` ใส่ครบหรือยัง
2. สะกดชื่อตัวแปรถูกหรือยัง
3. หลังแก้ `.env` แล้ว ได้ปิดและเปิด `npm run dev` ใหม่หรือยัง

## ตอนนี้โปรเจกต์ทำอะไรกั

Aukkarapong Vongsawat
13:19
## ตอนนี้โปรเจกต์ทำอะไรกับ Firestore แล้วบ้าง

โปรเจกต์นี้เชื่อม Firestore แล้วในระดับพื้นฐาน โดยทำได้ดังนี้:

- ตอนเปิดหน้าเว็บ จะดึงข้อมูลจาก collection `tasks`
- ตอนกด `Add task` จะบันทึก task ใหม่ลง Firestore
- ตอนคลิก task จะอัปเดตสถานะ `done`

ถ้าคุณเพิ่ม task แล้วกลับไปดูใน Firebase Console > Firestore Database ควรจะเห็นข้อมูลถูกสร้างใน collection `tasks`

## โครงสร้างไฟล์สำคัญ

- [src/App.jsx](/Users/aejunk/Documents/project-2026/react-101/src/App.jsx)
  หน้าหลักของแอป และมี logic สำหรับเพิ่ม อ่าน และอัปเดต task
- [src/firebase.js](/Users/aejunk/Documents/project-2026/react-101/src/firebase.js)
  ไฟล์สำหรับเชื่อม React เข้ากับ Firebase
- [src/App.css](/Users/aejunk/Documents/project-2026/react-101/src/App.css)
  style ของหน้าแอป
- [src/index.css](/Users/aejunk/Documents/project-2026/react-101/src/index.css)
  style พื้นฐานของทั้งโปรเจกต์
- [.env.example](/Users/aejunk/Documents/project-2026/react-101/.env.example)
  ตัวอย่างรูปแบบไฟล์ `.env`

## คำสั่งที่ใช้บ่อย

รันโปรเจกต์:

```bash
npm run dev
```

build โปรเจกต์:

```bash
npm run build
```

ตรวจโค้ดด้วย lint:

```bash
npm run lint
```

## ปัญหาที่เจอบ่อย

### 1. เปิดเว็บได้ แต่ Firebase ไม่ทำงาน

สาเหตุที่พบบ่อย:

- ค่าใน `.env` ยังไม่ครบ
- พิมพ์ชื่อตัวแปรผิด
- ยังไม่ได้เปิด `Authentication` หรือ `Firestore`

### 2. เพิ่ม task ไม่ได้

สาเหตุที่พบบ่อย:

- Firestore rules ยังไม่อนุญาต
- ยังไม่ได้สร้าง database ให้เสร็จ
- ค่า config ใน `.env` ไม่ตรงกับโปรเจกต์

### 3. หาเมนู Authentication ไม่เจอ

ให้มองที่เมนูซ้ายใต้หัวข้อ `Build`

ถ้ายังไม่เห็น:

- ลองขยาย sidebar
- ใช้ช่องค้นหาด้านบนของ Firebase Console แล้วพิมพ์ `Authentication`

## สรุปแบบสั้นมาก

ถ้าจะเริ่มโปรเจกต์นี้แบบเร็วที่สุด ให้ทำตามนี้:

1. สร้าง Firebase project
2. เปิด `Authentication > Email/Password`
3. สร้าง `Firestore Database`
4. ใส่ค่าจาก Firebase ลงใน `.env`
5. รัน `npm install`
6. รัน `npm run dev`
7. เปิดลิงก์ใน browser
8. ลองเพิ่ม task และกลับไปดูข้อมูลใน Firestore

## หมายเหตุสำคัญ

- ไฟล์ `.env` ไม่ควรถูกส่งขึ้น git
- โปรเจกต์นี้เหมาะเป็นจุดเริ่มต้นสำหรับฝึก `React + Firebase`
- ถ้าจะทำงานส่งให้ครบขึ้น ขั้นถัดไปที่ควรทำคือเพิ่ม `login/register` ด้วย Firebase Authentication


## firebase
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDxexEzBaDZyNU-n5SDRF1U92qRDSRCE0A",
  authDomain: "login2026-4dc11.firebaseapp.com",
  projectId: "login2026-4dc11",
  storageBucket: "login2026-4dc11.firebasestorage.app",
  messagingSenderId: "1092273426569",
  appId: "1:1092273426569:web:94a773d56e035bccc9b658",
  measurementId: "G-5CB8L5ZVQW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);