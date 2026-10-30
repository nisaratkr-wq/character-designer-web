# Step-by-Step Code Guide

ไฟล์นี้อธิบายการเขียนโค้ดของโปรเจกต์ `Student Task Tracker` แบบทีละขั้น เหมาะสำหรับคนที่ต้องการเข้าใจว่าเราเขียน React และ Firebase อย่างไร ไม่ใช่แค่ให้โปรเจกต์รันได้

เอกสารนี้จะพาอ่านตามลำดับเดียวกับที่แอปทำงานจริง

## 1. เริ่มต้นด้วยการสร้าง React project โดยใช้ Vite

ก่อนจะมีไฟล์ `App.jsx` หรือ `firebase.js` เราต้องสร้างโปรเจกต์ React ขึ้นมาก่อน ซึ่งโปรเจกต์นี้ใช้ `Vite`

เหตุผลที่ใช้ Vite:

- สร้างโปรเจกต์ได้เร็ว
- รัน dev server ได้เร็ว
- โครงสร้างเริ่มต้นอ่านง่าย เหมาะกับคนเริ่มต้น

คำสั่งสำหรับสร้าง React project ใหม่:

```bash
npm create vite@latest my-react-app -- --template react
```

ความหมายของคำสั่งนี้:

- `npm create vite@latest` คือใช้ Vite สร้างโปรเจกต์ใหม่
- `my-react-app` คือชื่อโฟลเดอร์โปรเจกต์
- `--template react` คือเลือก template สำหรับ React

ถ้าต้องการสร้างโปรเจกต์ในโฟลเดอร์ปัจจุบัน:

```bash
npm create vite@latest . -- --template react
```

หลังจากสร้างเสร็จ ต้องติดตั้ง package:

```bash
npm install
```

และใช้คำสั่งนี้เพื่อรันโปรเจกต์:

```bash
npm run dev
```

เมื่อรันสำเร็จ Vite จะโชว์ลิงก์ใน terminal เช่น:

```text
http://127.0.0.1:5173/
```

หรือบางครั้งอาจเป็นพอร์ตอื่น เช่น `4173`

## 2. จุดเริ่มต้นของแอป

ไฟล์แรกที่ React เริ่มทำงานคือ [src/main.jsx](/Users/aejunk/Documents/project-2026/react-101/src/main.jsx)

โค้ดนี้มีหน้าที่:

- import React ที่จำเป็นสำหรับ render
- import CSS พื้นฐานของทั้งโปรเจกต์
- import component หลักคือ `App`
- render `<App />` ลงไปใน `<div id="root">` ที่อยู่ใน `index.html`

โค้ด:

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

สรุปง่าย ๆ:

- `main.jsx` คือประตูทางเข้าของแอป
- `App.jsx` คือหน้าหลักที่เราสร้าง UI และ logic ทั้งหมด

## 3. ไฟล์ `App.jsx` คือหัวใจของโปรเจกต์

ไฟล์ [src/App.jsx](/Users/aejunk/Documents/project-2026/react-101/src/App.jsx) เป็นไฟล์ที่รวมทั้ง:

- หน้าตา UI
- state ของฟอร์ม
- state ของ task
- logic สำหรับอ่านและเขียน Firestore

ตอนเริ่มไฟล์นี้ เราจะ import สิ่งที่ต้องใช้ก่อน

```jsx
import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { auth, db, hasFirebaseConfig } from './firebase'
import './App.css'
```

สิ่งสำคัญที่ import:

- `useState` ใช้เก็บข้อมูลที่เปลี่ยนแปลงได้
- `useEffect` ใช้ทำงานตอน component โหลด
- `addDoc` ใช้เพิ่มข้อมูลลง Firestore
- `getDocs` ใช้อ่านข้อมูลจาก Firestore
- `updateDoc` ใช้อัปเดตข้อมูลใน Firestore
- `db` คือ object สำหรับคุยกับ Firestore

## 4. สร้างข้อมูลตัวอย่างไว้ก่อน

ในโค้ดจะมี `starterTasks`

```jsx
const starterTasks = [
  ...
]
```

สิ่งนี้มีไว้เพื่อกรณีที่ Firebase ยังไม่พร้อม แอปจะยังมีข้อมูลตัวอย่างให้แสดง และไม่พัง

แนวคิดสำคัญ:

- ถ้า `db` ยังไม่พร้อม ใช้ `starterTasks`
- ถ้า `db` พร้อมแล้ว ดึงข้อมูลจริงจาก Firestore

## 5. สร้าง state สำหรับเก็บข้อมูล

