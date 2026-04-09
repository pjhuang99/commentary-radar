export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { apiKey, payload, provider } = req.body;

  try {
    let response;

    if (provider === 'gemini') {
      // ── 核心修复：切换到 v1beta 接口 ──
      const modelName = payload.model || 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: payload.messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          })),
          generationConfig: {
            maxOutputTokens: payload.max_tokens || 4000,
            temperature: 0.7,
          }
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json({ 
          error: data.error || { message: "Gemini v1beta 接口报错，请检查 Key 是否有效。" } 
        });
      }

      return res.status(200).json({
        content: [{ type: 'text', text: data.candidates?.[0]?.content?.parts?.[0]?.text || '' }]
      });

    } else if (provider === 'deepseek') {
      // DeepSeek 逻辑保持不变
      response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          max_tokens: payload.max_tokens || 2000,
          messages: payload.messages,
        }),
      });
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json({ error: data.error || data });
      return res.status(200).json({
        content: [{ type: 'text', text: data.choices?.[0]?.message?.content || '' }]
      });
    } else {
      // Claude 默认逻辑
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      return res.status(response.status).json(data);
    }

  } catch (e) {
    return res.status(500).json({ error: { message: e.message } });
  }
}
