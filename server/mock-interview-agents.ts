import { GoogleGenerativeAI } from '@google/generative-ai';
import { OpenAI } from 'openai';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

config();

type FocusArea = 'behavioral' | 'technical' | 'case' | 'mixed';

interface InterviewConfig {
  targetRole: string;
  background?: string;
  focusArea: FocusArea;
  turns: number;
}

interface TurnEvaluation {
  scores: {
    clarity: number;
    technicalDepth: number;
    structure: number;
    problemSolving: number;
    roleFit: number;
  };
  verdict: 'weak' | 'okay' | 'strong';
  strengths: string[];
  gaps: string[];
  nextProbeDirection: string;
}

interface TurnRecord {
  question: string;
  answer: string;
  evaluation: TurnEvaluation;
}

interface InterviewSession {
  id: string;
  config: InterviewConfig;
  history: TurnRecord[];
  nextQuestion: string;
  createdAt: string;
}

const GEMINI_KEYS = Array.from(
  new Set(
    [
      process.env.GEMINI_API_KEY,
      process.env.EXPO_PUBLIC_GEMINI_API_KEY,
      ...(process.env.GEMINI_API_KEYS || '').split(','),
      ...(process.env.EXPO_PUBLIC_GEMINI_API_KEYS || '').split(',')
    ]
      .map((k) => (k || '').trim())
      .filter(Boolean)
  )
);
let geminiKeyIndex = 0;
const GEMINI_MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL,
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b'
].filter(Boolean) as string[];
const OPENROUTER_KEYS = Array.from(
  new Set(
    [
      process.env.OPENROUTER_API_KEY,
      ...(process.env.OPENROUTER_API_KEYS || '').split(','),
      process.env.EXPO_PUBLIC_OPENROUTER_API_KEY,
      ...(process.env.EXPO_PUBLIC_OPENROUTER_API_KEYS || '').split(',')
    ]
      .map((k) => (k || '').trim())
      .filter(Boolean)
  )
);
let openRouterKeyIndex = 0;
const OPENROUTER_MODEL_CANDIDATES = [
  process.env.OPENROUTER_MODEL,
  'google/gemini-2.0-flash-001',
  'openai/gpt-4o-mini',
  'meta-llama/llama-3.1-8b-instruct:free'
].filter(Boolean) as string[];

const sessions = new Map<string, InterviewSession>();
const hasGemini = GEMINI_KEYS.length > 0;

const fallbackQuestionsByFocus: Record<FocusArea, string[]> = {
  technical: [
    'Walk me through a recent technical project you built. What problem were you solving and what architecture did you choose?',
    'Describe a difficult bug you debugged recently. How did you isolate root cause and verify the fix?',
    'If your production endpoint latency suddenly doubled, what exact steps would you take in the first hour?',
    'Explain a technical tradeoff decision you made. What alternatives did you consider and why did you reject them?',
    'How would you design this system to scale 10x while preserving reliability and observability?'
  ],
  behavioral: [
    'Tell me about a time you received tough feedback. How did you respond and what changed afterward?',
    'Describe a conflict with a teammate and how you resolved it.',
    'Share an example where you had to lead without authority.',
    'Tell me about a mistake you made at work and how you handled it.',
    'Describe a time you had to make a decision with incomplete information.'
  ],
  case: [
    'A product metric dropped 20% this week. How would you investigate and prioritize next actions?',
    'How would you launch a new feature for first-time users while minimizing churn risk?',
    'You have one engineer and two weeks to improve activation. What would you do?',
    'How would you evaluate whether to build vs buy a key platform capability?',
    'A stakeholder asks for a risky deadline. How do you negotiate scope and quality?'
  ],
  mixed: [
    'Tell me about a project where you had to balance technical quality with business urgency.',
    'Describe a challenging decision you made and the framework you used.',
    'How do you break down ambiguous problems into actionable steps?',
    'Tell me about a time collaboration changed your technical approach.',
    'What is one skill gap you are actively closing, and how are you doing it?'
  ]
};

