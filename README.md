# MCP Retail Torsob

MCP server (Streamable HTTP) ที่เสิร์ฟ SOP ของ Andaman Grand Resort ผ่าน tool
`list_sops`, `get_sop`, `search_sop` โดยดึงข้อมูลจาก [`Kidsclub/SOP-KC-001.json`](Kidsclub/SOP-KC-001.json)

## รัน local

```bash
npm install
npm start
```

เซิร์ฟเวอร์ฟัง MCP endpoint ที่ `POST /mcp` (พอร์ตตาม `PORT` env, ดีฟอลต์ 3000)

## เพิ่ม SOP อื่น

แปลง SOP เป็น payload รูปแบบเดียวกับ `Kidsclub/SOP-KC-001.json` แล้วเพิ่มเข้า `REGISTRY`
ใน [`server.js`](server.js) — รายละเอียด schema และวิธี build ดูที่
[`Kidsclub/MCP-INTEGRATION.md`](Kidsclub/MCP-INTEGRATION.md)
