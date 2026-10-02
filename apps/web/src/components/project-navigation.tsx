"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProject } from "@/lib/use-project";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const navItems = [
  ["/dashboard", "Dashboard"], ["/dashboard/mentions", "AI Mentions"],
  ["/dashboard/social", "Signal Inbox"], ["/dashboard/settings", "Monitoring & Settings"],
  ["/dashboard/analytics", "Analytics"], ["/dashboard/geo", "GEO Tools"],
  ["/dashboard/axp", "AXP Shadow Site"], ["/dashboard/directories", "Submit Everywhere"],
] as const;

export function ProjectNavigation() {
  const { projectId, projects, loading, error, selectProject, createProject } = useProject();
  const pathname = usePathname();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setCreateError(null);
    try {
      await createProject(name.trim());
      setName("");
      setCreating(false);
    } catch (err) { setCreateError((err as Error).message); }
    finally { setSaving(false); }
  }

  return <>
    <div className="mp-project-control">
      <Label htmlFor="active-project" className="mp-case-label">Your case files</Label>
      <select id="active-project" value={projectId ?? ""} onChange={(event) => selectProject(event.target.value)} disabled={loading || !!error || saving}>
        {loading && <option value="">Opening projects…</option>}
        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      {!creating ? <Button variant="outline" disabled={loading || !!error} onClick={() => { setCreating(true); setCreateError(null); }}>+ New project</Button> :
        <form onSubmit={submit} className="mp-new-project">
          <Label htmlFor="project-name">Project name</Label>
          <Input id="project-name" value={name} maxLength={120} required autoFocus disabled={saving} onChange={(event) => setName(event.target.value)} placeholder="e.g. StorageDaddy" />
          {createError && <p role="alert" className="mp-error">{createError}</p>}
          <div className="flex flex-wrap gap-2"><Button type="submit" disabled={saving || !name.trim()}>{saving ? "Creating…" : "Create project"}</Button><Button type="button" variant="ghost" disabled={saving} onClick={() => setCreating(false)}>Cancel</Button></div>
        </form>
      }
    </div>
    <details className="mp-mobile-nav"><summary>Workspace navigation</summary><nav aria-label="Workspace">{navItems.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>)}</nav></details>
    <nav className="mp-desktop-nav" aria-label="Workspace">{navItems.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>)}</nav>
  </>;
}
