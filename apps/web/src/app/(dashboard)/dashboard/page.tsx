"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, TrendingUp, Award, Sparkles, Search, MessageSquare, Layers, FileCode, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { useProject } from "@/lib/use-project";
import { getVisibilityEvidence, type VisibilityScore, type VisibilityCheck } from "@/lib/visibility-evidence";

interface SuggestedPrompt {
  text: string;
  category: string;
  reason: string;
}

const VISIBILITY_MAX: VisibilityScore["max"] = {
  mention: 30,
  sentiment: 20,
  position: 20,
  citation: 15,
  reach: 15,
};

export default function DashboardPage() {
  const { projectId, loading: projectLoading } = useProject();
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState<VisibilityScore | null>(null);
  const [check, setCheck] = useState<VisibilityCheck | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedPrompt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const requestGeneration = useRef(0);
  const [dataProjectId, setDataProjectId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const generation = ++requestGeneration.current;
    if (!projectId) {
      setLoading(false);
      setScore(null);
      setCheck(null);
      setSuggestions([]);
      setError(null);
      setDataProjectId(null);
      return;
    }
    try {
      setLoading(true);
      setScore(null);
      setCheck(null);
      setSuggestions([]);
      setError(null);
      const [s, p, evidence] = await Promise.allSettled([
        apiFetch<VisibilityScore>(`/v1/analytics/${projectId}/visibility-score`),
        apiFetch<{ suggestions: SuggestedPrompt[] }>(`/v1/analytics/${projectId}/discover-prompts`),
        apiFetch<{ id: string }[]>(`/v1/checks/${projectId}`).then((checks) =>
          checks[0] ? apiFetch<VisibilityCheck>(`/v1/checks/${projectId}/${checks[0].id}`) : null
        ),
      ]);
      if (generation !== requestGeneration.current) return;
      if (s.status === 'fulfilled') setScore(s.value);
      if (p.status === 'fulfilled') setSuggestions(p.value.suggestions);
      if (evidence.status === 'fulfilled') setCheck(evidence.value);
      if (s.status === 'rejected' || evidence.status === 'rejected') {
        setError('Visibility evidence is unavailable. Try again later.');
      }
    } catch (err) {
      if (generation === requestGeneration.current) setError((err as Error).message);
    }
    finally {
      if (generation === requestGeneration.current) {
        setLoading(false);
        setDataProjectId(projectId);
      }
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  if (projectLoading || loading || dataProjectId !== projectId) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const evidence = getVisibilityEvidence(score, check);
  const measured = evidence.status !== "unknown";
  const gradeColor = !measured ? "text-muted-foreground" : score?.grade === 'A' ? 'text-green-500' : score?.grade === 'B' ? 'text-primary' : score?.grade === 'C' ? 'text-accent' : 'text-destructive';

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-4xl font-black tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground font-medium mt-1">AI visibility and source-backed brand signals.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-6 py-4 text-sm font-bold text-destructive shadow-sm">
          {error}
        </div>
      )}

      {/* Visibility Score */}
      <Card className="border-border/40 bg-card/50 backdrop-blur shadow-2xl shadow-primary/5 overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="pt-10 pb-10 relative">
            <div className="flex flex-col md:flex-row items-center gap-12">
              <div className="text-center md:border-r border-border/40 md:pr-12">
                <div className={`${measured ? "text-8xl" : "text-2xl"} font-black leading-none ${gradeColor} drop-shadow-sm`}>{measured ? score!.score : "Not measured"}</div>
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mt-4">Visibility Score</p>
                <Badge variant="outline" className={`mt-4 border-current font-black ${gradeColor} bg-current/5 px-4 py-1`}>{evidence.status === "complete" ? `Grade: ${score!.grade}` : evidence.status === "partial" ? "Partial evidence" : "Unknown"}</Badge>
              </div>
              <div className="flex-1 w-full space-y-5">
                <p className="text-xs text-muted-foreground">{evidence.message}</p>
                {Object.entries(score?.breakdown ?? { mention: 0, sentiment: 0, position: 0, citation: 0, reach: 0 }).map(([key, value]) => {
                  const metric = key as keyof VisibilityScore["max"];
                  const maximum = score?.max?.[metric] ?? VISIBILITY_MAX[metric];
                  return (
                    <div key={key} className="space-y-1.5">
                      <div className="flex justify-between items-end">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{key}</span>
                        <span className="text-xs font-bold">{measured ? `${value}/${maximum}` : "Not measured"}</span>
                      </div>
                      <div className="h-2.5 bg-muted/50 rounded-full overflow-hidden border border-border/10">
                        <div className="h-full bg-primary rounded-full shadow-[0_0_10px_rgba(var(--primary),0.3)]" style={{ width: `${measured ? (value / maximum) * 100 : 0}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-6 sm:grid-cols-3">
        {[
          { href: "/dashboard/mentions", icon: Search, title: "Run AI Check", desc: "Check platform mentions", color: "text-primary", bg: "bg-primary/5" },
          { href: "/dashboard/geo", icon: FileCode, title: "GEO Score", desc: "Optimization check", color: "text-accent", bg: "bg-accent/5" },
          { href: "/dashboard/social", icon: MessageSquare, title: "Signal Inbox", desc: "Review ranked evidence", color: "text-primary", bg: "bg-primary/5" }
        ].map((action, i) => (
          <Link key={i} href={action.href}>
            <Card className="hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 transition-all group cursor-pointer border-border/40 bg-card/50">
              <CardContent className="pt-8 pb-8 text-center">
                <div className={`w-14 h-14 rounded-2xl ${action.bg} flex items-center justify-center mx-auto mb-4 ${action.color} group-hover:scale-110 transition-transform shadow-sm`}>
                  <action.icon className="h-7 w-7" />
                </div>
                <p className="font-black text-lg">{action.title}</p>
                <p className="text-xs font-medium text-muted-foreground mt-1">{action.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Prompt Suggestions */}
      {suggestions.length > 0 && (
        <Card className="border-border/40 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black">
              <Sparkles className="h-6 w-6 text-accent" />
              Suggested Prompts
            </CardTitle>
            <CardDescription className="font-medium">
              AI-generated prompts tailored to your brand strategy.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {suggestions.slice(0, 6).map((s, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-border/40 bg-background/50 px-5 py-4 text-sm group hover:border-primary/30 transition-colors">
                  <div className="flex-1 flex items-center gap-4">
                    <span className="font-bold text-foreground">{s.text}</span>
                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter bg-primary/5 text-primary border-primary/10">{s.category}</Badge>
                  </div>
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">{s.reason}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
