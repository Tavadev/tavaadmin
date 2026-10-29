const path = require("path");

try {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
} catch (_) {}

let sb = null;

function clienteSupabase() {
  if (sb !== null) return sb || null;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  if (!url || !key) {
    sb = false;
    return null;
  }
  const { createClient } = require("@supabase/supabase-js");
  sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return sb;
}

function usaSupabase() {
  return Boolean(clienteSupabase());
}

function faltaTabla(error) {
  const code = String((error && error.code) || "");
  const msg = String((error && error.message) || error || "");
  return code === "42P01" || code === "PGRST205" || /does not exist|schema cache|no existe/i.test(msg);
}

module.exports = { clienteSupabase, usaSupabase, faltaTabla };
