// Edge Function (optional CLI deploy) — same behavior as FastAPI POST /api/employees/{id}/password
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!jwt) return Response.json({ error: "Missing token" }, { status: 401, headers: CORS });
    const { data: { user } } = await service.auth.getUser(jwt);
    const { data: me } = await service.from("profiles").select("role").eq("id", user?.id).single();
    if (me?.role !== "owner" && me?.role !== "admin")
      return Response.json({ error: "Owner role required" }, { status: 403, headers: CORS });

    const { user_id, password } = await req.json();
    if (!user_id || !password || password.length < 6)
      return Response.json({ error: "user_id dan password (min. 6) wajib" }, { status: 400, headers: CORS });

    const { error } = await service.auth.admin.updateUserById(user_id, { password });
    if (error) return Response.json({ error: error.message }, { status: 400, headers: CORS });
    return Response.json({ ok: true }, { headers: CORS });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500, headers: CORS });
  }
});
