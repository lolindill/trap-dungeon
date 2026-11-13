import type { AiLanguage, LlmConfig, LlmProvider } from '../types/game';
import type { ChatMessage } from './promptBuilder';

export function getProviderPresetDefaults(
  provider: LlmProvider
): Pick<LlmConfig, 'baseUrl' | 'model'> {
  switch (provider) {
    case 'gemini':
      return {
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        model: 'gemini-2.5-flash',
      };
    case 'anthropic':
      return {
        baseUrl: 'https://api.anthropic.com/v1',
        model: 'claude-3-5-sonnet-latest',
      };
    case 'openai_compat':
    default:
      return {
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
      };
  }
}

function isLocalEndpoint(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?/i.test(url.trim());
}

async function callOpenAiCompat(
  config: LlmConfig,
  messages: ChatMessage[],
  signal?: AbortSignal
): Promise<string> {
  const base = config.baseUrl.trim().replace(/\/+$/, '') || 'https://api.openai.com/v1';
  const endpoint = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;

  if (!config.apiKey.trim() && !isLocalEndpoint(base)) {
    throw new Error('Missing API Key for OpenAI-compatible provider.');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.apiKey.trim()) {
    headers['Authorization'] = `Bearer ${config.apiKey.trim()}`;
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    signal,
    body: JSON.stringify({
      model: config.model.trim() || 'gpt-4o-mini',
      messages,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Model returned empty response content.');
  }
  return content;
}

async function callGemini(
  config: LlmConfig,
  messages: ChatMessage[],
  signal?: AbortSignal
): Promise<string> {
  if (!config.apiKey.trim()) {
    throw new Error('Missing Gemini API Key.');
  }
  const base =
    config.baseUrl.trim().replace(/\/+$/, '') ||
    'https://generativelanguage.googleapis.com/v1beta';
  const model = config.model.trim() || 'gemini-2.5-flash';
  const endpoint = `${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(config.apiKey.trim())}`;

  const systemParts = messages
    .filter((m) => m.role === 'system')
    .map((m) => ({ text: m.content }));

  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: config.temperature,
      maxOutputTokens: config.maxTokens,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  };

  if (systemParts.length > 0) {
    body.systemInstruction = { parts: systemParts };
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts
        .map((p: { text?: string }) => p.text ?? '')
        .join('')
        .trim()
    : '';

  if (!text) {
    const reason = data?.candidates?.[0]?.finishReason ?? data?.promptFeedback?.blockReason ?? 'unknown';
    throw new Error(`Gemini returned empty output (reason: ${reason}).`);
  }
  return text;
}

async function callAnthropic(
  config: LlmConfig,
  messages: ChatMessage[],
  signal?: AbortSignal
): Promise<string> {
  if (!config.apiKey.trim()) {
    throw new Error('Missing Anthropic API Key.');
  }
  const base = config.baseUrl.trim().replace(/\/+$/, '') || 'https://api.anthropic.com/v1';
  const endpoint = base.endsWith('/messages') ? base : `${base}/messages`;

  const systemText = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');

  const chatMsgs = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey.trim(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    signal,
    body: JSON.stringify({
      model: config.model.trim() || 'claude-3-5-sonnet-latest',
      system: systemText || undefined,
      messages: chatMsgs,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Anthropic HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = Array.isArray(data?.content)
    ? data.content
        .filter((b: { type?: string }) => b.type === 'text')
        .map((b: { text?: string }) => b.text ?? '')
        .join('')
        .trim()
    : '';

  if (!text) {
    throw new Error('Anthropic returned empty response content.');
  }
  return text;
}

export async function callLlm(
  config: LlmConfig,
  messages: ChatMessage[],
  signal?: AbortSignal
): Promise<string> {
  if (config.provider === 'gemini') {
    return callGemini(config, messages, signal);
  }
  if (config.provider === 'anthropic') {
    return callAnthropic(config, messages, signal);
  }
  return callOpenAiCompat(config, messages, signal);
}

export async function testLlmConnection(
  config: LlmConfig,
  aiLanguage: AiLanguage = 'th'
): Promise<{ ok: boolean; reply: string; latencyMs: number; error?: string }> {
  const start = performance.now();
  try {
    const systemPrompt =
      aiLanguage === 'th'
        ? 'Respond briefly in 1 short sentence in Thai (ภาษาไทย) as Lilim greeting her Dungeon Master (นายท่าน).'
        : 'Respond briefly in 1 short sentence as Lilim greeting her Dungeon Master.';
    const reply = await callLlm(
      { ...config, maxTokens: Math.min(config.maxTokens || 256, 128) },
      [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: 'Connection check: report ready.',
        },
      ]
    );
    return {
      ok: true,
      reply,
      latencyMs: Math.round(performance.now() - start),
    };
  } catch (err) {
    return {
      ok: false,
      reply: '',
      latencyMs: Math.round(performance.now() - start),
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
