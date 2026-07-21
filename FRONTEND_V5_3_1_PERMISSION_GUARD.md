# Frontend V5.3.3 — Permission Guard & Health Recovery

- Data Repair และ Repair Activity แสดงเฉพาะบัญชีที่มี `can_repair_missing` หรือ `can_force_refresh`
- Data Health แสดงเฉพาะบัญชีที่มี Account ซึ่ง `can_view`
- ป้องกันเปิด URL ของ Tool ที่ไม่มีสิทธิ์โดยตรง โดย Redirect กลับ My Workspace ก่อนเรียก API
- เปลี่ยน Workspace Local Cache เป็น Version 3 เพื่อล้าง Cache สิทธิ์เก่า
- Data Health จะสร้าง Workspace Cache ใหม่และ Retry เพียงหนึ่งครั้งเมื่อ Server Cache หมดอายุ
- `loadOverview()` ใช้ Promise เดียวร่วมกัน ป้องกันการเรียก OVERVIEW ซ้อนกัน
- Dropdown แสดงข้อความชัดเจนเมื่อไม่มี Game/Account แทนช่องว่าง
