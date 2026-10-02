import Link from "next/link";
import { MentionPilotMark } from "@/components/mentionpilot-mark";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { headers } from "next/headers";
import { ProjectProvider, ProjectContent } from "@/lib/use-project";
import { ProjectNavigation } from "@/components/project-navigation";
import "./workspace.css";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  return <ProjectProvider key={session.user.id} ownerId={session.user.id}>
    <div className="mp-workspace">
      <aside className="mp-rail">
        <Link href="/dashboard" className="mp-wordmark"><span className="mp-mark"><MentionPilotMark /></span>MentionPilot</Link>
        <ProjectNavigation />
        <div className="mp-account">
          <p>{session.user.name}</p>
          <form action={async () => {
            "use server";
            const a = await getAuth();
            await a.api.signOut({ headers: await headers() });
            redirect("/");
          }}><button type="submit">Sign out</button></form>
        </div>
      </aside>
      <main className="mp-main"><ProjectContent>{children}</ProjectContent></main>
    </div>
  </ProjectProvider>;
}
