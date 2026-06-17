import Link from 'next/link';
import { getOptionalSession } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";

export const metadata = {
  title: 'GhostWriter AI – The writing platform for ambitious creators',
  description: 'The only AI writing tool that stays smart across your full novel. Deep character intelligence, 26 professional craft modes, surgical prose editing, and a direct pipeline to Higgsfield Original Series.',
};

export default async function Home() {
  const s = await getOptionalSession();
  if (s) redirect('/dashboard');

  return (
    <div style={{ background: '#0a0a0b', minHeight: '100vh', color: '#f2f2f3', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* Nav */}
      <nav style={{
        padding: '20px 40px', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(10,10,11,0.92)', backdropFilter: 'blur(12px)',
      }}>
        <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em' }}>GhostWriter AI</span>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <a href="#features" style={{ fontSize: 14, color: '#9898a6', textDecoration: 'none' }}>Features</a>
          <a href="#pricing" style={{ fontSize: 14, color: '#9898a6', textDecoration: 'none' }}>Pricing</a>
          <Link href="/login" style={{ fontSize: 14, color: '#9898a6', textDecoration: 'none' }}>Sign in</Link>
          <Link href="/login?register=1" style={{
            padding: '8px 20px', background: '#d97706', color: '#fff',
            borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none',
          }}>Start free →</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '100px 24px 80px', maxWidth: 800, margin: '0 auto' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '5px 16px', marginBottom: 32,
          background: 'rgba(217,119,6,0.12)', color: '#d97706',
          borderRadius: 20, fontSize: 12, fontWeight: 600, letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#d97706', display: 'inline-block' }} />
          Now live · 26 craft modes · 7-day free trial
        </div>
        <h1 style={{
          fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 800,
          letterSpacing: '-0.04em', lineHeight: 1.05, marginBottom: 28,
          color: '#f2f2f3',
        }}>
          The only AI writing tool<br />that remembers everything.
        </h1>
        <p style={{
          fontSize: 19, color: '#9898a6', lineHeight: 1.7, marginBottom: 44,
          maxWidth: 580, margin: '0 auto 44px',
        }}>
          World Bible that grows with every chapter. 26 professional craft modes.
          Surgical prose editing. A direct pipeline from story to Higgsfield screen.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/login?register=1" style={{
            display: 'inline-block', padding: '16px 40px',
            background: '#d97706', color: '#fff',
            borderRadius: 12, fontSize: 16, fontWeight: 700, textDecoration: 'none',
          }}>
            Start writing free →
          </Link>
          <a href="#features" style={{
            display: 'inline-block', padding: '16px 32px',
            background: 'transparent', color: '#9898a6',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, fontSize: 16, fontWeight: 600, textDecoration: 'none',
          }}>
            See features
          </a>
        </div>
        <p style={{ fontSize: 12, color: '#5c5c6b', marginTop: 16 }}>
          Free tier · No credit card required · Story Pro from ₹1,500/month
        </p>
      </section>

      {/* The Problem / Solution */}
      <section style={{
        padding: '60px 40px', maxWidth: 1000, margin: '0 auto',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24,
      }}>
        <div style={{ padding: 32, borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', background: '#111113' }}>
          <div style={{ fontSize: 12, color: '#f87171', fontWeight: 700, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Other AI writing tools</div>
          <p style={{ fontSize: 15, lineHeight: 1.8, color: '#9898a6' }}>
            Every session starts blank. You paste character descriptions again.
            The AI doesn't know about the betrayal in chapter 8. It has Mira act on
            information she shouldn't have. By chapter 20 you're spending more time
            re-explaining your story than writing it.
          </p>
        </div>
        <div style={{ padding: 32, borderRadius: 16, border: '1px solid #d97706', background: 'rgba(217,119,6,0.05)' }}>
          <div style={{ fontSize: 12, color: '#d97706', fontWeight: 700, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }}>GhostWriter</div>
          <p style={{ fontSize: 15, lineHeight: 1.8 }}>
            The World Bible accumulates. By chapter 15, the AI knows each character's
            physical tells, speech patterns, what they know and don't know. It tracks
            your story promises and doesn't let you forget them. Chapter 30 generates
            better than chapter 1 — automatically.
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ padding: '80px 40px', maxWidth: 1060, margin: '0 auto' }}>
        <h2 style={{ fontSize: 34, fontWeight: 700, textAlign: 'center', marginBottom: 16, letterSpacing: '-0.03em' }}>
          Everything a serious writer needs
        </h2>
        <p style={{ textAlign: 'center', color: '#9898a6', fontSize: 16, marginBottom: 56, maxWidth: 520, margin: '0 auto 56px' }}>
          Built for novelists, screenwriters, and creators who want craft depth — not autocomplete.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {[
            {
              icon: '🧠',
              title: 'Deep Character Intelligence',
              desc: 'NVC profiles, language fingerprints, flaw-strength triangles, knowledge states. The AI knows your characters as well as you do — their physical tells, speech registers, and what they refuse to acknowledge.',
              tag: null,
            },
            {
              icon: '📖',
              title: '26 Professional Craft Modes',
              desc: 'Combat built from biomechanical datasets. Horror from clinical psychology. Dialogue from Speech Act Theory. Three density levels — show 8 core modes or unlock all 26 specialist modes.',
              tag: null,
            },
            {
              icon: '✏️',
              title: 'Surgical Prose Editing',
              desc: 'Describe what to change in plain English — "make the third dialogue more tense" or "replace sword with dagger throughout" — and the AI finds the exact passage and shows you a red/green diff before applying.',
              tag: 'New',
            },
            {
              icon: '🔗',
              title: 'Story Continuity Engine',
              desc: 'Story promises tracked across chapters. Starvation warnings for character absences. An AI grader that catches rule violations and clichéd tells before you read the output.',
              tag: null,
            },
            {
              icon: '🏃',
              title: 'Sprint Mode with Goals',
              desc: 'Set a word-count goal (250 / 500 / 1000 / custom), watch a live progress bar, and get a completion banner when you hit it. Reset and go again — momentum is trackable.',
              tag: 'Updated',
            },
            {
              icon: '🎬',
              title: 'Higgsfield Series Pipeline',
              desc: 'Write your story in GhostWriter. Train Soul IDs from your characters. Generate production shots. Export a contest-ready package for Higgsfield Original Series. Story to screen in one platform.',
              tag: null,
            },
            {
              icon: '🩺',
              title: 'Story Health + Fix Weakness',
              desc: 'Scene validator, dead scene detector, tension curve, transportation check, manuscript audit. Every weakness item has a "Fix This" button that generates a targeted rewrite suggestion inline.',
              tag: 'Updated',
            },
            {
              icon: '🔗',
              title: 'Reader Sessions',
              desc: 'Share your draft with readers or beta readers via a private link. They read in a clean reader view and leave emoji reactions. You get a heatmap of which scenes they reacted to most.',
              tag: 'New',
            },
            {
              icon: '🤖',
              title: 'AI Initiative Control',
              desc: 'Set per-project how proactive the AI is. Leads mode auto-generates 4 seconds after a stage suggestion. Collaborates is standard. Assists hides the guide bar entirely for manual control.',
              tag: 'New',
            },
          ].map(f => (
            <div key={f.title} style={{
              padding: 28, borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.07)', background: '#111113',
              position: 'relative',
            }}>
              {f.tag && (
                <span style={{
                  position: 'absolute', top: 16, right: 16,
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
                  textTransform: 'uppercase', color: '#d97706',
                  background: 'rgba(217,119,6,0.12)', padding: '2px 8px', borderRadius: 20,
                }}>{f.tag}</span>
              )}
              <div style={{ fontSize: 28, marginBottom: 14 }}>{f.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, lineHeight: 1.3 }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: '#9898a6', lineHeight: 1.75 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Social proof strip */}
      <section style={{
        padding: '50px 40px', maxWidth: 1000, margin: '0 auto',
        display: 'flex', gap: 32, justifyContent: 'center', flexWrap: 'wrap',
      }}>
        {[
          { stat: '26', label: 'Craft modes' },
          { stat: '5', label: 'Writing stages' },
          { stat: '7-day', label: 'Free trial' },
          { stat: '100K+', label: 'Words supported' },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center', minWidth: 120 }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#d97706', letterSpacing: '-0.03em' }}>{s.stat}</div>
            <div style={{ fontSize: 13, color: '#9898a6', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ padding: '80px 40px', maxWidth: 1000, margin: '0 auto' }}>
        <h2 style={{ fontSize: 34, fontWeight: 700, textAlign: 'center', marginBottom: 12, letterSpacing: '-0.03em' }}>
          Simple pricing
        </h2>
        <p style={{ textAlign: 'center', color: '#9898a6', fontSize: 15, marginBottom: 52 }}>
          Every paid plan starts with a 7-day free trial. Cancel anytime.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            {
              name: 'Free',
              price: '₹0',
              period: ' forever',
              features: ['10 generations/month', 'Write, Brainstorm, Outline', '1 project', '7-day full trial on signup'],
              cta: 'Start free',
              highlighted: false,
              annualNote: null,
            },
            {
              name: 'Story Pro',
              price: '₹1,500',
              period: '/month',
              features: ['500 gen/month', 'All 26 craft modes', 'Full character intelligence', 'Quality grading', 'Manuscript export (DOCX/MD/TXT)', 'Fix Weakness · Surgical Edit', 'Series Bible'],
              cta: 'Start 7-day trial',
              highlighted: false,
              annualNote: '₹18,000/year',
            },
            {
              name: 'Creator Pro',
              price: '₹1,000',
              period: '/month',
              features: ['1,000 gen/month', 'Everything in Story Pro', 'Creator formats (YouTube, Podcast, TikTok)', 'Hook A/B · Retention Edit', 'Trend Intelligence', 'Channel Autopsy'],
              cta: 'Start 7-day trial',
              highlighted: true,
              annualNote: '₹12,000/year',
            },
            {
              name: 'All Access',
              price: '₹2,500',
              period: '/month',
              features: ['Unlimited generations', 'Everything in Creator Pro', 'Higgsfield pipeline', 'Comic Studio', 'Audio Novel + Lipsync', 'Priority generation'],
              cta: 'Start 7-day trial',
              highlighted: false,
              annualNote: '₹30,000/year',
            },
          ].map(plan => (
            <div key={plan.name} style={{
              padding: 24, borderRadius: 14,
              border: `1px solid ${plan.highlighted ? '#d97706' : 'rgba(255,255,255,0.07)'}`,
              background: plan.highlighted ? 'rgba(217,119,6,0.06)' : '#111113',
            }}>
              {plan.highlighted && (
                <div style={{
                  fontSize: 10, color: '#d97706', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10,
                }}>
                  Most popular
                </div>
              )}
              <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{plan.name}</div>
              <div style={{ marginBottom: plan.annualNote ? 4 : 18 }}>
                <span style={{ fontSize: 30, fontWeight: 800 }}>{plan.price}</span>
                <span style={{ fontSize: 13, color: '#9898a6' }}>{plan.period}</span>
              </div>
              {plan.annualNote && (
                <div style={{ fontSize: 11, color: '#9898a6', marginBottom: 16 }}>
                  or <span style={{ color: '#d97706' }}>{plan.annualNote}/year</span>
                </div>
              )}
              <ul style={{ listStyle: 'none', padding: 0, marginBottom: 20 }}>
                {plan.features.map(f => (
                  <li key={f} style={{
                    fontSize: 12, padding: '5px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    display: 'flex', gap: 8, alignItems: 'flex-start',
                    color: '#9898a6', lineHeight: 1.5,
                  }}>
                    <span style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link href="/login?register=1" style={{
                display: 'block', textAlign: 'center', padding: '10px',
                background: plan.highlighted ? '#d97706' : 'transparent',
                color: plan.highlighted ? '#fff' : '#f2f2f3',
                border: `1px solid ${plan.highlighted ? 'transparent' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none',
              }}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
        <p style={{ textAlign: 'center', fontSize: 12, color: '#5c5c6b', marginTop: 20 }}>
          All paid plans include a 7-day full-access trial. No credit card needed for free tier.
        </p>
      </section>

      {/* Final CTA */}
      <section style={{
        padding: '80px 40px', textAlign: 'center', maxWidth: 600, margin: '0 auto',
      }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 16 }}>
          Your story deserves better than autocomplete.
        </h2>
        <p style={{ color: '#9898a6', fontSize: 16, lineHeight: 1.7, marginBottom: 36 }}>
          Start with a free account. No credit card, no commitment.
          If you write more than 10 chapters, you'll never want to go back.
        </p>
        <Link href="/login?register=1" style={{
          display: 'inline-block', padding: '16px 48px',
          background: '#d97706', color: '#fff',
          borderRadius: 12, fontSize: 16, fontWeight: 700, textDecoration: 'none',
        }}>
          Start writing free →
        </Link>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '36px 40px', borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 16,
        fontSize: 12, color: '#5c5c6b',
      }}>
        <span>© 2026 GhostWriter AI · ghost-writer.cc</span>
        <div style={{ display: 'flex', gap: 24 }}>
          <a href="/terms" style={{ color: '#5c5c6b', textDecoration: 'none' }}>Terms</a>
          <a href="/privacy" style={{ color: '#5c5c6b', textDecoration: 'none' }}>Privacy</a>
          <a href="mailto:hello@ghost-writer.cc" style={{ color: '#5c5c6b', textDecoration: 'none' }}>Contact</a>
        </div>
      </footer>

    </div>
  );
}
