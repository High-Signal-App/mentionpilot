"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "./api-client";

export interface Project {
  id: string;
  name: string;
  slug: string;
}

interface ProjectContextValue {
  projectId: string | null;
  project: Project | null;
  projects: Project[];
  loading: boolean;
  error: string | null;
  selectProject: (id: string) => void;
  createProject: (name: string) => Promise<void>;
  reloadProjects: () => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ ownerId, children }: { ownerId: string; children: ReactNode }) {
  const storageKey = `mentionpilot.active-project.${ownerId}`;
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const remember = useCallback((id: string) => {
    setProjectId(id);
    try { localStorage.setItem(storageKey, id); } catch { /* Selection still works when storage is unavailable. */ }
  }, [storageKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await apiFetch<{ projects: Project[] }>("/v1/projects");
        if (cancelled) return;
        let remembered: string | null = null;
        try { remembered = localStorage.getItem(storageKey); } catch { /* Use an owned fallback. */ }
        const selected = data.projects.find((p) => p.id === remembered) ?? data.projects[0];
        setProjects(data.projects);
        if (!selected) throw new Error("No project found. Reload your workspace to try again.");
        remember(selected.id);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [storageKey, remember, revision]);

  const selectProject = useCallback((id: string) => {
    if (projects.some((p) => p.id === id)) remember(id);
  }, [projects, remember]);

  const createProject = useCallback(async (name: string) => {
    const data = await apiFetch<{ project: Project }>("/v1/projects", {
      method: "POST", body: JSON.stringify({ name }),
    });
    setProjects((current) => [data.project, ...current]);
    remember(data.project.id);
  }, [remember]);

  return (
    <ProjectContext.Provider value={{
      projectId, project: projects.find((p) => p.id === projectId) ?? null,
      projects, loading, error, selectProject, createProject,
      reloadProjects: () => setRevision((current) => current + 1),
    }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) throw new Error("useProject must be used inside ProjectProvider");
  return context;
}

// Switching brands remounts every project-bound page. Pending work from the old
// page cannot publish its response or retain form state in the new case file.
export function ProjectContent({ children }: { children: ReactNode }) {
  const { projectId, project, loading, error, reloadProjects } = useProject();
  if (loading) return <p role="status">Opening your case files…</p>;
  if (error) return <div role="alert"><p>{error}</p><button className="mp-action" onClick={reloadProjects}>Try again</button></div>;
  if (!projectId) return null;
  return <div key={projectId} data-active-project={projectId}>
    <p className="mp-case-label">Case file / {project?.name}</p>
    {children}
  </div>;
}
