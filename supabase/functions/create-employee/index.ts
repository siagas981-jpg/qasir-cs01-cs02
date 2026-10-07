// Edge Function (optional CLI deploy) — same behavior as FastAPI POST /api/employees
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

    const { email, password, full_name, role, outlet_id } = await req.json();
    if (!email || !password || password.length < 6)
      return Response.json({ error: "Email dan password (min. 6) wajib" }, { status: 400, headers: CORS });
    if (!["cashier", "manager"].includes(role))
      return Response.json({ error: "Role harus cashier atau manager" }, { status: 400, headers: CORS });

    const { data: created, error } = await service.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name },
    });
    if (error) return Response.json({ error: error.message }, { status: 400, headers: CORS });

    const { data: profile, error: pErr } = await service
      .from("profiles")
      .update({ full_name, role, outlet_id, is_active: true })
      .eq("id", created.user.id)
      .select()
      .single();
    if (pErr) {
      await service.auth.admin.deleteUser(created.user.id); // rollback orphan
      return Response.json({ error: pErr.message }, { status: 500, headers: CORS });
    }
    return Response.json(profile, { status: 201, headers: CORS });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500, headers: CORS });
  }
});
