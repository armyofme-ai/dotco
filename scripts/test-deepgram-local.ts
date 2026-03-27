import "dotenv/config";
import { DeepgramClient } from "@deepgram/sdk";
import { readFile } from "fs/promises";

async function main() {
  const filePath = "/Users/marcoscuevas/Desktop/Passeig d'Ignasi Sala v2.m4a";
  console.log("Reading file...");
  const buffer = await readFile(filePath);
  console.log(`File: ${(buffer.length / 1024 / 1024).toFixed(1)}MB`);

  console.log("Sending to Deepgram (this may take a few minutes)...");
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
  const utterances = resultAny?.results?.utterances ?? [];
  const words = resultAny?.results?.channels?.[0]?.alternatives?.[0]?.words ?? [];

  console.log(`\nUtterances: ${utterances.length}`);
  console.log(`Words: ${words.length}`);

  if (utterances.length > 0) {
    console.log(`Time range: ${utterances[0].start}s - ${utterances[utterances.length - 1].end}s`);
    console.log(`First: "${utterances[0].transcript.substring(0, 100)}"`);
  }
}

main().catch(console.error);
