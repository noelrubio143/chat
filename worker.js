const SCHEMA = `CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room TEXT NOT NULL DEFAULT 'main',
  username TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
)`;

let ready = false;

function cors(env) {
  return {
    "Access-Control-Allow-Origin": env.ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function json(env, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...cors(env) },
  });
}

async function ensureSchema(env) {
  if (ready) return;
  if (!env.DB) throw new Error("Walang DB binding. I-check ang wrangler.jsonc / Bindings.");
  await env.DB.prepare(SCHEMA).run();
  ready = true;
}

export default {
  async fetch(request, env, ctx) {
    try {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: cors(env) });
      }

      await ensureSchema(env);

      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, "") || "/";

      if (path === "/") {
        return json(env, { ok: true, service: "chat" });
      }

      // GET /messages?room=main&after=0&limit=50
      if (path === "/messages" && request.method === "GET") {
        const room = (url.searchParams.get("room") || "main").slice(0, 50);
        const after = parseInt(url.searchParams.get("after") || "0", 10) || 0;
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 200);

        const { results } = await env.DB
          .prepare(
            `SELECT id, room, username, text, created_at FROM (
               SELECT * FROM messages WHERE room = ?1 AND id > ?2
               ORDER BY id DESC LIMIT ?3
             ) ORDER BY id ASC`
          )
          .bind(room, after, limit)
          .all();

        return json(env, { messages: results });
      }

      // POST /messages  { "username": "...", "text": "...", "room": "main" }
      if (path === "/messages" && request.method === "POST") {
        let body;
        try {
          body = await request.json();
        } catch {
          return json(env, { error: "Invalid JSON" }, 400);
        }

        const username = String(body.username || "").trim().slice(0, 30);
        const text = String(body.text || "").trim().slice(0, 1000);
        const room = String(body.room || "main").trim().slice(0, 50);

        if (!username || !text) {
          return json(env, { error: "username at text ay kailangan" }, 400);
        }

        const now = Date.now();
        const res = await env.DB
          .prepare("INSERT INTO messages (room, username, text, created_at) VALUES (?1, ?2, ?3, ?4)")
          .bind(room, username, text, now)
          .run();

        return json(env, {
          ok: true,
          message: { id: res.meta.last_row_id, room, username, text, created_at: now },
        }, 201);
      }

      return json(env, { error: "Not found" }, 404);
    } catch (e) {
      console.error(e);
      return json(env, { error: e.message, stack: e.stack }, 500);
    }
  },
};
