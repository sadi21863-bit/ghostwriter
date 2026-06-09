import Link from 'next/link';
import { getOptionalSession } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";

export const metadata = {
  title: 'GhostWriter AI – The writing platform for ambitious creators',
  description: 'The only writing tool that stays smart across your full novel. Deep character intelligence, professional craft libraries, and a direct pipeline to Higgsfield Original Series.',
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
      }}>
        <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em' }}>GhostWriter AI</span>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <a href="#pricing" style={{ fontSize: 14, color: '#9898a6', textDecoration: 'none' }}>Pricing</a>
          <Link href="/login" style={{ fontSize: 14, color: '#9898a6', textDecoration: 'none' }}>Sign in</Link>
          <Link href="/login?register=1" style={{
            padding: '8px 20px', background: '#d97706', color: '#fff',
            borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none',
          }}>Start free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '100px 24px 80px', maxWidth: 760, margin: '0 auto' }}>
        <div style={{
          display: 'inline-block', padding: '4px 14px', marginBottom: 28,
          background: 'rgba(217,119,6,0.12)', color: '#d97706',
          borderRadius: 20, fontSize: 12, fontWeight: 600, letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          Story format + Higgsfield Original Series pipeline
        </div>
        <h1 style={{
          fontSize: 'clamp(36px, 6vw, 60px)', fontWeight: 800,
          letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: 24,
          color: '#f2f2f3',
        }}>
          The only writing tool<br />that stays smart across<br />your full novel.
        </h1>
        <p style={{
          fontSize: 18, color: '#9898a6', lineHeight: 1.7, marginBottom: 40,
          maxWidth: 560, margin: '0 auto 40px',
        }}>
          Other tools forget after one session. GhostWriter builds a World Bible
          that makes every generation smarter — from chapter 1 to chapter 60.
        </p>
        <Link href="/login?register=1" style={{
          display: 'inline-block', padding: '16px 40px',
          background: '#d97706', color: '#fff',
          borderRadius: 12, fontSize: 16, fontWeight: 700, textDecoration: 'none',
        }}>
          Start writing free →
        </Link>
        <p style={{ fontSize: 12, color: '#5c5c6b', marginTop: 14 }}>
          Free tier · No credit card required · Story Pro from ₹1,500/month
        </p>
      </section>

      {/* The Problem */}
      <section style={{
        padding: '80px 40px', maxWidth: 1000, margin: '0 auto',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32,
      }}>
        <div style={{ padding: 32, borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', background: '#111113' }}>
          <div style={{ fontSize: 13, color: '#f87171', fontWeight: 600, marginBottom: 14 }}>Other AI tools</div>
          <p style={{ fontSize: 15, lineHeight: 1.75, color: '#9898a6' }}>
            Every session starts blank. You paste your character descriptions again.
            The AI doesn't know about the betrayal in chapter 8. It has Mira act on
            information she shouldn't have. By chapter 20, you're spending more time
            re-explaining your story than writing it.
          </p>
        </div>
        <div style={{ padding: 32, borderRadius: 16, border: '1px solid #d97706', background: 'rgba(217,119,6,0.06)' }}>
          <div style={{ fontSize: 13, color: '#d97706', fontWeight: 600, marginBottom: 14 }}>GhostWriter</div>
          <p style={{ fontSize: 15, lineHeight: 1.75 }}>
            The World Bible accumulates. By chapter 15, the AI knows each character's
            physical tells, speech patterns, what they know and don't know. It tracks
            your story promises and doesn't let you forget them. Chapter 30 generates
            better than chapter 1 — automatically.
          </p>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '80px 40px', maxWidth: 1000, margin: '0 auto' }}>
        <h2 style={{ fontSize: 32, fontWeight: 700, textAlign: 'center', marginBottom: 56, letterSpacing: '-0.03em' }}>
          Everything a serious writer needs
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
          {[
            {
              title: 'Deep Character Intelligence',
              desc: 'NVC cards, language profiles, flaw-strength triangles, knowledge states — the AI knows your characters as well as you do. Their physical tells, speech patterns, and what they know vs. what they refuse to know.',
              icon: '🧠',
            },
            {
              title: '20 Professional Craft Libraries',
              desc: 'Combat choreography built from biomechanical datasets. Emotional scenes grounded in FACS muscle groups. Horror, atmosphere, tension, dialogue — each mode has research-level depth behind every directive.',
              icon: '📖',
            },
            {
              title: 'Story Continuity Engine',
              desc: 'Story promises, plot thread tracking, starvation warnings. An AI self-grader that catches rule violations and slop before you read the output. Your story stays consistent across 100,000 words.',
              icon: '🔗',
            },
            {
              title: 'Higgsfield Series Pipeline',
              desc: 'Write your story in GhostWriter. Train Soul IDs from your characters. Generate production shots. Export a contest-ready package for Higgsfield Original Series. Story to screen in one platform.',
              icon: '🎬',
            },
          ].map(f => (
            <div key={f.title} style={{
              padding: 32, borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.06)', background: '#111113',
            }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: '#9898a6', lineHeight: 1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" style={{ padding: '80px 40px', maxWidth: 900, margin: '0 auto' }}>
        <h2 style={{ fontSize: 32, fontWeight: 700, textAlign: 'center', marginBottom: 56, letterSpacing: '-0.03em' }}>
          Simple pricing
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {[
            {
              name: 'Free', price: '$0', period: ' forever',
              features: ['10 generations/month', 'Write, Brainstorm, Outline', '1 project · 2 characters', '7-day full trial on signup'],
              cta: 'Start free', highlighted: false, annualNote: null,
            },
            {
              name: 'Story Pro', price: '₹1,500', period: '/month',
              features: ['500 generations/month', 'All 26 writing modes', 'Full character intelligence', 'Quality grading', 'Manuscript export (DOCX/PDF/EPUB)', 'Series Bible'],
              cta: 'Start 7-day trial', highlighted: true, annualNote: 'or ₹14,400/year',
            },
            {
              name: 'All Access', price: '₹2,500', period: '/month',
              features: ['Unlimited generations', 'Everything in Story Pro', 'Creator formats', 'Higgsfield pipeline', 'Comic Studio · Audio Novel', 'Priority generation'],
              cta: 'Start 7-day trial', highlighted: false, annualNote: 'or ₹24,000/year',
            },
          ].map(plan => (
            <div key={plan.name} style={{
              padding: 28, borderRadius: 16,
              border: `1px solid ${plan.highlighted ? '#d97706' : 'rgba(255,255,255,0.06)'}`,
              background: plan.highlighted ? 'rgba(217,119,6,0.06)' : '#111113',
            }}>
              {plan.highlighted && (
                <div style={{
                  fontSize: 11, color: '#d97706', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12,
                }}>
                  Most popular
                </div>
              )}
              <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{plan.name}</div>
              <div style={{ marginBottom: plan.annualNote ? 6 : 22 }}>
                <span style={{ fontSize: 34, fontWeight: 800 }}>{plan.price}</span>
                <span style={{ fontSize: 14, color: '#9898a6' }}>{plan.period}</span>
              </div>
              {plan.annualNote && (
                <div style={{ fontSize: 11, color: '#9898a6', marginBottom: 16 }}>
                  {plan.annualNote} <span style={{ color: '#d97706' }}>— save 20%</span>
                </div>
              )}
              <ul style={{ listStyle: 'none', padding: 0, marginBottom: 24 }}>
                {plan.features.map(f => (
                  <li key={f} style={{
                    fontSize: 13, padding: '7px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex', gap: 8, alignItems: 'center',
                    color: '#9898a6',
                  }}>
                    <span style={{ color: '#d97706', flexShrink: 0 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link href="/login?register=1" style={{
                display: 'block', textAlign: 'center', padding: '11px',
                background: plan.highlighted ? '#d97706' : 'transparent',
                color: plan.highlighted ? '#fff' : '#f2f2f3',
                border: `1px solid ${plan.highlighted ? 'transparent' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none',
              }}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
        <p style={{ textAlign: 'center', fontSize: 12, color: '#5c5c6b', marginTop: 20 }}>
          Annual billing available — save 20%. Cancel anytime.
        </p>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '36px 40px', borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 12, color: '#5c5c6b',
      }}>
        <span>© 2026 GhostWriter AI</span>
        <div style={{ display: 'flex', gap: 24 }}>
          <a href="/terms" style={{ color: '#5c5c6b', textDecoration: 'none' }}>Terms</a>
          <a href="/privacy" style={{ color: '#5c5c6b', textDecoration: 'none' }}>Privacy</a>
          <a href="mailto:hello@ghost-writer.cc" style={{ color: '#5c5c6b', textDecoration: 'none' }}>Contact</a>
        </div>
      </footer>

    </div>
  );
}
