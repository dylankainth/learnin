import { env } from "../env.js";

export async function extractPdfText(buffer: Buffer): Promise<string> {
  // pdf-parse ships no ESM types; default import works fine at runtime under NodeNext+esModuleInterop.
  const pdfParse = (await import("pdf-parse")).default;
  const result = await pdfParse(buffer);
  return result.text;
}

/**
 * Transcribes a lecture video/audio file via a self-hosted Whisper-compatible
 * server (e.g. onerahmet/openai-whisper-asr-webservice), configured with
 * WHISPER_API_URL and exposing an OpenAI-style /asr endpoint.
 */
export async function transcribeVideo(buffer: Buffer): Promise<string> {
  if (!env.whisperApiUrl) {
    throw new Error(
      "Video upload requires WHISPER_API_URL to be set to a running Whisper transcription server",
    );
  }
  const form = new FormData();
  form.append("audio_file", new Blob([buffer]), "upload");

  const response = await fetch(`${env.whisperApiUrl}/asr?output=text`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    throw new Error(`Transcription server returned ${response.status}: ${await response.text()}`);
  }
  return response.text();
}
