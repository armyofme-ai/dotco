import "dotenv/config";
import { DeepgramClient } from "@deepgram/sdk";

async function main() {
  // The actual blob URL of the uploaded file
  const audioUrl = "https://cegxrjorhphj0qel.public.blob.vercel-storage.com/audio/1774625956954-Passeig%20d'Ignasi%20Sala.m4a";

  console.log("Sending URL to Deepgram (they fetch it directly)...");
  const deepgram = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY! });

  const result = await deepgram.listen.v1.media.transcribeUrl(
    {
      url: audioUrl,
      model: "nova-3",
      diarize: true,
      smart_format: true,
      punctuate: true,
      paragraphs: true,
      utterances: true,
    }
  );

  const resultAny = result as any;
  const utterances = resultAny?.results?.utterances ?? [];
  const words = resultAny?.results?.channels?.[0]?.alternatives?.[0]?.words ?? [];
  const duration = resultAny?.metadata?.duration;

  console.log(`\nDuration reported by Deepgram: ${duration}s`);
  console.log(`Utterances: ${utterances.length}`);
  console.log(`Words: ${words.length}`);

  if (utterances.length > 0) {
    console.log(`Time range: ${utterances[0].start}s - ${utterances[utterances.length - 1].end}s`);
    console.log(`\nFirst 3 utterances:`);
    for (let i = 0; i < Math.min(3, utterances.length); i++) {
      console.log(`  [${utterances[i].start}s] Speaker ${utterances[i].speaker}: "${utterances[i].transcript.substring(0, 80)}"`);
    }
  }
}

main().catch(console.error);
