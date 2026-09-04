# เชื่อม SOP-KC-001 เข้ากับ MCP server

สกิลนี้ใช้ได้สองทาง และใช้พร้อมกันได้ทั้งคู่จากไฟล์ชุดเดียวกัน

1. **เป็น Skill** — อัปโหลด `andaman-kids-club-sop.skill` เข้าโปรไฟล์ Claude โมเดลจะอ่าน `SKILL.md` เมื่อคำถามเข้าเงื่อนไข แล้วเปิดไฟล์ใน `references/` เฉพาะที่เกี่ยวข้อง
2. **เป็นข้อมูลใน MCP server** — ให้ `data/SOP-KC-001.json` เป็นแหล่งข้อมูลของ tool `list_sops` `get_sop` และ `search_sop` ที่มีอยู่แล้วใน server Grand Andaman

## โครงไฟล์

```
andaman-kids-club-sop/
├── SKILL.md                     # เมทาดาทา + หลักการตอบ + ตัวเลขที่ถามบ่อย (Claude อ่านก่อนเสมอ)
├── references/
│   ├── operations.md            # หมวด 1–5, 7, 11, 14–15
│   ├── child-safety.md          # หมวด 6, 8, 12, 13 — ลำดับศักดิ์สูงสุด
│   └── hygiene-food.md          # หมวด 9–10
├── assets/
│   └── sop-full.html            # ฉบับจัดหน้าเต็มสำหรับพิมพ์หรือเผยแพร่
├── scripts/
│   └── build_mcp_payload.py     # แปลง references/ → data/SOP-KC-001.json
├── data/
│   └── SOP-KC-001.json          # payload สำหรับ MCP (สร้างจากสคริปต์ ไม่ต้องแก้มือ)
└── MCP-INTEGRATION.md
```

**แหล่งความจริงเดียวคือไฟล์ใน `references/`** แก้ที่นั่นแล้วรัน `python scripts/build_mcp_payload.py` ใหม่ JSON จะตามไปเอง อย่าแก้ JSON ตรง ๆ เพราะจะทำให้สองทางพูดไม่ตรงกัน ซึ่งอันตรายกว่าไม่มีเอกสารเลย

## รูปแบบ payload

ฟิลด์ระดับบนตรงกับที่ `list_sops` คืนอยู่แล้ว (`id` `department` `title` `version` `updated` `owner`) จึงเสียบเข้าทะเบียนเดิมได้โดยไม่ต้องแก้ schema เพิ่มมาสามฟิลด์:

| ฟิลด์ | ใช้ทำอะไร |
|---|---|
| `status` | `"draft"` — ให้ tool ส่งกลับด้วยทุกครั้ง ผู้เรียกจะได้ไม่เข้าใจผิดว่าประกาศใช้แล้ว |
| `warning` | ข้อความเตือนเรื่องตัวเลขที่ยังไม่ยืนยัน แนบไปกับทุก response ของ `get_sop` |
| `sections[]` | หมวดละหนึ่งรายการ มี `section` `title` `source` `body` `search_text` |

`search_text` เป็น body ตัวพิมพ์เล็กไว้ค้นแบบ substring ได้ทันที ไม่ต้องทำดัชนีแยก

## ตัวอย่างการต่อเข้า server

```python
import json
from pathlib import Path

KC = json.loads(Path("data/SOP-KC-001.json").read_text(encoding="utf-8"))
REGISTRY = {KC["id"]: KC}  # รวมกับ SOP เดิมของโรงแรม

@mcp.tool()
def get_sop(sop_id: str, section: str = "") -> dict:
    """ดึงเนื้อหา SOP ฉบับเต็มตามรหัส ระบุ section เพื่อดึงเฉพาะหมวด"""
    doc = REGISTRY.get(sop_id.upper())
    if not doc:
        return {"error": f"ไม่พบ {sop_id}"}
    head = {k: doc[k] for k in ("id", "title", "version", "status", "warning")}
    if section:
        hit = next((s for s in doc["sections"] if s["section"] == section), None)
        return {**head, "section": hit} if hit else {**head, "error": f"ไม่พบหมวด {section}"}
    return {**head, "sections": [{k: s[k] for k in ("section", "title", "body")} for s in doc["sections"]]}
```

`search_sop` เพิ่มการค้นในชุดนี้ได้ด้วยการวนหา `query.lower()` ใน `search_text` แล้วคืน `section` `title` และ 2–3 บรรทัดรอบคำที่เจอ พร้อม `sop_id` เพื่อให้ผู้เรียกไปดึงหมวดเต็มต่อ

## ข้อควรระวังตอนขึ้น MCP

- **หมวด 12 ยาว 3,700 ตัวอักษร** ถ้า `get_sop` คืนทั้งเอกสารทุกครั้งจะกิน context เกินจำเป็น ให้รองรับพารามิเตอร์ `section` และเขียนใน description ของ tool ว่าควรระบุหมวด
- **อย่าเสิร์ฟฉบับร่างเงียบ ๆ** ให้ `warning` ติดไปกับทุก response จนกว่าจะเปลี่ยนเป็น version 1.0
- **ตั้ง `department` เป็น `"Kids Club"`** เพื่อให้ `list_sops(department="Kids Club")` กรองได้ และไม่ปนกับ Front Office
- **แบบฟอร์มชุด KC-F** ยังไม่มีในระบบ ถ้าจะให้ MCP ดึงแบบฟอร์มได้ด้วย ต้องเพิ่ม tool หรือ resource แยก อย่าให้ `get_sop` คืนไฟล์แบบฟอร์มปนมากับเนื้อ SOP
- **ทุกครั้งที่แก้ SOP** ให้ขยับ `version` ใน `scripts/build_mcp_payload.py` แล้ว build ใหม่ ไม่งั้นฝั่งที่แคชไว้จะไม่รู้ว่าเนื้อหาเปลี่ยน

## แพ็กเป็นไฟล์สกิล

```bash
cd andaman-kids-club-sop/..
zip -r andaman-kids-club-sop.skill andaman-kids-club-sop -x '*/__pycache__/*'
```
