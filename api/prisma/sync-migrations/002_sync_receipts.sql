-- Additive rollout for existing databases. Apply explicitly after a backup;
-- never run an implicit db push against an application database.
CREATE TABLE "sync_receipts" (
  "farmId" TEXT NOT NULL REFERENCES "farms"("id") ON DELETE CASCADE,
  "movementId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "result" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("farmId", "movementId")
);
