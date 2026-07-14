// One-off scraper: pulls the full school directory from shsselect.com/schools
// into content/schools-raw.csv for review before any DB seeding happens.
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, '..', 'content', 'schools-raw.csv');

const BASE_URL = 'https://shsselect.com/schools';
const DELAY_MS = 700;
const MAX_PAGES = 60; // safety cap; real loop stops when a page has 0 entries
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const CARD_RE = /<a[^>]+href="\/schools\/([a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/g;
const NAME_RE = /<h3[^>]*>\s*([\s\S]*?)\s*<\/h3>/;
const CATEGORY_RE = /Category:<\/span>\s*([^<]*)/;
const GENDER_RE = /Gender:<\/span>\s*([^<]*)/;
const LOCATION_RE = /Location:<\/span>\s*([^<]*)/;

function decodeEntities(str) {
  return str
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&rsquo;/g, '’')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function csvField(value) {
  const str = value ?? '';
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(page) {
  const url = `${BASE_URL}?page=${page}`;
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }
  return response.text();
}

function parsePage(html, page) {
  const rows = [];
  const failures = [];
  let match;
  CARD_RE.lastIndex = 0;
  while ((match = CARD_RE.exec(html)) !== null) {
    const [, slug, block] = match;

    const nameMatch = NAME_RE.exec(block);
    const categoryMatch = CATEGORY_RE.exec(block);
    const genderMatch = GENDER_RE.exec(block);
    const locationMatch = LOCATION_RE.exec(block);

    if (!nameMatch || !locationMatch) {
      failures.push({ page, slug, reason: 'missing name or location' });
      continue;
    }

    const name = decodeEntities(nameMatch[1]);
    const category = categoryMatch ? decodeEntities(categoryMatch[1]) : '';
    const gender = genderMatch ? decodeEntities(genderMatch[1]) : '';
    const location = decodeEntities(locationMatch[1]);

    // Location format observed: "District, Region"
    const commaIndex = location.lastIndexOf(',');
    const district = commaIndex === -1 ? '' : location.slice(0, commaIndex).trim();
    const region = commaIndex === -1 ? location : location.slice(commaIndex + 1).trim();

    if (!district || !region) {
      failures.push({ page, slug, reason: `unparseable location "${location}"` });
    }

    rows.push({ slug, name, region, district, category, gender });
  }
  return { rows, failures };
}

async function main() {
  const allRows = [];
  const allFailures = [];
  const seenSlugs = new Set();
  let statedTotal = null;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const html = await fetchPage(page);

    if (statedTotal === null) {
      const totalMatch = /Showing\s+([\d,]+)\s+school\(s\)/.exec(html);
      if (totalMatch) statedTotal = Number(totalMatch[1].replace(/,/g, ''));
    }

    const { rows, failures } = parsePage(html, page);
    allFailures.push(...failures);

    if (rows.length === 0) {
      console.log(`Page ${page}: 0 entries, stopping.`);
      break;
    }

    let newOnPage = 0;
    for (const row of rows) {
      if (seenSlugs.has(row.slug)) {
        allFailures.push({ page, slug: row.slug, reason: 'duplicate slug, skipped' });
        continue;
      }
      seenSlugs.add(row.slug);
      allRows.push(row);
      newOnPage += 1;
    }

    console.log(`Page ${page}: ${rows.length} entries (${newOnPage} new). Running total: ${allRows.length}`);

    await sleep(DELAY_MS);
  }

  const header = 'slug,name,region,district,category,gender';
  const lines = allRows.map((r) =>
    [r.slug, r.name, r.region, r.district, r.category, r.gender].map(csvField).join(','),
  );
  writeFileSync(OUT_PATH, [header, ...lines].join('\n') + '\n', 'utf8');

  console.log('\n--- Summary ---');
  console.log(`Stated site total: ${statedTotal}`);
  console.log(`Scraped total: ${allRows.length}`);
  console.log(`Parsing failures/skips: ${allFailures.length}`);
  if (allFailures.length > 0) {
    console.log(JSON.stringify(allFailures, null, 2));
  }
  console.log(`Written to ${OUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
