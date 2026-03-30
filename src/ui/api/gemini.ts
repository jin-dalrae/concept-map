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
    // More output tokens for exhaustive mode
    const maxTokens = range.max > 30 ? 16384 : 8192;

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

    const parsed = JSON.parse(text);
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
    const parsed = JSON.parse(text);
    return new Map(Object.entries(parsed.mappings || parsed));
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
