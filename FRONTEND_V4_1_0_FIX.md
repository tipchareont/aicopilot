# Frontend V4.1.0 Fix

## Fixed

- แก้ Login สำเร็จแล้วเด้งกลับ Login เพราะ Frontend ตัดเวลา Session เหลือเฉพาะวันที่
- Parse `Token_Expires_At` แบบ Asia/Bangkok (`+07:00`) ตาม Backend
- รองรับ Login API response แบบ nested และ n8n wrapper
- เปลี่ยน Dashboard local cache เป็น V4 เพื่อไม่อ่าน Schema เก่า
- Dashboard อ่าน `dashboard.ai_summary` จาก `ai_daily_summary_latest`
- เปลี่ยน Today's Action เป็น AI Daily Intelligence จากข้อมูลจริง
- Campaign และ Creative ใช้ Session validation logic ชุดเดียวกัน
- เพิ่ม cache-busting version `4.1.0` ทุกหน้า

## Upload

Upload ไฟล์และโฟลเดอร์ทั้งหมดทับ Repository เดิม แล้วรอ GitHub Pages Deploy เสร็จ
