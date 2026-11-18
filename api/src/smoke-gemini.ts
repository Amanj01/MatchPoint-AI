// One tiny real Gemini call to prove the key and model work (a few hundred tokens, fractions of a cent).
// Usage: GEMINI_API_KEY=... bun run smoke:gemini
import { callGemini } from './lib/ai';

const started = Date.now();
const { json, usage } = await callGemini(
  'Return JSON {"headline": string} with a 6-word CV headline for a junior React developer who loves accessible design.',
  100,
);
console.log('Gemini OK in', Date.now() - started, 'ms');
console.log('Result:', json);
console.log('Tokens:', { in: usage.promptTokenCount, out: usage.candidatesTokenCount });
