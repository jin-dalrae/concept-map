import type { LLMClient, LLMClientConfig } from './provider';
import type { ExtractionRequest, ExtractionResult, LLMProvider } from '../../shared/types';
import { buildExtractionPrompt, buildCanonicalizationPrompt } from './prompts';
import { DENSITY_RANGES } from '../../shared/constants';

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export class ClaudeClient implements LLMClient {
  readonly provider: LLMProvider = 'claude';
  private apiKey: string;
  private model: string;

  constructor(config: LLMClientConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'claude-sonnet-4-20250514';
  }

  async extractConceptMap(request: ExtractionRequest): Promise<ExtractionResult> {
    const { systemPrompt, userPrompt } = buildExtractionPrompt(request);
    const range = DENSITY_RANGES[request.density];
    // Scale output tokens with density — large maps need more room
    const maxTokens = range.max > 50 ? 32768 : range.max > 20 ? 16384 : 8192;

    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(
        `Claude API error ${response.status}: ${(err as Record<string, any>)?.error?.message || response.statusText}`
      );
    }

    const data = await response.json();
    const textContent = data.content?.find((c: any) => c.type === 'text')?.text;
    if (!textContent) throw new Error('No text content in Claude response');

    const stopReason = data.stop_reason;
    console.log('[ConceptMap] Claude stop_reason:', stopReason, '| response length:', textContent.length);
    if (stopReason === 'max_tokens') {
      console.warn('[ConceptMap] Response was truncated by max_tokens — attempting repair');
    }

    const parsed = parseJSON(textContent);
    return {
      map: parsed,
      mergeSuggestions: [],
      tokenUsage: {
        input: data.usage?.input_tokens || 0,
        output: data.usage?.output_tokens || 0,
      },
    };
  }

  async canonicalizeLabels(labels: string[]): Promise<Map<string, string>> {
    const prompt = buildCanonicalizationPrompt(labels);

    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) throw new Error(`Claude API error: ${response.status}`);

    const data = await response.json();
    const text = data.content?.find((c: any) => c.type === 'text')?.text || '{}';
    const parsed = parseJSON(text);
    return new Map(Object.entries(parsed.mappings || parsed));
  }

  async generateJSON(systemPrompt: string, userPrompt: string, maxTokens: number = 4096): Promise<any> {
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(
        `Claude API error ${response.status}: ${(err as Record<string, any>)?.error?.message || response.statusText}`
      );
    }

    const data = await response.json();
    const text = data.content?.find((c: any) => c.type === 'text')?.text;
    if (!text) throw new Error('No text content in Claude response');
    console.log('[ConceptMap] generateJSON raw (' + text.length + ' chars):', text.slice(0, 200));
    return parseJSON(text);
  }

  async validateKey(): Promise<boolean> {
    try {
      const response = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Say ok' }],
        }),
      });
      return response.ok;
    } catch (e) {
      console.warn('Claude key validation failed:', e);
      return false;
    }
  }
}

/**
 * Robustly parse JSON from LLM output.
 * Handles: literal newlines, code fences, truncated output, leading/trailing text.
 */
function parseJSON(raw: string): any {
  let text = raw.trim();

  // Step 1: Strip code fences
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) text = fenced[1].trim();

  // Step 2: Extract JSON object or array if surrounded by extra text
  if (!text.startsWith('{') && !text.startsWith('[')) {
    const startObj = text.indexOf('{');
    const startArr = text.indexOf('[');
    // Pick whichever comes first (if present)
    const candidates = [startObj, startArr].filter((i) => i >= 0);
    if (candidates.length > 0) {
      text = text.slice(Math.min(...candidates));
    }
  }

  // Step 3: Try direct parse
  try { return JSON.parse(text); } catch (_e) { /* continue */ }

  // Step 4: Fix unescaped newlines/tabs/control chars inside string values
  const fixed = text.replace(
    /"(?:[^"\\]|\\.)*"/g,
    (match) => match
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .replace(/[\x00-\x1f]/g, '')
  );
  try { return JSON.parse(fixed); } catch (_e) { /* continue */ }

  // Step 5: Repair truncated JSON (e.g., max_tokens hit)
  const repaired = repairTruncatedJSON(fixed);
  try { return JSON.parse(repaired); } catch (_e) { /* continue */ }

  // Step 6: Last resort — try to find any valid JSON object or array
  const lastBrace = text.lastIndexOf('}');
  const lastBracket = text.lastIndexOf(']');
  const lastEnd = Math.max(lastBrace, lastBracket);
  if (lastEnd > 0) {
    const substring = text.slice(0, lastEnd + 1);
    try { return JSON.parse(substring); } catch (_e) { /* continue */ }
    const repairedSub = repairTruncatedJSON(substring);
    try { return JSON.parse(repairedSub); } catch (_e) { /* continue */ }
  }

  console.error('[ConceptMap] Failed to parse JSON. Full text:', text);
  throw new Error('Could not parse JSON from AI response: "' + raw.slice(0, 120) + '..."');
}

/**
 * Attempts to repair truncated JSON by closing open strings, arrays, and objects.
 */
function repairTruncatedJSON(text: string): string {
  let result = text;

  // If we're in the middle of a string value, close it
  let inString = false;
  for (let i = 0; i < result.length; i++) {
    if (result[i] === '\\') { i++; continue; }
    if (result[i] === '"') { inString = !inString; }
  }
  if (inString) {
    result = result + '"';
  }

  // Remove any trailing comma or colon (incomplete key-value)
  result = result.replace(/,\s*$/, '').replace(/:\s*$/, ': null');
  // Remove incomplete key at end (e.g. , "someKey )
  result = result.replace(/,\s*"[^"]*"\s*$/, '');

  // Close open brackets and braces
  const opens: string[] = [];
  inString = false;
  for (let i = 0; i < result.length; i++) {
    if (result[i] === '\\' && inString) { i++; continue; }
    if (result[i] === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (result[i] === '{') opens.push('}');
    else if (result[i] === '[') opens.push(']');
    else if (result[i] === '}' || result[i] === ']') opens.pop();
  }

  while (opens.length > 0) {
    result += opens.pop();
  }

  return result;
}
