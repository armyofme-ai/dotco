-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "speakerMap" JSONB,
ADD COLUMN     "transcriptSegments" JSONB;
