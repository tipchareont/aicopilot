# Frontend V4.9.0 — Dashboard Refinement + Complete Register Focus

## Summary
ปรับ Frontend ตาม Feedback ล่าสุด โดยเน้น 4 เรื่องหลัก
1. เปลี่ยนมุมวัดผลหลักจาก Results รวม → Complete Register
2. เปลี่ยนคำ Objective จาก Sale/Sales → Conversion
3. เพิ่ม UX การ Sort / Filter ในตารางสรุปบน Dashboard
4. ปรับหน้า Creative Weekly / Scale Advisor ให้อ่านง่ายและใช้งานเร็วขึ้น

## Key Changes
- Dashboard KPI: Results → Complete Register
- Dashboard KPI: Cost / Result → Cost / Complete Register
- Trend dropdown: Results / Cost per Result → Complete Register / Cost per Complete Register
- Trend dropdown: เพิ่ม Impressions
- Dashboard Campaign Summary: เพิ่ม Sort + Objective Filter
- Dashboard Creative Summary: เพิ่ม Sort + Objective Filter + Top 10/20/50/All
- Creative page: เอา column Campaigns count ออกจาก table
- Creative Weekly: ตัดภาพใหญ่ใน detail, เพิ่มตัวอย่าง Hook/Message/Visual/CTA แบบ dropdown
- Creative Weekly: เปลี่ยน Results / Cost per Result → Complete Register / Cost per Complete Register
- Scale Advisor: เปลี่ยน Results / Cost per Result → Complete Register / Cost per Complete Register
- Scale Advisor: Guardrail ย้ายเป็น dropdown ต่อการ์ด
- Global loader: ปรับเป็น minimal animated loader ใหม่

## Files Updated
- assets/js/product-data.js
- assets/js/dashboard.js
- assets/js/campaign.js
- assets/js/creative.js
- assets/js/creative-weekly.js
- assets/js/scale-advisor.js
- assets/css/product.css
- assets/css/creative-weekly.css
- assets/css/scale-advisor.css
- dashboard/index.html
- campaign/index.html
- creative/index.html
- creative-weekly/index.html
- scale-advisor/index.html
- index.html

## Note
ค่า Complete Register จะอิงจาก field dedicated ถ้ามี และจะ fallback ไปใช้ Results เฉพาะ Objective = Conversion เมื่อ field dedicated ยังไม่มีใน payload
