import express from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const kidsClubSop = JSON.parse(
  readFileSync(join(__dirname, "Kidsclub", "SOP-KC-001.json"), "utf-8")
);

// Registry of SOPs served by this MCP server, keyed by SOP id.
const REGISTRY = {
  [kidsClubSop.id]: kidsClubSop,
};

function listSops(department) {
  return Object.values(REGISTRY)
    .filter((doc) => !department || doc.department === department)
    .map(({ id, department, title, version, updated, owner, status }) => ({
      id,
      department,
      title,
      version,
      updated,
      owner,
      status,
    }));
}

function getSop(sopId, section) {
  const doc = REGISTRY[sopId.toUpperCase()];
  if (!doc) {
    return { error: `ไม่พบ ${sopId}` };
  }
  const head = {
    id: doc.id,
    title: doc.title,
    version: doc.version,
    status: doc.status,
    warning: doc.warning,
  };
  if (section) {
    const hit = doc.sections.find((s) => s.section === section);
    return hit
      ? { ...head, section: hit }
      : { ...head, error: `ไม่พบหมวด ${section}` };
  }
  return {
    ...head,
    sections: doc.sections.map(({ section, title, body }) => ({
      section,
      title,
      body,
    })),
  };
}

function searchSop(query) {
  const needle = query.toLowerCase();
  const results = [];
  for (const doc of Object.values(REGISTRY)) {
    for (const s of doc.sections) {
      const idx = s.search_text.indexOf(needle);
      if (idx === -1) continue;
      const start = Math.max(0, idx - 80);
      const end = Math.min(s.search_text.length, idx + needle.length + 80);
      results.push({
        sop_id: doc.id,
        section: s.section,
        title: s.title,
        snippet: s.search_text.slice(start, end).trim(),
      });
    }
  }
  return results;
}

function buildServer() {
  const server = new McpServer({
    name: "andaman-kidsclub-sop",
    version: "1.0.0",
  });

  server.registerTool(
    "list_sops",
    {
      description: "แสดงรายการ SOP ทั้งหมดที่เซิร์ฟเวอร์นี้มี กรองด้วยแผนกได้ (เช่น \"Kids Club\")",
      inputSchema: { department: z.string().optional() },
    },
    async ({ department }) => ({
      content: [
        { type: "text", text: JSON.stringify(listSops(department), null, 2) },
      ],
    })
  );

  server.registerTool(
    "get_sop",
    {
      description:
        "ดึงเนื้อหา SOP ฉบับเต็มตามรหัส (เช่น SOP-KC-001) ระบุ section เพื่อดึงเฉพาะหมวด",
      inputSchema: { sop_id: z.string(), section: z.string().optional() },
    },
    async ({ sop_id, section }) => ({
      content: [
        { type: "text", text: JSON.stringify(getSop(sop_id, section), null, 2) },
      ],
    })
  );

  server.registerTool(
    "search_sop",
    {
      description: "ค้นหาคำในทุก SOP ที่มี คืนหมวด หัวข้อ และข้อความรอบคำที่เจอ",
      inputSchema: { query: z.string() },
    },
    async ({ query }) => ({
      content: [
        { type: "text", text: JSON.stringify(searchSop(query), null, 2) },
      ],
    })
  );

  return server;
}

const app = express();
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "andaman-kidsclub-sop-mcp" });
});

app.post("/mcp", async (req, res) => {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const methodNotAllowed = (_req, res) => {
  res.writeHead(405).end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    })
  );
};
app.get("/mcp", methodNotAllowed);
app.delete("/mcp", methodNotAllowed);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`andaman-kidsclub-sop MCP server listening on port ${PORT}`);
});
