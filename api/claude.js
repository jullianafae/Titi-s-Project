// Vercel serverless function. Recebe { system, prompt } do frontend e chama a
// API da Anthropic usando a chave guardada em ANTHROPIC_API_KEY (variável de
// ambiente do servidor — nunca fica exposta no navegador).

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY não configurada no servidor." });
    return;
  }

  try {
    const { system, prompt, image, imageMediaType } = req.body || {};
    const content = image
      ? [
          { type: "image", source: { type: "base64", media_type: imageMediaType || "image/jpeg", data: image } },
          { type: "text", text: prompt },
        ]
      : prompt;
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system,
        messages: [{ role: "user", content }],
      }),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
