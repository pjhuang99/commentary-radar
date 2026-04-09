export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { apiKey, payload, provider } = req.body;

  try {
    let response;

    if (provider === 'gemini') {
      // ── Gemini 逻辑增强 ──
      let modelId = payload.model || 'gemini-1.5-flash';
      // 移除任何多余的前缀
      modelId = modelId.replace('models/', '');
      
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
      
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: payload.messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          })),
          generationConfig: { maxOutputTokens: payload.max_tokens || 4000 }
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        const msg = data.error?.message || JSON.stringify(data.error);
        return res.status(response.status).json({ error: { message: `Gemini报错: ${msg}` } });
      }
      return res.status(200).json({
        content: [{ type: 'text', text: data.candidates?.[0]?.content?.parts?.[0]?.text || '' }]
      });

    } else if (provider === 'deepseek') {
      // ── DeepSeek 逻辑 ──
      response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
        body: JSON.stringify({ model: 'deepseek-chat', messages: payload.messages }),
      });
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json({ error: data.error });
      return res.status(200).json({ content: [{ type: 'text', text: data.choices?.[0]?.message?.content || '' }] });

    } else {
      // ── Claude 逻辑 (增加报错详情) ──
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
      if (!response.ok) {
        return res.status(response.status).json({ error: { message: `Claude报错: ${data.error?.message || '未知错误'}` } });
      }
      return res.status(200).json(data);
    }

  } catch (e) {
    return res.status(500).json({ error: { message: `代理服务器错误: ${e.message}` } });
  }
}
