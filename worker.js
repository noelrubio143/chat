export default {
  async fetch(request, env) {
    let db = "walang DB binding";
    try {
      if (env.DB) {
        const r = await env.DB.prepare("SELECT 1 AS ok").first();
        db = "DB ok: " + JSON.stringify(r);
      }
    } catch (e) {
      db = "DB error: " + e.message;
    }
    return new Response("hello from chat\n" + db, {
      headers: { "content-type": "text/plain" },
    });
  },
};
