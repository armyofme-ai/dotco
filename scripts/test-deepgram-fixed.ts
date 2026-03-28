import "dotenv/config";
import { DeepgramClient } from "@deepgram/sdk";

async function main() {
  const audioUrl = "https://cegxrjorhphj0qel.public.blob.vercel-storage.com/audio/1774625956954-Passeig%20d'Ignasi%20Sala.m4a";

  console.log("Downloading audio...");
  const res = await fetch(audioUrl);
  const buffer = Buffer.from(await res.arrayBuffer());
  console.log(`Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)}MB`);

  console.log("Sending to Deepgram with detect_language, NO utterances...");
  const deepgram = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY! });

  const result = await deepgram.listen.v1.media.transcribeFile(
    buffer,
    {
      model: "nova-3",
      diarize: true,
      smart_format: true,
      punctuate: true,
      paragraphs: true,
      detect_language: true,
    }
  );

  const resultAny = result as any;
  const words = resultAny?.results?.channels?.[0]?.alternatives?.[0]?.words ?? [];
  const detectedLang = resultAny?.results?.channels?.[0]?.detected_language;
  const transcript = resultAny?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";

  console.log(`\nDetected language: ${detectedLang}`);
  console.log(`Words: ${words.length}`);
  console.log(`Transcript length: ${transcript.length} chars`);
  console.log(`First 300 chars: ${transcript.substring(0, 300)}`);
}

main().catch(console.error);
