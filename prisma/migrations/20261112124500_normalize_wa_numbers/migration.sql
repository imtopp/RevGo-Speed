-- Seragamkan nomor WhatsApp ke format kanonik 628… (idempoten, aman diulang).
-- Menyentuh HANYA baris yang belum cocok ^628[1-9][0-9]{7,12}$ (pola sama
-- dengan normalizeWa di src/lib/wa.ts):
--   08…      → 62… (prefix 0 diganti 62)
--   8…       → 62… (tanpa prefix)
--   berspasi/strip/plus → dibersihkan
-- Nomor yang tak bisa dinormalisasi (mis. telepon kantar 021…) Dibiarkan apa
-- adanya — semua pembaca (formatWaLocal/waLink) sudah toleran terhadap campur.

UPDATE "User" u
SET phone = f.norm
FROM (
  SELECT id,
    CASE
      WHEN c ~ '^628[1-9][0-9]{7,12}$' THEN c
      WHEN c LIKE '0%' AND ('62' || substr(c, 2)) ~ '^628[1-9][0-9]{7,12}$' THEN '62' || substr(c, 2)
      WHEN c LIKE '8%' AND ('62' || c) ~ '^628[1-9][0-9]{7,12}$' THEN '62' || c
      ELSE NULL
    END AS norm
  FROM (
    SELECT id, regexp_replace(phone, '[^0-9]', '', 'g') AS c
    FROM "User"
    WHERE phone IS NOT NULL
  ) t
) f
WHERE u.id = f.id
  AND u.phone !~ '^628[1-9][0-9]{7,12}$'
  AND f.norm IS NOT NULL;

UPDATE "Vehicle" v
SET "ownerPhone" = f.norm
FROM (
  SELECT id,
    CASE
      WHEN c ~ '^628[1-9][0-9]{7,12}$' THEN c
      WHEN c LIKE '0%' AND ('62' || substr(c, 2)) ~ '^628[1-9][0-9]{7,12}$' THEN '62' || substr(c, 2)
      WHEN c LIKE '8%' AND ('62' || c) ~ '^628[1-9][0-9]{7,12}$' THEN '62' || c
      ELSE NULL
    END AS norm
  FROM (
    SELECT id, regexp_replace("ownerPhone", '[^0-9]', '', 'g') AS c
    FROM "Vehicle"
    WHERE "ownerPhone" IS NOT NULL
  ) t
) f
WHERE v.id = f.id
  AND v."ownerPhone" !~ '^628[1-9][0-9]{7,12}$'
  AND f.norm IS NOT NULL;

UPDATE "Service" s
SET "customerPhone" = f.norm
FROM (
  SELECT id,
    CASE
      WHEN c ~ '^628[1-9][0-9]{7,12}$' THEN c
      WHEN c LIKE '0%' AND ('62' || substr(c, 2)) ~ '^628[1-9][0-9]{7,12}$' THEN '62' || substr(c, 2)
      WHEN c LIKE '8%' AND ('62' || c) ~ '^628[1-9][0-9]{7,12}$' THEN '62' || c
      ELSE NULL
    END AS norm
  FROM (
    SELECT id, regexp_replace("customerPhone", '[^0-9]', '', 'g') AS c
    FROM "Service"
    WHERE "customerPhone" IS NOT NULL
  ) t
) f
WHERE s.id = f.id
  AND s."customerPhone" !~ '^628[1-9][0-9]{7,12}$'
  AND f.norm IS NOT NULL;