ภายใน function `App()` เราสร้าง state หลักหลายตัว

```jsx
const [tasks, setTasks] = useState([])
const [form, setForm] = useState({
  title: '',
  course: '',
  note: '',
})
const [isLoading, setIsLoading] = useState(true)
const [isSaving, setIsSaving] = useState(false)
const [errorMessage, setErrorMessage] = useState('')
```

ความหมายของแต่ละ state:

- `tasks` เก็บรายการงานทั้งหมด
- `form` เก็บค่าที่ผู้ใช้กรอกในฟอร์ม
- `isLoading` ใช้บอกว่ากำลังโหลดข้อมูลอยู่
- `isSaving` ใช้บอกว่ากำลังบันทึกข้อมูลอยู่
- `errorMessage` ใช้เก็บข้อความ error เพื่อเอาไปแสดงบนหน้าเว็บ

นี่คือรูปแบบพื้นฐานมากของ React:

1. เก็บข้อมูลไว้ใน state
2. แสดงผล state บนหน้าเว็บ
3. เมื่อผู้ใช้กดหรือพิมพ์ ก็อัปเดต state

## 6. โหลดข้อมูลตอนเปิดหน้าเว็บ

เราต้องการให้แอปดึง task จาก Firestore อัตโนมัติเมื่อเปิดหน้าเว็บ จึงใช้ `useEffect`

```jsx
useEffect(() => {
  const loadTasks = async () => {
    ...
  }

  loadTasks()
}, [])
```

สาเหตุที่ใช้ `useEffect`:

- มันเหมาะกับงานที่ต้องทำตอน component ถูกเปิดครั้งแรก
- เช่น โหลดข้อมูลจาก API หรือ database

ภายใน `loadTasks()` มี logic สำคัญ 2 กรณี

### กรณีที่ 1: ยังไม่มี Firebase

```jsx
if (!db) {
  setTasks(starterTasks)
  setIsLoading(false)
  return
}
```

ความหมาย:

- ถ้า `db` ไม่มีค่า แปลว่ายังไม่ได้เชื่อม Firebase
- ให้ใช้ข้อมูลตัวอย่างแทน

### กรณีที่ 2: มี Firebase แล้ว

```jsx
const snapshot = await getDocs(collection(db, 'tasks'))
const firestoreTasks = snapshot.docs.map((taskDoc) => ({
  id: taskDoc.id,
  ...taskDoc.data(),
}))
setTasks(firestoreTasks)
```

อธิบายทีละบรรทัด:

- `collection(db, 'tasks')` คือบอกว่าเราจะทำงานกับ collection ชื่อ `tasks`
- `getDocs(...)` คือดึง document ทั้งหมดใน collection นี้
- `snapshot.docs.map(...)` คือแปลงข้อมูลจาก Firestore ให้อยู่ในรูปที่ React ใช้งานง่าย
- `setTasks(...)` คือเอาข้อมูลมาเก็บใน state

## 7. คำนวณจำนวนงานที่ทำเสร็จ

โค้ดนี้ใช้สำหรับแสดงผลว่าเสร็จไปกี่งาน

```jsx
const completedCount = tasks.filter((task) => task.done).length
```

หลักการคือ:

1. ใช้ `filter()` เลือกเฉพาะ task ที่ `done` เป็น `true`
2. นับจำนวนด้วย `.length`

นี่เป็นตัวอย่างของการคำนวณค่าจาก state โดยไม่ต้องสร้าง state เพิ่ม

## 8. รับค่าจากฟอร์ม

เมื่อผู้ใช้พิมพ์ใน input หรือ textarea เราจะเรียก `handleChange`

```jsx
const handleChange = (event) => {
  const { name, value } = event.target
  setForm((current) => ({
    ...current,
    [name]: value,
  }))
}
```

แนวคิด:

- `name` มาจาก `<input name="title" />` หรือ `<input name="course" />`
- `value` คือค่าที่ผู้ใช้พิมพ์
- เราใช้ `[name]: value` เพื่ออัปเดต field ที่ตรงกับ input นั้น

ข้อดีของวิธีนี้คือ:

- ใช้ function เดียวจัดการ input ได้หลายช่อง

## 9. บันทึก task ใหม่

เมื่อผู้ใช้กดปุ่ม `Add task` จะเรียก `handleSubmit`

```jsx
const handleSubmit = async (event) => {
  event.preventDefault()
  ...
}
```

`event.preventDefault()` มีไว้กันไม่ให้ form รีเฟรชหน้าเว็บ

### 9.1 ตรวจว่ากรอกข้อมูลครบหรือยัง

