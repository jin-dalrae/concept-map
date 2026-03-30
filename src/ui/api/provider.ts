import type { ExtractionRequest, ExtractionResult, LLMProvider } from '../../shared/types';
import { ClaudeClient } from './claude';
import { GeminiClient } from './gemini';

export interface LLMClient {
  readonly provider: LLMProvider;
  extractConceptMap(request: ExtractionRequest): Promise<ExtractionResult>;
  canonicalizeLabels(labels: string[]): Promise<Map<string, string>>;
  validateKey(): Promise<boolean>;
  /** Generic JSON generation — send system+user prompts, get parsed JSON back */
  generateJSON(systemPrompt: string, userPrompt: string, maxTokens?: number): Promise<any>;
}

export interface LLMClientConfig {
  apiKey: string;
  model: string;
}

export function createLLMClient(provider: LLMProvider, config: LLMClientConfig): LLMClient {
  switch (provider) {
    case 'claude':
      return new ClaudeClient(config);
    case 'gemini':
      return new GeminiClient(config);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
