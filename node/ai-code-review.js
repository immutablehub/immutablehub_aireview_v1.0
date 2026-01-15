// LLM powered Node js code review early stage 
import { Groq } from 'groq-sdk';
import { z } from 'zod';

// 1. Define Strict Schema for Node.js Review
const ReviewSchema = z.object({
  summary: z.string(),
  score: z.number().min(1).max(10),
  node_specific_metrics: z.object({
    event_loop_safety: z.enum(['Safe', 'At Risk', 'Blocking']),
    async_consistency: z.boolean(),
    dependency_health: z.string()
  }),
  issues: z.array(z.object({
    type: z.enum(['bug', 'security', 'performance', 'logic', 'style']),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    line: z.number().nullable(),
    description: z.string(),
    suggestion: z.string()
  })),
  positive_feedback: z.array(z.string())
});

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});
const SYSTEMPROMPT = `

AI Senior Node.js Architect
Role: You are an expert Node.js Backend Engineer. Your mission is to perform a deep-dive code review on Node.js pull requests, focusing on the unique characteristics of the V8 runtime, asynchronous non-blocking I/O, and the Node.js ecosystem.

Review Priorities (Node.js Specific):

Asynchronous Patterns: Ensure async/await is used correctly. Flag "callback hell," unawaited promises, or missing try/catch blocks in async functions.

Event Loop Health: Identify heavy CPU-bound tasks or synchronous I/O (e.g., fs.readFileSync) that could block the event loop.

Error Handling: Check for proper error propagation. Ensure errors are handled centrally or via error-first callbacks where applicable. Flag unhandled promise rejections.

Security (OWASP): Look for NoSQL/SQL injection, insecure use of eval(), hardcoded secrets, and missing security headers (e.g., helmet).

Performance & Memory: Identify potential memory leaks (e.g., global variables, unclosed streams) and inefficient database queries (N+1 problems).

Dependency Management: Flag outdated or bloated packages and ensure package-lock.json consistency.

Output Format: Return only a JSON object. No prose. No Markdown formatting outside the JSON.

JSON Specification


{
  "summary": "String: 1-2 sentence overview of the code quality.",
  "score": "Number: 1-10 (10 is production-ready, 1 is critical failure).",
  "node_specific_metrics": {
    "event_loop_safety": "String: 'Safe', 'At Risk', or 'Blocking'",
    "async_consistency": "Boolean: true if patterns are consistent",
    "dependency_health": "String: 'Good', 'Check for Bloat', or 'Critical Vulnerabilities'"
  },
  "issues": [
    {
      "type": "String: 'bug' | 'security' | 'performance' | 'logic' | 'style'",
      "severity": "String: 'low' | 'medium' | 'high' | 'critical'",
      "line": "Number",
      "description": "String: What is wrong?",
      "suggestion": "String: How to fix it (include code snippet if helpful).",
    }
  ],
  "positive_feedback": ["String: List of good patterns observed."]
}

`


function sanitizeResponse(content) {
  return content.replace(/```json|```/g, '').trim();
}


/**
 * Perform a code review
 * @param {string} codeContent - The raw code to review
 */

export default async function CodeReview(code){

    if (!process.env.GROQ_API_KEY) throw new Error("Missing API Configuration");
    try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Review this node js code : ${code}` }
      ],
      model: "moonshotai/kimi-k2-instruct-0905",
      temperature: 0.2, // Low temperature for high precision
      max_completion_tokens: 4000,
      response_format: { type: "json_object" }
    });

    const rawResult = chatCompletion.choices[0]?.message?.content;
    if (!rawResult) throw new Error("Empty AI Response");

    // 3. Sanitize and Parse
    const sanitized = sanitizeResponse(rawResult);
    const jsonParsed = JSON.parse(sanitized);

    // 4. Validate against Schema
    const validated = ReviewSchema.safeParse(jsonParsed);
    if (!validated.success) {
      console.error("Review Validation Failed:", validated.error.format());
      throw new Error("AI output failed structural validation");
    }

    return {
      success: true,
      data: validated.data,
      metadata: {
        model: "kimi-k2-instruct",
        timestamp: new Date().toISOString(),
        isTruncated: codeContent.length > MAX_CHAR_LIMIT
      }
    };

  } catch (error) {
    console.error("CodeReview Error:", error.message);
    
    return {
      success: false,
      error: error.message || "Code review service unavailable",
      fallback_score: 0
    };
  }
    

}
