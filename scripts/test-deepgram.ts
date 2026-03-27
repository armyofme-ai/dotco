import "dotenv/config";
import { DeepgramClient } from "@deepgram/sdk";

async function main() {
  const audioUrl = "https://cegxrjorhphj0qel.public.blob.vercel-storage.com/audio/1774625956954-Passeig%20d'Ignasi%20Sala.m4a";

  console.log("Downloading audio...");
  const res = await fetch(audioUrl);
  const buffer = Buffer.from(await res.arrayBuffer());
  console.log(`Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)}MB`);

  console.log("Sending to Deepgram...");
  const deepgram = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY! });

  const result = await deepgram.listen.v1.media.transcribeFile(
    buffer,
    {
      model: "nova-3",
      diarize: true,
      smart_format: true,
      punctuate: true,
      paragraphs: true,
      utterances: true,
    }
  );

  const resultAny = result as any;

  console.log("\n=== Results ===");
  console.log("Channels:", resultAny?.results?.channels?.length);

  if (resultAny?.results?.channels?.[0]) {
    const ch = resultAny.results.channels[0];
    console.log("Alternatives:", ch.alternatives?.length);
    if (ch.alternatives?.[0]) {
      const alt = ch.alternatives[0];
      console.log("Transcript length:", alt.transcript?.length);
      console.log("Words:", alt.words?.length);
      console.log("Paragraphs:", alt.paragraphs?.paragraphs?.length);
      console.log("First 200 chars:", alt.transcript?.substring(0, 200));
    }
  }

  const utterances = resultAny?.results?.utterances ?? [];
  console.log("\nUtterances:", utterances.length);

  if (utterances.length > 0) {
    console.log("First utterance:", JSON.stringify(utterances[0]).substring(0, 200));
    console.log("Last utterance end:", utterances[utterances.length - 1]?.end);
  }

  // Also check without utterances flag — use words from channel
  const words = resultAny?.results?.channels?.[0]?.alternatives?.[0]?.words ?? [];
  console.log("\nTotal words:", words.length);
  if (words.length > 0) {
    console.log("First word:", words[0].word, "at", words[0].start);
    console.log("Last word:", words[words.length - 1].word, "at", words[words.length - 1].end);
  }
}

main().catch(console.error);
