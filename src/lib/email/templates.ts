export function welcomeEmail(name: string): { subject: string; html: string; text: string } {
  return {
    subject: "Welcome to GhostWriter — let's write something real",
    text: `Hi ${name ?? 'there'},\n\nYour GhostWriter account is ready.\n\nStart writing at https://ghostwriterai.com/dashboard\n\n— The GhostWriter team`,
    html: `
      <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px 24px;">
        <h1 style="font-size:24px;margin-bottom:16px;">Welcome to GhostWriter.</h1>
        <p style="font-size:16px;line-height:1.7;color:#333;">
          You now have a writing platform that remembers everything: your characters,
          their knowledge states, their relationships, the promises you've made to your reader.
          The AI knows your story as well as you do.
        </p>
        <a href="https://ghostwriterai.com/dashboard"
           style="display:inline-block;margin-top:24px;padding:12px 28px;
                  background:#4F46E5;color:#fff;text-decoration:none;
                  border-radius:8px;font-size:15px;font-weight:600;">
          Start writing →
        </a>
      </div>`,
  };
}

export function passwordResetEmail(name: string, resetUrl: string): { subject: string; html: string; text: string } {
  return {
    subject: "Reset your GhostWriter password",
    text: `Hi ${name ?? 'there'},\n\nReset your password here (expires in 1 hour):\n${resetUrl}\n\nIf you didn't request this, ignore this email.\n\n— GhostWriter`,
    html: `
      <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px 24px;">
        <h2 style="font-size:20px;margin-bottom:16px;">Reset your password</h2>
        <p style="font-size:15px;line-height:1.7;color:#333;">
          This link expires in 1 hour.
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;margin-top:20px;padding:12px 28px;
                  background:#4F46E5;color:#fff;text-decoration:none;
                  border-radius:8px;font-size:15px;">
          Reset password →
        </a>
        <p style="font-size:12px;color:#888;margin-top:24px;">
          If you didn't request this, ignore this email. Your password won't change.
        </p>
      </div>`,
  };
}

export function trialStartEmail(name: string): { subject: string; html: string; text: string } {
  return {
    subject: "Your GhostWriter Pro trial has started",
    text: `Hi ${name ?? 'there'},\n\nYour 7-day Story Pro trial is now active.\n\nYou have full access to advanced modes, Style DNA, manuscript export, and the full character intelligence system.\n\nManage your subscription at https://ghostwriterai.com/settings\n\n— GhostWriter`,
    html: `
      <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px 24px;">
        <h2 style="font-size:20px;">Story Pro trial started</h2>
        <p style="font-size:15px;line-height:1.7;color:#333;">
          You have 7 days with full access to GhostWriter's complete intelligence stack.
          Advanced story modes, Style DNA, manuscript export, character knowledge matrix,
          and the Living Library are all unlocked.
        </p>
        <a href="https://ghostwriterai.com/dashboard"
           style="display:inline-block;margin-top:20px;padding:12px 28px;
                  background:#4F46E5;color:#fff;text-decoration:none;
                  border-radius:8px;font-size:15px;">
          Open GhostWriter →
        </a>
      </div>`,
  };
}
