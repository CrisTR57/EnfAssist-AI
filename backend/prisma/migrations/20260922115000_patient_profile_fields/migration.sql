-- Extend Patient with profile, clinical summary, and QR fields
ALTER TABLE "Patient"
  ADD COLUMN "historiaClinica" TEXT,
  ADD COLUMN "qrCode" TEXT,
  ADD COLUMN "qrStatus" TEXT NOT NULL DEFAULT 'Activo',
  ADD COLUMN "tipoSangre" TEXT,
  ADD COLUMN "direccion" TEXT,
  ADD COLUMN "telefono" TEXT,
  ADD COLUMN "alergias" TEXT,
  ADD COLUMN "enfermedadesCronicas" TEXT,
  ADD COLUMN "medicamentosHabituales" TEXT,
  ADD COLUMN "estado" TEXT NOT NULL DEFAULT 'ACTIVO';

CREATE UNIQUE INDEX "Patient_historiaClinica_key" ON "Patient"("historiaClinica");
CREATE UNIQUE INDEX "Patient_qrCode_key" ON "Patient"("qrCode");
CREATE INDEX "Patient_qrStatus_idx" ON "Patient"("qrStatus");
CREATE INDEX "Patient_estado_idx" ON "Patient"("estado");
