export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const h = {
      "Access-Control-Allow-Origin": origin === env.ORIGIN ? origin : env.ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json"
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: h });
    const url = new URL(req.url);
    try {
      if (req.method === "GET") {
        const u = url.searchParams.get("u") || "";
        if (u.length < 6 || u.length > 64) return new Response("[]", { headers: h });
        const { results } = await env.DB.prepare(
          "SELECT from_admin, text FROM messages WHERE u = ? ORDER BY id DESC LIMIT 100"
        ).bind(u).all();
        const out = results.reverse().map(r => ({ from: r.from_admin ? "them" : "me", text: r.text }));
        return new Response(JSON.stringify(out), { headers: h });
      }
      if (req.method === "POST") {
        const b = await req.json();
        const u = String(b.u || "");
        const text = String(b.text || "").trim().slice(0, 500);
        if (u.length < 6 || u.length > 64 || !text)
          return new Response('{"error":"bad"}', { status: 400, headers: h });
        const now = Date.now();
        const c = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM messages WHERE u = ? AND from_admin = 0 AND at > ?"
        ).bind(u, now - 60000).first();
        if (c.n >= 10) return new Response('{"error":"slow down"}', { status: 429, headers: h });
        await env.DB.prepare(
          "INSERT INTO messages (u, from_admin, text, at) VALUES (?, 0, ?, ?)"
        ).bind(u, text, now).run();
        return new Response('{"ok":true}', { headers: h });
      }
    } catch (e) {
      return new Response('{"error":"server"}', { status: 500, headers: h });
    }
    return new Response("{}", { status: 405, headers: h });
  }
};
