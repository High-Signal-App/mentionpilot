import Link from "next/link";
import { Search, Shield, Code, FileText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const tools = [
  {
    title: "Free AI Brand Check",
    description: "See if AI assistants mention your product. No signup required.",
    icon: Search,
    href: "/check",
    cta: "Check Now",
  },
  {
    title: "GEO Score Checker",
    description: "Analyze your page's optimization for AI citation. Get a score 0-100.",
    icon: Code,
    href: "/dashboard/geo",
    cta: "Check Score",
  },
  {
    title: "AI Crawlability Checker",
    description: "Verify if GPTBot, ClaudeBot, and other AI crawlers can access your site.",
    icon: Shield,
    href: "/dashboard/geo",
    cta: "Check Access",
  },
  {
    title: "llms.txt Generator",
    description: "Auto-generate an llms.txt file to help AI crawlers understand your product.",
    icon: FileText,
    href: "/dashboard/geo",
    cta: "Generate",
  },
];

export default function ToolsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="text-center space-y-4 mb-12">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            MentionPilot
          </Link>
          <h1 className="text-4xl font-bold tracking-tight">Free AI Visibility Tools</h1>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            Check, analyze, and optimize how AI assistants see your brand. The brand check needs no signup. GEO, crawlability, and llms.txt tools require a free account.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {tools.map((tool) => (
            <Link key={tool.title} href={tool.href}>
              <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader>
                  <tool.icon className="h-8 w-8 mb-2 text-primary" />
                  <CardTitle>{tool.title}</CardTitle>
                  <CardDescription>{tool.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline">{tool.cta}</Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-muted-foreground mb-4">Want continuous monitoring and optimization?</p>
          <Link href="/dashboard">
            <Button size="lg">Get Started Free</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
