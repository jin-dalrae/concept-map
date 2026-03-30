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
    // More output tokens for exhaustive mode
    const maxTokens = range.max > 30 ? 16384 : 8192;

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

function parseJSON(text: string): any {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Extract from markdown code fences
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) return JSON.parse(fenced[1].trim());
    // Try finding a JSON object
    const obj = text.match(/\{[\s\S]*\}/);
    if (obj) return JSON.parse(obj[0]);
    throw new Error('Could not parse JSON from LLM response');
  }
}
