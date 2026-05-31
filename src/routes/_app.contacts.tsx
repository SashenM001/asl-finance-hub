import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Phone } from "lucide-react";

export const Route = createFileRoute("/_app/contacts")({
  component: ContactsPage,
});

const CONTACTS = [
  { role: "MCVP Finance & Legal", name: "Agana", email: "agana.dassanayake@aiesec.net", phone: "+94 77 514 0747" },
  { role: "MCVP Information Management", name: "Dinuka", email: "dinuka.avinash@aiesec.net", phone: "+94 77 548 6820" },
  { role: "EFB Chair", name: "Tanuri", email: "tanuri.chandrasiri@aiesec.net", phone: "+94 76 977 9699" },
  { role: "EFB Tech Support", name: "Gagana", email: "gaganaushan@aiesec.net", phone: "+94 77 365 0313" },
  { role: "EFB Finance Support", name: "Thisura", email: "thisura.daksina@aiesec.net", phone: "+94 71 679 3977" },
  { role: "</Dev.Team> Support", name: "Amzal", email: "amzal.foumi@aiesec.net", phone: "+94 70 158 8018" },
];

function ContactsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Help &amp; Contacts</h2>
        <p className="text-sm text-muted-foreground">Key finance roles in AIESEC Sri Lanka.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {CONTACTS.map((c) => (
          <Card key={c.role}>
            <CardHeader>
              <CardTitle className="text-base">{c.role}</CardTitle>
              <p className="text-sm text-muted-foreground">{c.name}</p>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <a className="flex items-center gap-2 text-foreground hover:text-primary" href={`mailto:${c.email}`}><Mail className="h-4 w-4" />{c.email}</a>
              <a className="flex items-center gap-2 text-foreground hover:text-primary" href={`tel:${c.phone}`}><Phone className="h-4 w-4" />{c.phone}</a>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* <Card>
        <CardHeader><CardTitle className="text-base">About roles</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p><strong className="text-foreground">LC user</strong> — LCVP Finance &amp; Legal / LCP. Sees only their own entity's data.</p>
          <p><strong className="text-foreground">MC user</strong> — MCVP FnL / MCVP IM / MCP. Full national visibility &amp; admin.</p>
          <p><strong className="text-foreground">EFB user</strong> — Audit role. Read-only across all entities, can record audit scores and reviews.</p>
        </CardContent>
      </Card> */}
    </div>
  );
}
