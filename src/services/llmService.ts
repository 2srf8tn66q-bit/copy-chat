import type { LLMConfig, ChatMessage } from '../types/llm';

/**
 * Build the request payload and headers for an OpenAI-compatible API call.
 */
function buildOpenAICompatibleRequest(config: LLMConfig, messages: ChatMessage[]) {
  const url = `${config.baseUrl}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`,
  };
  const body = {
    model: config.model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    stream: false,
  };
  return { url, headers, body };
}

/**
 * Build the request payload and headers for an Anthropic (Claude) API call.
 */
function buildClaudeRequest(config: LLMConfig, messages: ChatMessage[]) {
  const url = `${config.baseUrl}/messages`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': config.apiKey,
    'anthropic-version': '2023-06-01',
  };
  // Claude API requires separating system messages from the conversation
  const systemMessage = messages.find((m) => m.role === 'system')?.content ?? '';
  const conversationMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));
  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: 1024,
    messages: conversationMessages,
  };
  if (systemMessage) {
    body.system = systemMessage;
  }
  return { url, headers, body };
}

/**
 * Build the proxy request body sent to our local proxy server.
 */
function buildProxyPayload(url: string, headers: Record<string, string>, body: unknown) {
  return {
    targetUrl: url,
    headers,
    body,
  };
}

/**
 * Send a chat message to the LLM and return the assistant's response text.
 */
export async function sendChatMessage(config: LLMConfig, messages: ChatMessage[]): Promise<string> {
  const isClaude = config.provider === 'claude';
  const { url, headers, body } = isClaude
    ? buildClaudeRequest(config, messages)
    : buildOpenAICompatibleRequest(config, messages);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000); // 120s timeout

  try {
    const response = await fetch('/api/llm/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildProxyPayload(url, headers, body)),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    if (isClaude) {
      // Claude response format: { content: [{ type: "text", text: "..." }] }
      const content = data?.content?.[0]?.text;
      if (!content) throw new Error('Unexpected Claude response format');
      return content;
    } else {
      // OpenAI-compatible response format: { choices: [{ message: { content: "..." } }] }
      const content = data?.choices?.[0]?.message?.content;
      if (!content) throw new Error('Unexpected OpenAI response format');
      return content;
    }
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('请求超时，请稍后重试');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Test the connection to the LLM API by sending a simple message.
 */
export async function testConnection(config: LLMConfig): Promise<{ success: boolean; message: string }> {
  try {
    const testMessages: ChatMessage[] = [
      { role: 'user', content: 'Say "OK" and nothing else.' },
    ];
    const result = await sendChatMessage(config, testMessages);
    return {
      success: true,
      message: `Connection successful. Response: ${result.slice(0, 100)}`,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return {
      success: false,
      message: `Connection failed: ${message}`,
    };
  }
}
