export const metadata = { title: 'Terms of Service – GhostWriter AI' };

const h2Style = { fontSize: 20, fontWeight: 700, marginBottom: 12, marginTop: 32, color: '#f2f2f3' } as const;
const pStyle  = { fontSize: 15, lineHeight: 1.8, color: '#9898a6', marginBottom: 0 } as const;

export default function TermsPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 24px',
                  fontFamily: 'Georgia, serif', color: '#f2f2f3',
                  background: '#0a0a0b', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Terms of Service</h1>
      <p style={{ color: '#5c5c6b', marginBottom: 48, fontSize: 14 }}>Last updated: June 2026</p>

      <section>
        <h2 style={h2Style}>1. You Own Your Work</h2>
        <p style={pStyle}>All content you write in GhostWriter belongs to you. All content GhostWriter generates for your projects belongs to you. We claim no rights to your stories, characters, or any AI-assisted output. You may publish, sell, or distribute your work freely without restriction or attribution to GhostWriter.</p>
      </section>

      <section>
        <h2 style={h2Style}>2. How We Use Your Content</h2>
        <p style={pStyle}>We store your project data to provide the service. We do not use your stories to train AI models. We do not share your content with third parties except as required to provide the service (e.g., sending your prompts to Anthropic's API for generation). Anthropic's data usage policies apply to API calls — see anthropic.com/privacy.</p>
      </section>

      <section>
        <h2 style={h2Style}>3. Reference Works and Copyright</h2>
        <p style={pStyle}>GhostWriter's library system analyzes craft techniques from published works and injects abstract principles (pacing, structure, voice patterns) into AI generation. We do not reproduce copyrighted text. We analyze technique, not content. The AI output is original — it does not reproduce passages from reference works.</p>
      </section>

      <section>
        <h2 style={h2Style}>4. Acceptable Use</h2>
        <p style={pStyle}>GhostWriter is for fiction writing. You may not use it to generate content that violates applicable laws, constitutes harassment, or is designed to deceive real people. We reserve the right to suspend accounts that violate these terms.</p>
      </section>

      <section>
        <h2 style={h2Style}>5. Service Availability</h2>
        <p style={pStyle}>We aim for high availability but cannot guarantee uninterrupted service. We are not liable for data loss — back up your work externally. We may modify or discontinue features with reasonable notice.</p>
      </section>

      <section>
        <h2 style={h2Style}>6. Subscriptions and Billing</h2>
        <p style={pStyle}>Paid subscriptions are processed via Razorpay. You may cancel anytime — cancellation takes effect at the end of the current billing period. Refunds are evaluated case by case for technical failures.</p>
      </section>

      <section>
        <h2 style={h2Style}>7. Contact</h2>
        <p style={pStyle}>Questions: support@ghost-writer.cc</p>
      </section>

      <div style={{ marginTop: 60, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <a href="/" style={{ fontSize: 13, color: '#5c5c6b', textDecoration: 'none' }}>← Back to GhostWriter</a>
      </div>
    </div>
  );
}
