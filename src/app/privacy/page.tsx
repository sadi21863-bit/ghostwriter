export const metadata = { title: 'Privacy Policy – GhostWriter AI' };

const h2Style = { fontSize: 20, fontWeight: 700, marginBottom: 12, marginTop: 32, color: '#f2f2f3' } as const;
const pStyle  = { fontSize: 15, lineHeight: 1.8, color: '#9898a6', marginBottom: 0 } as const;

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 24px',
                  fontFamily: 'Georgia, serif', color: '#f2f2f3',
                  background: '#0a0a0b', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: '#5c5c6b', marginBottom: 48, fontSize: 14 }}>Last updated: June 2026</p>

      <section>
        <h2 style={h2Style}>What We Collect</h2>
        <p style={pStyle}>Email address and password (hashed, never stored in plain text), your project data (stories, characters, world bible), AI generation history (for your account), and subscription status. We collect platform usage events (generation counts, export counts) for product improvement — these are aggregated and not linked to your content.</p>
      </section>

      <section>
        <h2 style={h2Style}>What We Don't Collect</h2>
        <p style={pStyle}>We do not collect payment card details (handled by Razorpay). We do not track you across other websites. We do not sell your data. We do not use your stories to train AI models.</p>
      </section>

      <section>
        <h2 style={h2Style}>Data Retention</h2>
        <p style={pStyle}>Your project data is retained while your account is active. AI generation logs are deleted after 90 days. If you delete your account, all your data is permanently deleted within 30 days. You can export your work at any time before deletion.</p>
      </section>

      <section>
        <h2 style={h2Style}>Third-Party Services</h2>
        <p style={pStyle}>We use Anthropic's API for AI generation (your prompts are sent to their servers), Neon for database hosting, Vercel for application hosting, Razorpay for payment processing, Sentry for error monitoring (anonymized), and Resend for transactional email. Each provider's privacy policy governs their handling of your data.</p>
      </section>

      <section>
        <h2 style={h2Style}>Your Rights</h2>
        <p style={pStyle}>You may request a copy of your data, correction of inaccurate data, or deletion of your account and all associated data at any time by emailing support@ghost-writer.cc.</p>
      </section>

      <section>
        <h2 style={h2Style}>Cookies</h2>
        <p style={pStyle}>We use a single session cookie for authentication. We do not use tracking or advertising cookies.</p>
      </section>

      <div style={{ marginTop: 60, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <a href="/" style={{ fontSize: 13, color: '#5c5c6b', textDecoration: 'none' }}>← Back to GhostWriter</a>
      </div>
    </div>
  );
}
