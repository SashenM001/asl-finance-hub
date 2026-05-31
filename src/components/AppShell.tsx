import { Link, Outlet, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Building2, Target, TrendingUp, ShieldCheck, ClipboardCheck, Users, LogOut, Wallet } from "lucide-react";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/lc", label: "LC Dashboard", icon: Building2 },
  { to: "/budget", label: "Budget vs Actual", icon: Target },
  // { to: "/performance", label: "Performance", icon: TrendingUp },
  { to: "/audit", label: "EFB Audit", icon: ShieldCheck },
  { to: "/review", label: "Monthly Review", icon: ClipboardCheck },
  { to: "/contacts", label: "Help & Contacts", icon: Users },
] as const;

export function AppShell() {
  const { user, profile, roles, signOut, isMC } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-card md:flex">
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg p-1">
            <img src="/AIESEC-Human-White.png" alt="AIESEC Logo" className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">ASL Finance Dashboard</div>
            {/* <div className="text-xs text-muted-foreground">Finance</div> */}
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                activeProps={{ className: "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium bg-primary/10 text-primary" }}
                activeOptions={{ exact: item.to === "/" }}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          {isMC && (
            <Link
              to="/admin"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              activeProps={{ className: "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium bg-primary/10 text-primary" }}
            >
              <ShieldCheck className="h-4 w-4" />
              Admin
            </Link>
          )}
        </nav>
        <div className="border-t p-3">
          <div className="px-2 pb-2 text-xs">
            <div className="truncate font-medium">{profile?.full_name || user?.email}</div>
            <div className="text-muted-foreground">{roles.join(", ") || "no role"}</div>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={handleSignOut}>
            <LogOut className="mr-2 h-3 w-3" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="md:pl-60">
        <header className="flex h-16 items-center justify-between border-b bg-card px-4 md:px-8">
          <h1 className="text-lg font-semibold"></h1>  {/*Yes, keep this. trust me*/ }
          <div className="text-xs text-muted-foreground">
            {roles.includes("mc_user") && "National view"}
            {roles.includes("efb_user") && !roles.includes("mc_user") && "Audit (read-only)"}
            {roles.includes("lc_user") && !roles.includes("mc_user") && !roles.includes("efb_user") && "Local Committee view"}
          </div>
        </header>
        <main className="p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
