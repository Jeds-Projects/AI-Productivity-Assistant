import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useApiKey } from "@/lib/api-key";
import { GeminiError, errorMessage, generateJSON, type Schema } from "@/lib/gemini";
import { useAppData } from "@/lib/store";

/** Runs a structured Gemini request with loading + error state. */
export function useAiRequest<T>() {
  const { apiKey } = useApiKey();
  const { settings } = useAppData();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; kind?: string | undefined } | null>(null);
  const controller = useRef<AbortController | null>(null);

  const run = useCallback(
    async (args: { system: string; prompt: string; schema: Schema; temperature?: number }) => {
      controller.current?.abort();
      const ctrl = new AbortController();
      controller.current = ctrl;
      setLoading(true);
      setError(null);
      try {
        const result = await generateJSON<T>({
          apiKey,
          model: settings.model,
          signal: ctrl.signal,
          ...args,
        });
        return result;
      } catch (e) {
        if (e instanceof GeminiError && e.kind === "aborted") return null;
        const message = errorMessage(e);
        setError({ message, kind: e instanceof GeminiError ? e.kind : undefined });
        toast.error(message);
        return null;
      } finally {
        if (controller.current === ctrl) {
          setLoading(false);
          controller.current = null;
        }
      }
    },
    [apiKey, settings.model],
  );

  const cancel = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setLoading(false);
  }, []);

  return { run, loading, error, setError, cancel };
}
