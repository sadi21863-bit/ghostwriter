import type { ImageProvider } from "../providers";

export const OpenAIImageProvider: ImageProvider = {
  id: "openai_gpt_image", name: "GPT Image 2",
  description: "OpenAI's agentic image model. Superior general quality. Requires OpenAI API key.",
  requiresKey: true,
  async generate(params, apiKey) {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-image-2",
        prompt: params.prompt,
        n: 1,
        size: params.width && params.height ? `${params.width}x${params.height}` : "1024x1024",
      }),
    });
    if (!res.ok) throw new Error(`GPT Image 2 failed (${res.status}): ${await res.text()}`);
    const data = await res.json();
    const url = data.data?.[0]?.url;
    if (!url) throw new Error("No image URL in GPT Image 2 response");
    return { url, async: false };
  },
};
