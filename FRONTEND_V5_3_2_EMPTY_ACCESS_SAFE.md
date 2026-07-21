# Frontend V5.3.3 — Empty Access Safe

- รองรับ User_Access ที่ยังไม่มี Row โดยไม่แสดง STALE
- ใช้ Workspace Cache schema v4 เพื่อล้าง Cache สิทธิ์เดิม
- แสดงข้อความชัดเจนเมื่อ User ยังไม่ได้รับ Game / Account
- ซ่อน Data Management ทั้งกลุ่มเมื่อไม่มี Account ที่ดูได้
- Admin ยังคงใช้ Account_Mapping ที่ Active ทั้งหมดตาม Role
