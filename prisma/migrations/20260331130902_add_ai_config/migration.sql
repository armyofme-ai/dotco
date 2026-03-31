-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "deepgramApiKey" TEXT,
ADD COLUMN     "llmApiKey" TEXT,
ADD COLUMN     "llmModel" TEXT DEFAULT 'gpt-4o',
ADD COLUMN     "llmProvider" TEXT DEFAULT 'openai',
ADD COLUMN     "resendApiKey" TEXT;