```jsx
if (!form.title.trim() || !form.course.trim()) {
  return
}
```

เราบังคับให้ `title` และ `course` ต้องไม่ว่าง

### 9.2 เตรียม object ของ task ใหม่

```jsx
const nextTask = {
  title: form.title.trim(),
  course: form.course.trim(),
  note: form.note.trim(),
  done: false,
}
```

จุดนี้คือการรวมค่าจากฟอร์มให้อยู่ในรูปข้อมูลที่พร้อมบันทึก

### 9.3 ถ้าไม่มี Firebase ให้เพิ่มลง state ตรง ๆ

```jsx
if (!db) {
  setTasks((current) => [
    {
      id: Date.now(),
      ...nextTask,
    },
    ...current,
  ])
}
```

ตรงนี้ใช้ตอน Firebase ยังไม่พร้อม เพื่อให้ฟอร์มยังทำงานแบบ local ได้

### 9.4 ถ้ามี Firebase ให้บันทึกลง Firestore

```jsx
const taskRef = await addDoc(collection(db, 'tasks'), {
  ...nextTask,
  createdAt: serverTimestamp(),
})
```

อธิบาย:

- `addDoc(...)` ใช้สร้าง document ใหม่ใน Firestore
- `collection(db, 'tasks')` คือ collection เป้าหมาย
- `serverTimestamp()` ใช้ให้ Firebase บันทึกเวลาจาก server

หลังจากบันทึกสำเร็จ:

```jsx
setTasks((current) => [
  {
    id: taskRef.id,
    ...nextTask,
  },
  ...current,
])
```

เราเอาข้อมูลที่เพิ่งบันทึกมาเพิ่มใน state ทันที เพื่อให้หน้าเว็บอัปเดตทันที

### 9.5 ล้างฟอร์ม

```jsx
setForm({
  title: '',
  course: '',
  note: '',
})
```

หลังบันทึกเสร็จ เรารีเซ็ตฟอร์มให้พร้อมกรอกงานถัดไป

## 10. เปลี่ยนสถานะ done ของ task

เมื่อผู้ใช้คลิก task card จะเรียก `toggleTask(id)`

```jsx
const toggleTask = async (id) => {
  ...
}
```

ขั้นตอนการทำงาน:

1. หา task ตัวที่ถูกคลิก
2. กลับค่าจาก `true` เป็น `false` หรือจาก `false` เป็น `true`
3. อัปเดตหน้าจอทันที
4. ถ้ามี Firebase ให้ update ใน Firestore ด้วย

### 10.1 หา task ที่ถูกคลิก

```jsx
const currentTask = tasks.find((task) => task.id === id)
```

### 10.2 สร้างค่าถัดไปของ done

```jsx
const nextDone = !currentTask.done
```

### 10.3 อัปเดต state ทันที

```jsx
setTasks((current) =>
  current.map((task) => (task.id === id ? { ...task, done: nextDone } : task)),
)
```

นี่คือการอัปเดตเฉพาะ task ที่ถูกคลิก

### 10.4 อัปเดต Firestore

```jsx
await updateDoc(doc(db, 'tasks', id), {
  done: nextDone,
})
```

อธิบาย:

- `doc(db, 'tasks', id)` เลือก document ที่ต้องการแก้
- `updateDoc(...)` อัปเดต field `done`

ถ้าอัปเดตไม่สำเร็จ โค้ดจะย้อน state กลับค่าเดิม เพื่อให้ข้อมูลบนหน้าเว็บไม่หลอกผู้ใช้

## 11. การจัดการ error

โปรเจกต์นี้ไม่ปล่อยให้ error หายเงียบ แต่เก็บข้อความไว้ใน `errorMessage`

ตัวอย่าง:

```jsx
setErrorMessage('Could not save the task. Please check Firestore permissions.')
```

จากนั้นนำข้อความนี้ไปแสดงใน JSX

```jsx
{errorMessage ? <p className="form-message error">{errorMessage}</p> : null}
```

ข้อดีของแนวนี้:

- ผู้ใช้รู้ว่าเกิดอะไรขึ้น
- debug ได้ง่ายขึ้น

## 12. การเขียน JSX เพื่อแสดงผล

ส่วน `return (...)` ใน `App.jsx` คือ HTML ที่เขียนในรูปแบบ JSX

หน้าหลักแบ่งได้เป็น 3 ส่วน:

1. ส่วนแสดงสถานะ Firebase และจำนวน task
2. ส่วนฟอร์มเพิ่ม task
3. ส่วนรายการ task และ checklist

แนวคิดสำคัญของ React คือ:

