import { createClient } from "@supabase/supabase-js";

export const API = "https://ulqzhewdcgzduwbncvzy.supabase.co";
export const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVscXpoZXdkY2d6ZHV3Ym5jdnp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk5NTM4OSwiZXhwIjoyMDc4NTcxMzg5fQ.JPUsHlG2Tz3NBfY1mkF4xS2gxCzQoHNM4lyVLRwEb0I";

export const createSupabase = (_env: Env) => {
  void _env;
  return createClient(API, KEY, {
    auth: { persistSession: false },
    global: { fetch: globalThis.fetch },
  });
};