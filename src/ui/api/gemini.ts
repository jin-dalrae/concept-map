import type { LLMClient, LLMClientConfig } from './provider';
import type { ExtractionRequest, ExtractionResult, LLMProvider } from '../../shared/types';
import { buildExtractionPrompt, buildCanonicalizationPrompt } from './prompts';
import { DENSITY_RANGES } from '../../shared/constants';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiClient implements LLMClient {
  readonly provider: LLMProvider = 'gemini';
  private apiKey: string;
  private model: string;

  constructor(config: LLMClientConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'gemini-2.5-flash';
  }

  private get endpoint(): string {
    return `${GEMINI_API_BASE}/${this.model}:generateContent?key=${this.apiKey}`;
  }

  async extractConceptMap(request: ExtractionRequest): Promise<ExtractionResult> {
    const { systemPrompt, userPrompt } = buildExtractionPrompt(request);
    const range = DENSITY_RANGES[request.density];
    // Scale output tokens with density — large maps need more room
    const maxTokens = range.max > 50 ? 32768 : range.max > 20 ? 16384 : 8192;

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(
        `Gemini API error ${response.status}: ${(err as Record<string, any>)?.error?.message || response.statusText}`
      );
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('No text content in Gemini response');

    const finishReason = data.candidates?.[0]?.finishReason;
    console.log('[ConceptMap] Gemini finishReason:', finishReason, '| response length:', text.length);
    if (finishReason === 'MAX_TOKENS') {
      console.warn('[ConceptMap] Response was truncated by MAX_TOKENS — attempting repair');
    }

    const parsed = safeParseJSON(text);
    return {
      map: parsed,
      mergeSuggestions: [],
      tokenUsage: {
        input: data.usageMetadata?.promptTokenCount || 0,
        output: data.usageMetadata?.candidatesTokenCount || 0,
      },
    };
  }

  async canonicalizeLabels(labels: string[]): Promise<Map<string, string>> {
    const prompt = buildCanonicalizationPrompt(labels);

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsed = safeParseJSON(text);
    return new Map(Object.entries(parsed.mappings || parsed));
  }

  async generateJSON(systemPrompt: string, userPrompt: string, maxTokens: number = 4096): Promise<any> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(
        `Gemini API error ${response.status}: ${(err as Record<string, any>)?.error?.message || response.statusText}`
      );
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      const reason = data.candidates?.[0]?.finishReason;
      throw new Error(`No text in Gemini response (finishReason: ${reason}). The model may have refused or returned empty.`);
    }
    console.log('[ConceptMap] generateJSON raw (' + text.length + ' chars):', text.slice(0, 200));
    return safeParseJSON(text);
  }

  async validateKey(): Promise<boolean> {
    try {
      // Use a simple list-models call to validate the key without generating content
      const listUrl = `${GEMINI_API_BASE}?key=${this.apiKey}`;
      const response = await fetch(listUrl);
      return response.ok;
    } catch (e) {
      console.warn('Gemini key validation failed:', e);
      return false;
    }
  }
}

/**
 * Robustly parse JSON from LLM output.
 * Handles: literal newlines, code fences, truncated output, leading/trailing text.
 */
function safeParseJSON(raw: string): any {
  let text = raw.trim();

  // Step 1: Strip code fences
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) text = fenced[1].trim();

  // Step 2: Extract JSON object/array if surrounded by extra text
  if (!text.startsWith('{') && !text.startsWith('[')) {
    const startObj = text.indexOf('{');
    const startArr = text.indexOf('[');
    const start = startObj >= 0 && startArr >= 0
      ? Math.min(startObj, startArr)
      : Math.max(startObj, startArr);
    if (start >= 0) text = text.slice(start);
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

  // Step 6: Last resort — try to find any valid JSON object
  const lastBrace = text.lastIndexOf('}');
  if (lastBrace > 0) {
    const substring = text.slice(0, lastBrace + 1);
    try { return JSON.parse(substring); } catch (_e) { /* continue */ }
    const repairedSub = repairTruncatedJSON(substring);
    try { return JSON.parse(repairedSub); } catch (_e) { /* continue */ }
  }

  console.error('[ConceptMap] Failed to parse JSON. First 500 chars:', text.slice(0, 500));
  throw new Error('Could not parse JSON from AI response: "' + text.slice(0, 80) + '..."');
}

/**
 * Attempts to repair truncated JSON by closing open strings, arrays, and objects.
 */
function repairTruncatedJSON(text: string): string {
  let result = text;

  // If we're in the middle of a string value, close it
  // Count unescaped quotes
  let inString = false;
  let lastIdx = 0;
  for (let i = 0; i < result.length; i++) {
    if (result[i] === '\\') { i++; continue; }
    if (result[i] === '"') { inString = !inString; lastIdx = i; }
  }
  if (inString) {
    // Truncated inside a string — close the string
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

  // Close all remaining open brackets/braces
  while (opens.length > 0) {
    result += opens.pop();
  }

  return result;
}
