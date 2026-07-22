# Frontend V5.4.0 — Session Snapshot

- Login Response บันทึก Profile, Access, Data Health และ Repair Activity ลง Local Storage ครั้งเดียว
- การสลับ Profile / My Access / Data Health / Data Repair / Repair Activity ไม่เรียก n8n
- User Control API ถูกเรียกเฉพาะ PREVIEW_REPAIR, START_REPAIR และ REPAIR_STATUS
- ปุ่มรีเฟรชข้อมูลเรียก Session Validation แบบ Data Table Read หนึ่งครั้งเมื่อผู้ใช้กดเอง
- Logout revoke Session Snapshot ผ่าน `/session/logout`
