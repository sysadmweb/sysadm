import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/react-app/supabase";
import { useAuth } from "@/react-app/contexts/AuthContext";

type Perm = { can_view: boolean; can_create: boolean; can_update: boolean; can_delete: boolean };

export function usePermissions() {
  const { user } = useAuth();
  const [map, setMap] = useState<Record<string, Perm>>({});
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from("user_permissions")
        .select("page, can_view, can_create, can_update, can_delete")
        .eq("user_id", user.id)
        .eq("is_active", true);
      if (mounted) {
        if (!error && Array.isArray(data)) {
          const m: Record<string, Perm> = {};
          (data as { page: string; can_view: boolean; can_create: boolean; can_update: boolean; can_delete: boolean }[]).forEach((row) => {
            m[row.page] = {
              can_view: !!row.can_view,
              can_create: !!row.can_create,
              can_update: !!row.can_update,
              can_delete: !!row.can_delete,
            };
          });
          setMap(m);
        } else {
          setMap({});
        }
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [user]);

  const get = useMemo(() => {
    return (key: string): Perm => map[key] ?? { can_view: true, can_create: true, can_update: true, can_delete: true };
  }, [map]);
  return { get };
}

export function usePagePermissions(key: string) {
  const { get } = usePermissions();
  return get(key);
}