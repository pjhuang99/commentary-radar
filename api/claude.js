export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { apiKey, payload, provider } = req.body;

  try {
    if (provider === 'gemini') {
      // ── 逻辑加固：清理模型名称 ──
      // 去掉可能存在的 'models/' 前缀，确保 URL 拼接正确
      let modelId = payload.model || 'gemini-1.5-flash';
      modelId = modelId.replace('models/', ''); 
      
      // 使用兼容性最强的 v1beta 路径
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
      
      const response = await fetch(url, {
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
        // 返回更详细的错误，方便调试
        return res.status(response.status).json({ 
          error: data.error || { message: "Gemini 响应异常，请检查 API Key 权限。" } 
        });
      }

      return res.status(200).json({
        content: [{ type: 'text', text: data.candidates?.[0]?.content?.parts?.[0]?.text || '' }]
      });

    } else if (provider === 'deepseek') {
      // DeepSeek 逻辑保持不变
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
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
      return res.status(200).json({
        content: [{ type: 'text', text: data.choices?.[0]?.message?.content || '' }]
      });
    } else {
      // Claude 默认逻辑
      const response = await fetch('https://api.anthropic.com/v1/messages', {
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
