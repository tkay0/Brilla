import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const schools = [
  { name: 'Achimota School', region: 'Greater Accra' },
  {
    name: 'Presbyterian Boys’ Secondary School (PRESEC), Legon',
    region: 'Greater Accra',
  },
  { name: 'Wesley Girls’ High School', region: 'Central' },
  { name: 'St. Augustine’s College', region: 'Central' },
  { name: 'Prempeh College', region: 'Ashanti' },
  { name: 'Opoku Ware School', region: 'Ashanti' },
  { name: 'Mfantsipim School', region: 'Central' },
  { name: 'Adisadel College', region: 'Central' },
  { name: 'Aburi Girls’ Senior High School', region: 'Eastern' },
  { name: 'Tamale Secondary School', region: 'Northern' },
];

async function main() {
  for (const school of schools) {
    const existing = await prisma.school.findFirst({
      where: { name: school.name },
    });
    if (!existing) {
      await prisma.school.create({ data: school });
    }
  }
  console.log(`Seeded ${schools.length} schools.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
