
import { GoogleGenAI, Modality } from "@google/genai";

const MAX_TEXT_LENGTH = 4500; // Safety margin for 5000 character limit

/**
 * Removes invisible control and format characters that can cause API errors.
 * These characters often come from PDF extraction or copy-pasting from web pages.
 * @param text The input text.
 * @returns Sanitized text.
 */
function sanitizeText(text: string): string {
  // This regex removes characters in the "Format" (Cf) and "Control" (Cc)
  // Unicode categories, but preserves common whitespace like newlines and tabs.
  // The previous regex used character class intersection `&&`, which is not supported in all JS environments
  // and caused a SyntaxError.
  // This new version explicitly defines the ranges of control characters to remove,
  // while omitting tab (\u0009), newline (\u000A), and carriage return (\u000D).
  return text.replace(/[\p{Cf}\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/gu, "");
}


/**
 * Splits a long text into smaller chunks that are safe to send to the TTS API.
 * It tries to split by sentences and ensures no empty/whitespace-only chunks are produced.
 * @param text The full text to be chunked.
 * @returns An array of text chunks.
 */
function chunkText(text: string): string[] {
    const trimmedText = text.trim();
    if (!trimmedText) {
        return [];
    }
    if (trimmedText.length <= MAX_TEXT_LENGTH) {
        return [trimmedText];
    }

    const sentences = trimmedText.match(/[^.!?؟]+[.!?؟\s]*|[^.!?؟]+$/g) || [];
    const chunks: string[] = [];
    let currentChunk = "";

    for (const sentence of sentences) {
        const trimmedSentence = sentence.trim();
        if (!trimmedSentence) continue;

        // If a single sentence is too long, it must be split forcefully.
        if (trimmedSentence.length > MAX_TEXT_LENGTH) {
            if (currentChunk.trim()) {
                chunks.push(currentChunk.trim());
            }
            currentChunk = "";
            for (let i = 0; i < trimmedSentence.length; i += MAX_TEXT_LENGTH) {
                chunks.push(trimmedSentence.substring(i, i + MAX_TEXT_LENGTH));
            }
            continue;
        }

        if ((currentChunk.length + trimmedSentence.length + 1) > MAX_TEXT_LENGTH) {
            if (currentChunk.trim()) {
                chunks.push(currentChunk.trim());
            }
            currentChunk = trimmedSentence + " ";
        } else {
            currentChunk += trimmedSentence + " ";
        }
    }

    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

/**
 * Interprets a raw API error and returns a new Error with a user-friendly message.
 * @param error The raw error caught from the API call.
 * @returns A new Error with a localized, descriptive message.
 */
function handleApiError(error: any): Error {
    console.error("Error calling Gemini API:", error);
    let message = 'یک خطای ناشناخته در هنگام ارتباط با سرویس رخ داد.';

    if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        if (errorMessage.includes('api key not valid') || errorMessage.includes('permission denied')) {
            message = 'کلید API نامعتبر است یا مجوز کافی ندارد. لطفاً تنظیمات خود را بررسی کنید.';
        } else if (errorMessage.includes('rate limit')) {
            message = 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً کمی صبر کرده و دوباره امتحان کنید.';
        } else if (errorMessage.includes('500') || errorMessage.includes('503') || errorMessage.includes('server error') || errorMessage.includes('rpc failed')) {
            message = 'سرویس در حال حاضر در دسترس نیست یا با خطای داخلی مواجه شده است. لطفاً بعداً دوباره تلاش کنید.';
        } else if (errorMessage.includes('400') || errorMessage.includes('invalid')) {
            message = 'درخواست نامعتبر بود. لطفاً از صحت متن ورودی خود اطمینان حاصل کنید.';
        } else {
            message = 'یک خطای غیرمنتظره رخ داد. لطفاً دوباره تلاش کنید.';
        }
    }
    
    return new Error(message);
}


export const generateSpeech = async (text: string): Promise<string[]> => {
  try {
    if (!process.env.API_KEY) {
      throw new Error("API_KEY environment variable not set");
    }
    
    const textChunks = chunkText(text);
    if (textChunks.length === 0) {
        return [];
    }
    
    const audioChunks: string[] = [];

    for (const chunk of textChunks) {
        const sanitizedChunk = sanitizeText(chunk).trim();
        
        if (!sanitizedChunk) {
            continue;
        }

        // Instantiate the client inside the loop to ensure a fresh connection for each chunk
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: sanitizedChunk }] }],
          config: {
            responseModalities: [Modality.AUDIO],
          },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

        if (!base64Audio) {
          console.warn(`No audio data received from API for chunk: "${sanitizedChunk.substring(0, 50)}..."`);
          continue;
        }
        
        audioChunks.push(base64Audio);
    }
    
    return audioChunks;

  } catch (error) {
    throw handleApiError(error);
  }
};