- ข้อมูลอยู่ใน JavaScript
- หน้าเว็บแสดงผลตามข้อมูลนั้น

ตัวอย่าง:

```jsx
{tasks.map((task) => (
  <button key={task.id} ...>
    ...
  </button>
))}
```

`map()` ใช้แปลงข้อมูลใน array ให้กลายเป็น UI หลายชิ้น

## 13. การเชื่อม Firebase

ไฟล์ [src/firebase.js](/Users/aejunk/Documents/project-2026/react-101/src/firebase.js) เป็นจุดที่เชื่อมแอปกับ Firebase

โค้ดส่วนแรกคือสร้าง config:

```js
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}
```

ความหมาย:

- React จะอ่านค่าจาก `.env`
- ค่านี้มาจาก Firebase Console

## 14. เช็กว่าค่า Firebase ครบหรือยัง

```js
export const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean)
```

หลักการ:

- เอาค่าทุกตัวใน config มาดู
- ถ้าทุกตัวมีค่า จะได้ `true`
- ถ้ามีตัวใดตัวหนึ่งว่าง จะได้ `false`

นี่เป็นจุดสำคัญที่ช่วยให้แอปไม่พังเมื่อ `.env` ยังไม่ครบ

## 15. สร้าง Firebase app และ services

```js
const app = hasFirebaseConfig ? initializeApp(firebaseConfig) : null

export const auth = app ? getAuth(app) : null
export const db = app ? getFirestore(app) : null
```

ความหมาย:

- ถ้าค่า config ครบ ค่อยสร้าง Firebase app
- ถ้ายังไม่ครบ ให้ `app`, `auth`, `db` เป็น `null`

ข้อดีคือ:

- แอปไม่ crash
- เราสามารถเช็ก `if (!db)` ใน `App.jsx` ได้

## 16. CSS ทำหน้าที่อะไร

โปรเจกต์นี้แยก CSS เป็น 2 ส่วน

- [src/index.css](/Users/aejunk/Documents/project-2026/react-101/src/index.css)
  ใช้สำหรับ style พื้นฐานทั้งแอป
- [src/App.css](/Users/aejunk/Documents/project-2026/react-101/src/App.css)
  ใช้สำหรับ style ของหน้า `App`

แนวคิดคือ:

- `index.css` ดูแลภาพรวม
- `App.css` ดูแลรายละเอียดของ component หลัก

## 17. สรุปลำดับการเขียนโค้ดของโปรเจกต์นี้

ถ้าจะสรุปเป็นขั้นตอนการสร้างโปรเจกต์นี้แบบย่อ:

1. สร้าง React app ด้วย Vite
2. สร้าง `main.jsx` ให้ render `<App />`
3. สร้าง `App.jsx` เป็นหน้าหลัก
4. สร้าง state สำหรับ `tasks`, `form`, `loading`, `saving`, `error`
5. ทำฟอร์มรับข้อมูลจากผู้ใช้
6. ทำ `handleChange` เพื่ออัปเดตค่าในฟอร์ม
7. ทำ `handleSubmit` เพื่อเพิ่ม task
8. เชื่อม `firebase.js` กับ Firebase config
9. ใช้ `useEffect` โหลด task จาก Firestore
10. ใช้ `toggleTask` เพื่ออัปเดต `done`
11. แสดงผล task ด้วย `map()`
12. ใส่ error message และ loading message
13. ตกแต่งหน้าเว็บด้วย CSS

## 18. ถ้าจะพัฒนาต่อ ควรทำอะไรต่อ

ขั้นถัดไปที่เหมาะที่สุดคือ:

1. เพิ่ม `login/register` ด้วย Firebase Authentication
2. เพิ่ม `delete task`
3. เพิ่ม `edit task`
4. แยก component ออกเป็นไฟล์ย่อย เช่น `TaskForm`, `TaskList`, `TaskCard`
5. เพิ่ม Firestore security rules ที่ปลอดภัยขึ้น

## 19. สรุปสุดท้าย

โปรเจกต์นี้คือการฝึกแนวคิดหลัก 3 อย่างพร้อมกัน:

- React ใช้สร้าง UI
- React state ใช้เก็บและอัปเดตข้อมูลบนหน้าเว็บ
- Firebase Firestore ใช้เก็บข้อมูลจริงไว้ภายนอกแอป

ถ้าเข้าใจ `state`, `form`, `useEffect`, `addDoc`, `getDocs`, และ `updateDoc` ได้ คุณจะเริ่มเห็นภาพการทำเว็บที่เชื่อมฐานข้อมูลได้ชัดขึ้นมาก
