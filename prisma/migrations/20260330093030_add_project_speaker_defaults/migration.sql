-- CreateTable
CREATE TABLE "ProjectSpeakerDefault" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "speakerLabel" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'suggested',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectSpeakerDefault_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectSpeakerDefault_projectId_speakerLabel_key" ON "ProjectSpeakerDefault"("projectId", "speakerLabel");

-- AddForeignKey
ALTER TABLE "ProjectSpeakerDefault" ADD CONSTRAINT "ProjectSpeakerDefault_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSpeakerDefault" ADD CONSTRAINT "ProjectSpeakerDefault_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
