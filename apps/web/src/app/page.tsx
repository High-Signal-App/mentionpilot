import { MentionPilotMark } from "@/components/mentionpilot-mark";
import { SaaSMakerFeedback } from "@/components/saasmaker-feedback";
import { FooterStudioFocus } from "@/components/footer-studio-focus";
import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "MentionPilot — See how AI describes your brand",
  description:
    "Inspect the prompts, answers, citations, and competitive context behind your brand's visibility in AI assistants.",
  alternates: { canonical: "/" },
};

const retainedEvidence = [
  {
    number: "01",
    title: "The exact question",
    body: "Keep the prompt that produced the result, not a paraphrased category label.",
  },
  {
    number: "02",
    title: "The answer in context",
    body: "Read the complete response and see where your brand appears beside alternatives.",
  },
  {
    number: "03",
    title: "Sources and timing",
    body: "Retain citations, provider status, check time, and explicit coverage limits.",
  },
  {
    number: "04",
    title: "The next useful move",
    body: "Turn a narrative gap into a sourced page, proof point, or follow-up task.",
  },
];

const workflow = [
  {
    index: "1",
    title: "Ask the questions buyers ask",
    body: "Define your brand, competitors, topics, and the discovery questions that matter to your market.",
    note: "Prompt set retained",
  },
  {
    index: "2",
    title: "Inspect every observed answer",
    body: "Compare successful checks across configured assistants without treating provider failures as negative mentions.",
    note: "Coverage stays explicit",
  },
  {
    index: "3",
    title: "Find the narrative gap",
    body: "See which competitors are recommended, what evidence supports them, and where your own story is thin.",
    note: "Evidence before score",
  },
  {
    index: "4",
    title: "Change the source material",
    body: "Improve comparison pages, proof, FAQs, schema, or canonical summaries—then return to the same question.",
    note: "Action linked to finding",
  },
];


