import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No autenticado");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: callerError } = await userClient.auth.getUser();
    if (callerError || !caller) throw new Error("Sesión inválida");

    const { data: callerProfile } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (!callerProfile || !["admin", "kinesiologo"].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: "No tienes permisos para crear usuarios." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { full_name, email, password, role, phone, assigned_kinesiologo_id } = body;

    if (!full_name || !email || !password || !role) throw new Error("Faltan datos obligatorios.");
    if (!["admin", "kinesiologo", "paciente"].includes(role)) throw new Error("Rol inválido.");

    if (callerProfile.role === "kinesiologo" && role !== "paciente") {
      throw new Error("Un kinesiólogo solo puede crear pacientes.");
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    });

    if (createError) throw createError;

    const assigned = callerProfile.role === "kinesiologo"
      ? caller.id
      : (assigned_kinesiologo_id || null);

    const { error: profileError } = await adminClient.from("profiles").upsert({
      id: created.user.id,
      full_name,
      email,
      phone: phone || null,
      role,
      assigned_kinesiologo_id: assigned,
      active: true,
    });

    if (profileError) throw profileError;

    return new Response(JSON.stringify({ ok: true, user_id: created.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Error inesperado" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
