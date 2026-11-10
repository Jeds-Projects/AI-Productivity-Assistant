/**
 * Direct client-side Google Gemini integration. The API key is user-supplied,
 * held in memory only and sent from the browser on each request.
 */

export const GEMINI_MODELS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", hint: "Fast, high quality (default)" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", hint: "Deepest reasoning, slower" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite", hint: "Cheapest and fastest" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", hint: "Previous generation" },
] as const;

export type GeminiErrorKind =
  | "missing_key"
  | "invalid_key"
  | "permission"
  | "quota"
  | "unavailable"
  | "network"
  | "blocked"
  | "empty"
  | "parse"
  | "bad_request"
  | "aborted";

export class GeminiError extends Error {
  kind: GeminiErrorKind;
  constructor(kind: GeminiErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = "GeminiError";
  }
}

/** JSON schema subset accepted by Gemini's responseSchema. */
export type Schema =
  | { type: "STRING"; description?: string; enum?: string[] }
  | { type: "INTEGER" | "NUMBER" | "BOOLEAN"; description?: string }
  | { type: "ARRAY"; items: Schema; description?: string }
  | {
      type: "OBJECT";
      properties: Record<string, Schema>;
      required?: string[];
      propertyOrdering?: string[];
      description?: string;
    };

interface GenerateOptions {
  apiKey: string | null | undefined;
  model: string;
  system: string;
  prompt: string;
  schema?: Schema;
  temperature?: number;
  signal?: AbortSignal;
}

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

async function callGemini({
  apiKey,
  model,
  system,
  prompt,
  schema,
  temperature = 0.7,
  signal,
}: GenerateOptions): Promise<string> {
  const key = apiKey?.trim();
  if (!key) {
    throw new GeminiError(
      "missing_key",
      "Add your Google Gemini API key in Settings to use AI features.",
    );
  }

  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          ...(schema ? { responseMimeType: "application/json", responseSchema: schema } : {}),
        },
      }),
    });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw new GeminiError("aborted", "Request cancelled.");
    throw new GeminiError(
      "network",
      "Couldn't reach Google Gemini. Check your internet connection and try again.",
    );
  }

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.error?.message ?? "";
    } catch {
      /* ignore */
    }
    const lower = detail.toLowerCase();
    if (lower.includes("api key not valid") || lower.includes("api_key_invalid")) {
      throw new GeminiError(
        "invalid_key",
        "Your Gemini API key was rejected. Check it in Settings and try again.",
      );
    }
    if (res.status === 400) {
      throw new GeminiError("bad_request", `Gemini couldn't process this request. ${detail}`.trim());
    }
    if (res.status === 401 || res.status === 403) {
      throw new GeminiError(
        "permission",
        "This API key doesn't have access to the Gemini API or this model. Enable the Generative Language API for the key, or choose another model in Settings.",
      );
    }
    if (res.status === 404) {
      throw new GeminiError(
        "bad_request",
        `The model "${model}" isn't available for your key. Choose another model in Settings.`,
      );
    }
    if (res.status === 429) {
      throw new GeminiError(
        "quota",
        "Gemini rate limit or quota reached. Wait a minute and try again, or check your Google AI Studio quota.",
      );
    }
    if (res.status >= 500) {
      throw new GeminiError(
        "unavailable",
        "Google Gemini is temporarily unavailable. Please try again shortly.",
      );
    }
    throw new GeminiError("bad_request", detail || `Gemini request failed (${res.status}).`);
  }

  const data = await res.json();
  if (data?.promptFeedback?.blockReason) {
    throw new GeminiError(
      "blocked",
      "Gemini declined to respond to this input for safety reasons. Try rephrasing.",
    );
  }
  const candidate = data?.candidates?.[0];
  if (candidate?.finishReason === "SAFETY") {
    throw new GeminiError("blocked", "Gemini stopped this response for safety reasons. Try rephrasing.");
  }
  const text: string = (candidate?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("")
    .trim();
  if (!text) {
    throw new GeminiError("empty", "Gemini returned an empty response. Please try again.");
  }
  return text;
}

export async function generateJSON<T>(opts: GenerateOptions & { schema: Schema }): Promise<T> {
  const text = await callGemini(opts);
  try {
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    return JSON.parse(cleaned) as T;
  } catch {
    throw new GeminiError(
      "parse",
      "Gemini's response couldn't be read. Please try generating again.",
    );
  }
}

export async function generateText(opts: GenerateOptions): Promise<string> {
  return callGemini(opts);
}

/** Lightweight request to confirm the key and model work. */
export async function testConnection(apiKey: string, model: string) {
  const text = await callGemini({
    apiKey,
    model,
    system: "You are a connectivity check.",
    prompt: "Reply with exactly the word: OK",
    temperature: 0,
  });
  return text;
}

export function errorMessage(e: unknown) {
  if (e instanceof GeminiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Something went wrong. Please try again.";
}
