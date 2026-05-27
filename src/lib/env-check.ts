// Checked at runtime when features are used, not at build time.
// Returns null if the key is present, or an error message string.

export function checkGeminiKey(): string | null {
  if (!process.env.GEMINI_API_KEY) {
    return "GEMINI_API_KEY is not set. Video dissection is unavailable. Add it to your environment variables.";
  }
  return null;
}

export function checkAnthropicKey(): string | null {
  if (!process.env.ANTHROPIC_API_KEY) {
    return "ANTHROPIC_API_KEY is not set. AI generation is unavailable.";
  }
  return null;
}
