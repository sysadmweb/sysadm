import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ulqzhewdcgzduwbncvzy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVscXpoZXdkY2d6ZHV3Ym5jdnp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk5NTM4OSwiZXhwIjoyMDc4NTcxMzg5fQ.JPUsHlG2Tz3NBfY1mkF4xS2gxCzQoHNM4lyVLRwEb0I";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});