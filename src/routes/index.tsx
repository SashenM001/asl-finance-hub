import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isSupabaseConfigured } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (!isSupabaseConfigured()) {
      throw redirect({ to: "/login" });
    }

    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
    throw redirect({ to: "/overview" });
  },
});
