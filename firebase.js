import admin from "firebase-admin";
import dotenv from "dotenv";

// Load biến môi trường TRƯỚC khi khởi tạo
dotenv.config();

// =====================
// KHỞI TẠO FIREBASE ADMIN
// =====================
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
  })
});

// Khởi tạo Firestore
const db = admin.firestore();

// Xuất ra để các file khác dùng
export { admin, db };
export default admin;
