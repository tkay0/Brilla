// One-off import: upserts content/schools-raw.csv (scraped from shsselect.com) into
// the School table, keyed by slug so re-running after the source site adds schools
// is idempotent. The 10 pre-existing test schools are merged onto their real-site
// counterpart in place (same id, so existing User.schoolId rows keep resolving)
// rather than being duplicated.
import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const CSV_PATH = join(__dirname, '..', '..', '..', 'content', 'schools-raw.csv');

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

type CsvRow = { slug: string; name: string; region: string };

// Hand-verified mapping from the 10 seeded test schools (by their current name) to the
// matching real-site slug. Built by cross-checking name + region against schools-raw.csv
// (see scripts/scrape-schools.mjs output) rather than fuzzy-matched, because a wrong
// auto-merge would silently conflate two different schools under one id.
//
// "Tamale Secondary School" (TAMASCO) is intentionally NOT mapped: the site lists
// "Tamale Senior High" (T'SHS) and several other distinct Tamale-area schools, but no
// entry that is confidently the same institution as TAMASCO. Left as its own row.
const TEST_SCHOOL_SLUG_BY_NAME: Record<string, string> = {
  'Achimota School': 'achimota-senior-high',
  'Presbyterian Boys’ Secondary School (PRESEC), Legon': 'presby-boys-senior-high-legon',
  'Wesley Girls’ High School': 'wesley-girls-senior-high-cape-coast',
  'St. Augustine’s College': 'st-augustine-s-college-cape-coast',
  'Prempeh College': 'prempeh-college',
  'Opoku Ware School': 'opoku-ware-senior-high',
  'Mfantsipim School': 'mfantsipim-school',
  'Adisadel College': 'adisadel-college',
  'Aburi Girls’ Senior High School': 'aburi-girls-senior-high',
};

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split('\n');
  const rows: CsvRow[] = [];
  for (const line of lines.slice(1)) {
    const fields: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i];
      if (inQuotes) {
        if (c === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          cur += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        fields.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
    fields.push(cur);
    const [slug, name, region] = fields;
    rows.push({ slug, name, region });
  }
  return rows;
}

async function main() {
  const csvText = readFileSync(CSV_PATH, 'utf8');
  const rows = parseCsv(csvText);
  const rowBySlug = new Map(rows.map((r) => [r.slug, r]));

  console.log(`Loaded ${rows.length} schools from CSV.`);

  // Step 1: merge the pre-existing test schools onto their real-site row, in place,
  // so existing User.schoolId values keep resolving to the same id.
  const existingSchools = await prisma.school.findMany();
  let merged = 0;
  for (const school of existingSchools) {
    if (school.slug) continue; // already imported in a prior run
    const targetSlug = TEST_SCHOOL_SLUG_BY_NAME[school.name];
    if (!targetSlug) continue;
    const row = rowBySlug.get(targetSlug);
    if (!row) {
      console.warn(`WARNING: mapped slug "${targetSlug}" for "${school.name}" not found in CSV, skipping merge.`);
      continue;
    }
    await prisma.school.update({
      where: { id: school.id },
      data: { slug: row.slug, name: row.name, region: row.region },
    });
    console.log(`Merged "${school.name}" -> "${row.name}" (${row.slug}), kept id ${school.id}`);
    merged += 1;
  }

  // Step 2: upsert every CSV row by slug. Rows merged in step 1 already carry the
  // right slug/name/region, so this is a no-op update for them.
  let created = 0;
  let updated = 0;
  for (const row of rows) {
    const existing = await prisma.school.findUnique({ where: { slug: row.slug } });
    await prisma.school.upsert({
      where: { slug: row.slug },
      update: { name: row.name, region: row.region },
      create: { slug: row.slug, name: row.name, region: row.region },
    });
    if (existing) updated += 1;
    else created += 1;
  }

  const total = await prisma.school.count();
  const withoutSlug = await prisma.school.count({ where: { slug: null } });

  console.log('\n--- Summary ---');
  console.log(`Test schools merged onto real-site rows: ${merged}`);
  console.log(`CSV rows created: ${created}`);
  console.log(`CSV rows updated (already present): ${updated}`);
  console.log(`Total schools in DB: ${total}`);
  console.log(`Schools without a slug (pre-existing, unmerged, e.g. TAMASCO): ${withoutSlug}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