function readPrompt(name: string): string {
  const promptPath = path.join(process.cwd(), 'prompts', `${name}.md`);
  return fs.readFileSync(promptPath, 'utf-8');
}

function clampTurns(turns: number): number {
  if (!Number.isFinite(turns)) return 5;
  return Math.min(7, Math.max(5, Math.round(turns)));
}

function parseJson<T>(raw: string): T {
  const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('Model response did not contain JSON object');
  }
  return JSON.parse(match[0]) as T;
}

function isGeminiKeyError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('api_key_invalid') ||
    msg.includes('api key not valid') ||
    msg.includes('400 bad request') ||
    msg.includes('unauthorized') ||
    msg.includes('permission denied')
  );
}

function isGeminiRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    isGeminiKeyError(error) ||
    msg.includes('model') && msg.includes('not found') ||
    msg.includes('not supported for generatecontent') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('resource exhausted')
  );
}

function isOpenRouterRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('unauthorized') ||
    msg.includes('invalid') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('not found') ||
    msg.includes('model')
  );
}

async function generateWithGemini(prompt: string): Promise<string> {
  if (!hasGemini) {
    throw new Error('No Gemini keys configured');
  }

  let lastError: unknown = null;
  for (let i = 0; i < GEMINI_KEYS.length; i++) {
    const idx = (geminiKeyIndex + i) % GEMINI_KEYS.length;
    const key = GEMINI_KEYS[idx];
    for (const modelName of GEMINI_MODEL_CANDIDATES) {
      try {
        const model = new GoogleGenerativeAI(key).getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 2048
          }
        });
        const result = await model.generateContent(prompt);
        geminiKeyIndex = idx;
        return result.response.text();
      } catch (error) {
        lastError = error;
        if (isGeminiRetryableError(error)) {
          continue;
        }
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('All Gemini keys failed');
}