function Arrow() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true">
      <path d="M3 9h11M10 5l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function SourceMark() {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true">
      <path d="M5 8.5h18M5 14h12M5 19.5h15" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="22" cy="19.5" r="3.25" fill="var(--paper)" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand} aria-label="MentionPilot home">
            <span className={styles.mark}><MentionPilotMark /></span>
            <span>MentionPilot</span>
          </Link>
          <nav className={styles.nav} aria-label="Primary navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#evidence">Evidence</a>
            <Link href="/blog">Research</Link>
          </nav>
          <div className={styles.headerActions}>
            <Link href="/login" className={styles.signIn} data-app-health-event="workspace.sign_in.opened">Sign in</Link>
            <Link href="/check" className={styles.headerCta} data-app-health-event="free_check.opened">Free brand check</Link>
          </div>
        </div>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroIntro}>
            <p className={styles.eyebrow}>
              <span>AI brand intelligence</span>
              <span>Evidence retained</span>
            </p>
            <h1>See how AI describes your brand—and why.</h1>
            <p className={styles.heroCopy}>
              MentionPilot shows founders and marketing teams the answers behind AI visibility, the competitors shaping the narrative, and the source gaps worth fixing next.
            </p>
            <div className={styles.heroActions}>
              <Link href="/check" className={styles.primaryCta} data-app-health-event="free_check.opened">
                Run a free brand check <Arrow />
              </Link>
              <Link href="/login" className={styles.textCta} data-app-health-event="workspace.sign_in.opened">
                Open the workspace <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <p className={styles.heroFootnote}>
              No signup for the first check. The observed answer stays visible behind the result.
            </p>
          </div>

          <div className={styles.heroEvidence}>
            <div className={styles.paperShadow} aria-hidden="true" />
            <article className={styles.evidenceSheet} aria-label="Illustrative MentionPilot evidence record">
              <div className={styles.sheetHeader}>
                <div>
                  <p className={styles.docLabel}>Observed answer / 04</p>
                  <p className={styles.docId}>MP—QUESTION—0042</p>
                </div>
                <span className={styles.demoStamp}>Illustrative record</span>
              </div>

              <div className={styles.questionBlock}>
                <span>Discovery question</span>
                <p>“What tools help a SaaS team understand how AI assistants recommend its product?”</p>
              </div>

              <div className={styles.answerBlock}>
                <div className={styles.providerLine}>
                  <span className={styles.providerDot} />
                  <strong>Configured assistant</strong>
                  <span>successful check</span>
                </div>
                <p>
                  Teams can use specialised AI visibility tools to track whether a product is named, which alternatives appear beside it, and what source material seems to support the answer.
                </p>
                <p className={styles.highlightedLine}>
                  MentionPilot keeps the prompt, answer, citations, and competitive position together for later review.
                </p>
              </div>

              <div className={styles.marginNote}>
                <span>Why this matters</span>
                The claim can be inspected, compared, and checked again.
              </div>

              <div className={styles.receipt}>
                <SourceMark />
                <div>
                  <span>Source receipt</span>
                  <strong>1 answer · 3 citations · complete</strong>
                </div>
                <time dateTime="2026-09-14T14:12:00+05:30">14 SEP · 14:12 IST</time>
              </div>
            </article>
          </div>
        </section>

        <section className={styles.proofStrip} aria-label="Product proof">
          <p>Not another visibility score.</p>
          <div className={styles.proofRule} />
          <p>Every result opens back into its evidence.</p>
        </section>

        <section className={styles.evidenceSection} id="evidence">
          <div className={styles.sectionLead}>
            <p className={styles.sectionIndex}>01 / Evidence, not theatre</p>
            <h2>A result you can interrogate.</h2>
            <p>
              Scores make change easy to track. Evidence makes the score useful. MentionPilot keeps the material you need to understand what happened and decide what to do.
            </p>
          </div>
          <div className={styles.ledger}>
            {retainedEvidence.map((item) => (
              <article key={item.number} className={styles.ledgerRow}>
                <span className={styles.ledgerNumber}>{item.number}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                <span className={styles.ledgerTick} aria-hidden="true">✓</span>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.workflowSection} id="how-it-works">
          <div className={styles.workflowIntro}>
            <p className={styles.sectionIndex}>02 / Working method</p>
            <h2>Follow the answer back to the source.</h2>
            <p>
              MentionPilot connects monitoring and improvement in one repeatable loop, without hiding failed checks or pretending a heuristic is a fact.
            </p>
            <div className={styles.pencilNote}>
              <span aria-hidden="true">↳</span>
              The goal is a better answer, not a prettier chart.
            </div>
          </div>
          <ol className={styles.workflowList}>
            {workflow.map((item) => (
              <li key={item.index}>
                <span className={styles.workflowNumber}>{item.index}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
                <span className={styles.workflowNote}>{item.note}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.caseSection}>
          <div className={styles.caseGrid}>
            <div className={styles.caseStatement}>
              <p className={styles.sectionIndex}>03 / One signal room</p>
              <blockquote>
                “Your brand story is already being assembled from evidence across the web. The question is whether you can see the assembly.”
              </blockquote>
            </div>
            <div className={styles.caseFile}>
              <div className={styles.caseTab}>CASE / SOURCE READINESS</div>
              <div className={styles.caseTopline}>
                <div>
                  <span>Finding</span>
                  <strong>Competitors have clearer comparison evidence</strong>
                </div>
                <span className={styles.openStatus}>Open</span>
              </div>
              <div className={styles.caseBody}>
                <div>
                  <span className={styles.caseLabel}>Observed pattern</span>
                  <p>Alternative products appear with specific use cases; this brand appears only in broad category language.</p>
                </div>
                <div>
                  <span className={styles.caseLabel}>Suggested move</span>
                  <p>Publish one sourced comparison page that states who the product is for, where it differs, and what proof supports the distinction.</p>
                </div>
              </div>
              <div className={styles.caseFooter}>
                <span>Heuristic recommendation</span>
                <span>Evidence attached · history retained</span>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.scopeSection}>
          <div className={styles.scopeHeader}>
            <p className={styles.sectionIndex}>04 / What the workspace connects</p>
            <h2>Assistant answers in. Defensible action out.</h2>
          </div>
          <div className={styles.scopeColumns}>
            <article>
              <span className={styles.scopeNumber}>A</span>
              <h3>AI answer evidence</h3>
              <p>Track prompts, responses, citations, provider status, mention position, and changes over time across the assistants you configure.</p>
              <ul>
                <li>Exact response retained</li>
                <li>Failures remain explicit</li>
                <li>Competitors compared in context</li>
              </ul>
            </article>
            <article>
              <span className={styles.scopeNumber}>B</span>
              <h3>Source-readiness work</h3>
              <p>Connect observed narrative gaps to better canonical summaries, FAQs, proof, structured data, comparisons, and follow-up tasks.</p>
              <ul>
                <li>Heuristics clearly labelled</li>
                <li>Evidence attached to tasks</li>
                <li>Social findings link to source</li>
              </ul>
            </article>
          </div>
        </section>

        <section className={styles.finalSection}>
          <div className={styles.finalGrid}>
            <div>
              <p className={styles.finalEyebrow}>Your first case file is free</p>
              <h2>Bring the brand question you cannot answer from a chart.</h2>
            </div>
            <div className={styles.finalAction}>
              <p>Run a public check, inspect the underlying answer, and decide whether the ongoing workspace earns a place in your process.</p>
              <Link href="/check" className={styles.finalCta} data-app-health-event="free_check.opened">
                Check your brand <Arrow />
              </Link>
              <span>No signup required for the first check.</span>
            </div>
          </div>
          <div className={styles.finalMark} aria-hidden="true"><MentionPilotMark /></div>
        </section>
      </main>

      <footer className={styles.footer} aria-label="MentionPilot footer">
        <fleet-footer-extension
          className={styles.footerExtension}
          data-fleet-footer-project="mentionpilot"
          product-name="MentionPilot"
          theme="dark"
          surface="web"
          signature-font="inherit"
          font-base="/fonts/fleet-footer-precise-v1/"
          art-src="/footer-art/mentionpilot-precise-v1.webp"
          art-alt="An editorial research desk with two evidence trays, source sheets, and a central notebook marked with coral annotations."
          art-width="2172"
          art-height="724"
          art-position="50% 58%"
          art-credit="Original illustration for MentionPilot"
        >
          <Link slot="cta" data-fleet-footer-cta href="/check" data-app-health-event="free_check.opened">Free check</Link>
          <div slot="navigation" data-fleet-footer-navigation className={styles.footerNavigation}>
            <nav className={styles.footerLinks} aria-label="Footer navigation">
              <Link href="/" className={styles.footerBrand}>MentionPilot</Link>
              <Link href="/blog">Research</Link>
              <Link href="/login" data-app-health-event="workspace.sign_in.opened">Sign in</Link>
            </nav>
            <p className={styles.footerTagline}>Evidence-first brand intelligence for AI assistants.</p>
            <p className={styles.footerPrivacy}>
              App Health measures public page views and named actions using first-party anonymous browser IDs for up to 90 days. See the <a href="https://sassmaker.com/privacy">privacy policy</a>.
            </p>
          </div>
          <SaaSMakerFeedback embedded />
          <saas-maker-newsletter-capture
            slot="capture"
            product-name="MentionPilot"
            catalog-id="mentionpilot"
            kind="newsletter"
            source="footer"
            privacy-url="https://sassmaker.com/privacy"
            theme="dark"
            layout="compact"
            integrated=""
          ></saas-maker-newsletter-capture>
        </fleet-footer-extension>
        <FooterStudioFocus />
      </footer>
      <script src="https://sassmaker.com/project-strip.js?v=precise-b0adaa67" data-project="mentionpilot" data-theme="dark" data-host-only="true" defer />
      <script src="https://sassmaker.com/ai-chat-footer.js?v=precise-b0adaa67" data-project="mentionpilot" data-name="MentionPilot" data-theme="dark" data-surface="web" data-host-only="true" data-capture="false" data-feedback="false" defer />
      <script type="module" src="https://sassmaker.com/newsletter-capture.js?v=precise-b0adaa67" />
    </div>
  );
}
