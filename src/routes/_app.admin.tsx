import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { fetchEntities, type Entity } from "@/lib/finance";
import { useAuth, type AppRole } from "@/lib/auth";
import { useSheetSync } from "@/hooks/useSheetSync";
import { AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.session.user.id);
    const isMC = (roles ?? []).some((r) => r.role === "mc_user");
    if (!isMC) throw redirect({ to: "/overview" });
  },
  component: AdminPage,
});

interface UserRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  entity_id: string | null;
  role: AppRole | null;
}

function AdminPage() {
  const { user } = useAuth();
  const { sync, loading, result, error } = useSheetSync();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  const load = async () => {
    setPageLoading(true);
    const [e, p, r] = await Promise.all([
      fetchEntities(),
      supabase.from("profiles").select("user_id,full_name,email,entity_id"),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    setEntities(e);
    const profiles = (p.data ?? []) as { user_id: string; full_name: string | null; email: string | null; entity_id: string | null }[];
    const rolesByUser = new Map<string, AppRole>();
    ((r.data ?? []) as { user_id: string; role: AppRole }[]).forEach((x) => rolesByUser.set(x.user_id, x.role));
    setUsers(profiles.map((p) => ({ ...p, role: rolesByUser.get(p.user_id) ?? null })));
    setPageLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSync = async () => {
    await sync();
    toast.success("Google Sheets sync completed! Check results below.");
    // Optionally reload data after sync
    setTimeout(() => load(), 1000);
  };

  const setRole = async (uid: string, role: AppRole) => {
    // Remove existing roles, then insert new
    await supabase.from("user_roles").delete().eq("user_id", uid);
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role });
    if (error) toast.error(error.message); else { toast.success("Role updated"); load(); }
  };

  const setEntity = async (uid: string, entity_id: string | null) => {
    const { error } = await supabase.from("profiles").update({ entity_id }).eq("user_id", uid);
    if (error) toast.error(error.message); else { toast.success("Entity updated"); load(); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Admin — Users &amp; Roles</h2>
        <p className="text-sm text-muted-foreground">Assign roles and entities. Only MC users see this page.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">All users ({users.length})</CardTitle></CardHeader>
        <CardContent>
          {pageLoading ? <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Entity (LC only)</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell>{u.full_name ?? "—"}{u.user_id === user?.id && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Select value={u.role ?? ""} onValueChange={(v) => setRole(u.user_id, v as AppRole)}>
                        <SelectTrigger className="w-40"><SelectValue placeholder="No role" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lc_user">LC user</SelectItem>
                          <SelectItem value="mc_user">MC user</SelectItem>
                          <SelectItem value="efb_user">EFB user</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select value={u.entity_id ?? "none"} onValueChange={(v) => setEntity(u.user_id, v === "none" ? null : v)}>
                        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— None —</SelectItem>
                          {entities.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Google Sheets Sync</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Automatically fetch and sync financial data from Google Sheets. Requires <code className="text-xs bg-muted px-2 py-1 rounded">VITE_GOOGLE_SHEETS_API_KEY</code> in .env
          </p>
          
          <Button 
            onClick={handleSync} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Clock className="mr-2 h-4 w-4 animate-spin" />
                Syncing…
              </>
            ) : (
              "Sync from Google Sheets"
            )}
          </Button>

          {result && (
            <Alert variant={result.success ? "default" : "destructive"}>
              <div className="flex gap-2 items-start">
                {result.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="h-4 w-4 mt-0.5" />
                )}
                <div className="space-y-1 flex-1">
                  <AlertDescription className="font-semibold">{result.message}</AlertDescription>
                  {result.metricsInserted > 0 && (
                    <AlertDescription className="text-xs">
                      📊 {result.metricsInserted} metrics
                    </AlertDescription>
                  )}
                  {result.revenueInserted > 0 && (
                    <AlertDescription className="text-xs">
                      💰 {result.revenueInserted} revenue entries
                    </AlertDescription>
                  )}
                  {result.costInserted > 0 && (
                    <AlertDescription className="text-xs">
                      📉 {result.costInserted} cost entries
                    </AlertDescription>
                  )}
                  {result.errors.length > 0 && (
                    <AlertDescription className="text-xs">
                      ⚠️ {result.errors.length} error(s): {result.errors.join("; ")}
                    </AlertDescription>
                  )}
                </div>
              </div>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">How invites work</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>New users sign up themselves at the login page. After signup they appear here with no role — assign them an LC/MC/EFB role and (for LC) an entity.</p>
          <Button variant="outline" onClick={load}>Refresh list</Button>
        </CardContent>
      </Card>
    </div>
  );
}