async function generateWithOpenRouter(prompt: string): Promise<string> {
  if (OPENROUTER_KEYS.length === 0) {
    throw new Error('No OpenRouter keys configured');
  }
  let lastError: unknown = null;
  for (let i = 0; i < OPENROUTER_KEYS.length; i++) {
    const idx = (openRouterKeyIndex + i) % OPENROUTER_KEYS.length;
    const key = OPENROUTER_KEYS[idx];
    for (const model of OPENROUTER_MODEL_CANDIDATES) {
      try {
        const client = new OpenAI({
          apiKey: key,
          baseURL: 'https://openrouter.ai/api/v1'
        });
        const completion = await client.chat.completions.create({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.5,
          max_tokens: 2000
        });
        const text = completion.choices?.[0]?.message?.content;
        if (!text || !text.trim()) {
          throw new Error('OpenRouter returned empty response');
        }
        openRouterKeyIndex = idx;
        return text.trim();
      } catch (error) {
        lastError = error;
        if (isOpenRouterRetryableError(error)) continue;
        throw error;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('All OpenRouter keys failed');
}

async function generateWithLLM(prompt: string): Promise<string> {
  try {
    return await generateWithGemini(prompt);
  } catch (geminiError) {
    try {
      console.warn('[mock-interview] Gemini failed; trying OpenRouter fallback');
      return await generateWithOpenRouter(prompt);
    } catch (openRouterError) {
      throw openRouterError instanceof Error ? openRouterError : geminiError;
    }
  }
}

async function generateInterviewerQuestion(config: InterviewConfig, history: TurnRecord[]): Promise<string> {
  const getFallbackQuestion = () => {
    const idx = history.length;
    const pool = fallbackQuestionsByFocus[config.focusArea] || fallbackQuestionsByFocus.mixed;
    const base = pool[Math.min(idx, pool.length - 1)];
    const prev = history[history.length - 1];
    if (!prev) return base;
    if (prev.evaluation.verdict === 'weak') {
      return `Follow-up: ${prev.evaluation.nextProbeDirection} Please answer with one concrete example and outcome.`;
    }
    if (prev.evaluation.verdict === 'strong') {
      return `Deeper follow-up: ${prev.evaluation.nextProbeDirection} Include tradeoffs and how you would measure success.`;
    }
    return base;
  };

  if (!hasGemini) {
    return getFallbackQuestion();
  }

  const systemPrompt = readPrompt('interviewer_agent');
  const input = {
    targetRole: config.targetRole,
    background: config.background || '',
    focusArea: config.focusArea,
    turnsTotal: config.turns,
    turnsCompleted: history.length,
    history: history.map((h, idx) => ({
      turn: idx + 1,
      question: h.question,
      answer: h.answer,
      evaluation: h.evaluation
    }))
  };

  try {
    const text = await generateWithLLM(
      `${systemPrompt}\n\nReturn JSON only.\n\nINPUT:\n${JSON.stringify(input, null, 2)}`
    );
    const parsed = parseJson<{ nextQuestion: string }>(text);
    if (!parsed.nextQuestion || parsed.nextQuestion.trim().length < 10) {
      throw new Error('Invalid interviewer question output');
    }
    return parsed.nextQuestion.trim();
  } catch (error) {
    if (isGeminiRetryableError(error)) {
      console.warn('[mock-interview] Gemini unavailable for current keys/models; switching to fallback interviewer questions');
      return getFallbackQuestion();
    }
    throw error;
  }
}

async function evaluateTurn(config: InterviewConfig, question: string, answer: string, history: TurnRecord[]): Promise<TurnEvaluation> {
  const getFallbackEvaluation = () => {
    const words = answer.trim().split(/\s+/).length;
    const hasExample = /example|specifically|for instance|in my last/i.test(answer);
    const hasOutcome = /result|impact|outcome|improved|reduced|increased/i.test(answer);
    const hasStructure = /first|then|finally|because|therefore/i.test(answer);
    const clarity = Math.min(10, Math.max(4, Math.round(words / 18)));
    const technicalDepth = config.focusArea === 'technical' ? (hasExample ? 7 : 5) : 6;
    const structure = hasStructure ? 7 : 5;
    const problemSolving = hasOutcome ? 7 : 5;
    const roleFit = /team|project|customer|system|metric/i.test(answer) ? 7 : 5;
    const avg = (clarity + technicalDepth + structure + problemSolving + roleFit) / 5;
    const verdict: TurnEvaluation['verdict'] = avg < 5 ? 'weak' : avg < 7.5 ? 'okay' : 'strong';
    return {
      scores: { clarity, technicalDepth, structure, problemSolving, roleFit },
      verdict,
      strengths: [
        hasExample ? 'Used at least one concrete example' : 'Attempted to answer directly',
        hasOutcome ? 'Mentioned outcome/impact' : 'Kept response relevant to question'
      ],
      gaps: [
        !hasExample ? 'Add a specific real project example' : 'Add deeper implementation details',
        !hasOutcome ? 'Quantify impact with metrics where possible' : 'Make tradeoff reasoning explicit'
      ],
      nextProbeDirection: verdict === 'weak'
        ? 'Clarify core approach and walk through one concrete scenario'
        : verdict === 'strong'
          ? 'Probe deeper on tradeoffs, edge cases, and scale'
          : 'Ask for a more structured answer with measurable outcomes'
    };
  };

  if (!hasGemini) {
    return getFallbackEvaluation();
  }

  const systemPrompt = readPrompt('evaluator_agent');
  const input = {
    targetRole: config.targetRole,
    focusArea: config.focusArea,
    question,
    answer,
    priorTurns: history.length
  };

  try {
    const text = await generateWithLLM(
      `${systemPrompt}\n\nReturn JSON only.\n\nINPUT:\n${JSON.stringify(input, null, 2)}`
    );
    const parsed = parseJson<TurnEvaluation>(text);
    return parsed;
  } catch (error) {
    if (isGeminiRetryableError(error)) {
      console.warn('[mock-interview] Gemini unavailable for current keys/models; switching to fallback evaluator');
      return getFallbackEvaluation();
    }
    throw error;
  }
}

async function generateCoachingSummary(config: InterviewConfig, history: TurnRecord[]): Promise<{
  strengths: string[];
  gaps: string[];
  practicePlan: string[];
  finalSummaryMarkdown: string;
}> {
  const getFallbackSummary = () => {
    const weakAreas = history.flatMap((h) => h.evaluation.gaps).slice(0, 5);
    const strengths = history.flatMap((h) => h.evaluation.strengths).slice(0, 5);
    return {
      strengths: strengths.length ? strengths : ['Stayed engaged across the full interview'],
      gaps: weakAreas.length ? weakAreas : ['Increase specificity and measurable outcomes'],
      practicePlan: [
        'Practice 5 STAR-format responses for common interview themes',
        'For each answer, include one metric and one tradeoff',
        'Record yourself and refine clarity to under 2 minutes per answer'
      ],
      finalSummaryMarkdown: [
        '### Overall',
        'You completed a full mock interview with adaptive follow-ups.',
        '',
        '### What went well',
        '- You maintained response consistency across turns.',
        '',
        '### What to improve',
        '- Increase specificity with concrete examples and measurable impact.',
        '',
        '### Practice next',
        '- Use STAR + metrics + tradeoffs in every response.'
      ].join('\n')
    };
  };

  if (!hasGemini) {
    return getFallbackSummary();
  }

  const systemPrompt = readPrompt('coach_agent');
  const input = {
    targetRole: config.targetRole,
    focusArea: config.focusArea,
    background: config.background || '',
    turns: history
  };

  try {
    const text = await generateWithLLM(
      `${systemPrompt}\n\nReturn JSON only.\n\nINPUT:\n${JSON.stringify(input, null, 2)}`
    );
    return parseJson<{
      strengths: string[];
      gaps: string[];
      practicePlan: string[];
      finalSummaryMarkdown: string;
    }>(text);
  } catch (error) {
    if (isGeminiRetryableError(error)) {
      console.warn('[mock-interview] Gemini unavailable for current keys/models; switching to fallback coach summary');
      return getFallbackSummary();
    }
    throw error;
  }
}

export async function startMockInterview(config: {
  targetRole: string;
  background?: string;
  focusArea?: string;
  turns?: number;
}) {
  const interviewConfig: InterviewConfig = {
    targetRole: config.targetRole,
    background: config.background || '',
    focusArea: (config.focusArea as FocusArea) || 'mixed',
    turns: clampTurns(config.turns ?? 5)
  };

  const firstQuestion = await generateInterviewerQuestion(interviewConfig, []);
  const session: InterviewSession = {
    id: uuidv4(),
    config: interviewConfig,
    history: [],
    nextQuestion: firstQuestion,
    createdAt: new Date().toISOString()
  };
  sessions.set(session.id, session);

  return {
    sessionId: session.id,
    config: session.config,
    question: firstQuestion,
    turnsCompleted: 0,
    turnsTotal: session.config.turns
  };
}

export async function submitMockInterviewTurn(sessionId: string, answer: string) {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }
  if (!answer || answer.trim().length < 20) {
    throw new Error('Please provide a more detailed answer (at least 20 characters)');
  }

  const evaluation = await evaluateTurn(session.config, session.nextQuestion, answer.trim(), session.history);
  session.history.push({
    question: session.nextQuestion,
    answer: answer.trim(),
    evaluation
  });

  // `config.turns` = total questions the candidate answers (including the opener from /start).
  const isComplete = session.history.length >= session.config.turns;
  if (isComplete) {
    const feedback = await generateCoachingSummary(session.config, session.history);
    sessions.delete(sessionId);
    return {
      done: true,
      turnsCompleted: session.history.length,
      turnsTotal: session.config.turns,
      turnEvaluation: evaluation,
      finalFeedback: feedback,
      transcript: session.history
    };
  }

  const nextQuestion = await generateInterviewerQuestion(session.config, session.history);
  session.nextQuestion = nextQuestion;
  sessions.set(session.id, session);

  return {
    done: false,
    turnsCompleted: session.history.length,
    turnsTotal: session.config.turns,
    turnEvaluation: evaluation,
    question: nextQuestion
  };
}
