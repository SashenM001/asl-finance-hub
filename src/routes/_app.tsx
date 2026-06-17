import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { isSupabaseConfigured } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <div className="max-w-lg rounded-lg border bg-card p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold">Deployment misconfiguration</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This deployment is missing Supabase env vars. Set VITE_SUPABASE_URL and
            VITE_SUPABASE_PUBLISHABLE_KEY in deployment before using the app.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

function Gate() {
  const { loading, user, roles } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login", search: { redirect: window.location.pathname } as never });
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Redirecting to login…
      </div>
    );
  }

  if (roles.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-lg border bg-card p-6 text-center">
          <h2 className="text-lg font-semibold">No role assigned</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account doesn't have a role yet. Please contact an MC administrator to assign you a
            role (LC, MC, or EFB) and an entity if you're an LC user.
          </p>
        </div>
      </div>
    );
  }

  return <AppShell />;
}
