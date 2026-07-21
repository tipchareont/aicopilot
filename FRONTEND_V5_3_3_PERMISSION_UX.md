# Frontend V5.3.3 — Permission UX

- ซ่อน Data Repair และ Repair Activity ตั้งแต่แรกเมื่อไม่มีสิทธิ์
- ซ่อนเมนู Data Management ระหว่างที่ Permission ยังไม่พร้อม เพื่อป้องกันเมนูกะพริบ
- Viewer เห็นเฉพาะ Data Health
- URL ตรงไปยังฟีเจอร์ที่ไม่มีสิทธิ์จะแสดงหน้า Access Denied แทนการเด้งกลับแบบเงียบ ๆ
- หน้า Access Denied ไม่เรียก Data Repair / Repair Activity API
- เพิ่ม Cache Version 5 เพื่อไม่ใช้ Permission Cache เก่า
