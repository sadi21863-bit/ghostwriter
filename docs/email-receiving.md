# Email: Receiving at ghost-writer.cc

## Resend is send-only

Resend (used for transactional email) **cannot receive emails**. It only sends.
To receive emails at `@ghost-writer.cc`, a separate service is needed.

## Recommended: Cloudflare Email Routing (free)

Forwards emails sent to `@ghost-writer.cc` addresses to your personal Gmail (`sadi21863@gmail.com`). No separate inbox — just forwarding. Free, takes ~5 minutes to set up.

### Setup steps

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → select `ghost-writer.cc`
2. Left sidebar → **Email** → **Email Routing**
3. Enable Email Routing — Cloudflare auto-adds the required MX records
4. Add a routing rule:
   - **From:** `hello@ghost-writer.cc` (or `support@`, `contact@`, etc.)
   - **To:** `sadi21863@gmail.com`
5. Verify your Gmail address when Cloudflare sends the confirmation email
6. Done — emails to that address arrive in your Gmail inbox

You can add multiple addresses (e.g., `support@`, `noreply@`, `hello@`) all forwarding to the same Gmail.

## Other options (if a real inbox is needed)

| Service | Cost | Notes |
|---|---|---|
| **Cloudflare Email Routing** | Free | Forwarding only, no separate inbox |
| **Zoho Mail** | Free (up to 5 users) | Real inbox at custom domain |
| **Google Workspace** | ~$6/user/month | Full Gmail at custom domain |

For a solo indie SaaS, Cloudflare Email Routing + Resend covers both receive and send at zero extra cost.
