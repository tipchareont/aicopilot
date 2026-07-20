# Frontend 4.8.0 — Historical Data Visibility

## Root Cause

ข้อมูล Backfill เข้า `Meta_Raw_Data` และ Performance Cache แล้ว แต่ Frontend:

- ใช้ช่วง 7 วันเป็นค่าเริ่มต้น
- จำค่าตัวกรอง 7 วันใน Browser
- Dashboard ไม่มีตัวเลือกย้อนหลังทั้งหมด
- Product pages อ่าน Browser Cache ก่อน Network

## Changes

- Dashboard เพิ่ม `ย้อนหลังทั้งหมด`
- Dashboard ใช้ย้อนหลังทั้งหมดเป็นค่าเริ่มต้น
- Campaign ใช้ย้อนหลังทั้งหมดเป็นค่าเริ่มต้น
- Creative ใช้ย้อนหลังทั้งหมดเป็นค่าเริ่มต้น
- แสดงช่วงข้อมูลจริงบน Dashboard, Campaign และ Creative
- Cache Namespace เปลี่ยนจาก V7 เป็น V8
- Product pages ใช้ Network-first และ Browser Cache เป็น fallback
- 7/14/30 วัน และ Custom Range ยังใช้งานได้ตามเดิม

## Verified Data Coverage

- Earliest date: 2026-05-07
- Latest date: 2026-07-19
