import { Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { companies, inferQuestionMetadata, questions, topics } from './seed-data';

const prisma = new PrismaClient();

const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';

// B2: the demo email/password used to be hardcoded literals — fine for local
// dev, but the deploy runbook's "seed prod once from local with
// SEED_USER_EMAIL=... SEED_USER_PASSWORD=..." instruction had nothing to read,
// so a public single-user deployment would otherwise get seeded with a
// well-known, source-committed password. Defaults preserve the existing local
// dev experience unchanged; the password itself is never logged.
const SEED_USER_EMAIL = process.env.SEED_USER_EMAIL?.trim() || 'demo@momito.local';
const SEED_USER_PASSWORD = process.env.SEED_USER_PASSWORD?.trim() || 'MomitoDemo123!';

async function upsertDemoUser() {
  const passwordHash = await bcrypt.hash(SEED_USER_PASSWORD, 12);
  await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: { email: SEED_USER_EMAIL, name: 'Momito Demo' },
    create: { id: DEMO_USER_ID, email: SEED_USER_EMAIL, name: 'Momito Demo', passwordHash },
  });
}

async function upsertTopics() {
  for (const [id, name, description] of topics) {
    await prisma.topic.upsert({ where: { id }, update: { name, description }, create: { id, name, description } });
  }
}

async function upsertCompanies() {
  for (const [id, name, region, notes] of companies) {
    await prisma.company.upsert({ where: { id }, update: { name, region, notes }, create: { id, name, region, notes } });
  }
}

function questionSeedId(index: number) {
  return `00000000-0000-4000-8003-${String(index + 1).padStart(12, '0')}`;
}

async function replaceQuestionCompanies(questionId: string, companyIndexes: number[] | undefined) {
  await prisma.questionCompany.deleteMany({ where: { questionId } });
  if (!companyIndexes?.length) return;
  await prisma.questionCompany.createMany({
    data: companyIndexes.map((company) => ({ questionId, companyId: companies[company][0] })),
  });
}

async function upsertQuestions() {
  for (const [index, question] of questions.entries()) {
    const id = questionSeedId(index);
    const metadata = inferQuestionMetadata(question, id);
    const data = {
      title: question.title,
      prompt: question.prompt,
      type: question.type,
      difficulty: question.difficulty,
      topicId: topics[question.topic][0],
      referenceAnswer: question.answer,
      sourceUrl: question.sourceUrl ?? null,
      createdByUserId: DEMO_USER_ID,
      ...metadata,
      // A2: Rubric (packages/shared) is a fully JSON-serializable plain object,
      // just not structurally assignable to Prisma's InputJsonValue without a
      // cast (same pattern as questions.service.ts's rubric handling).
      rubric: metadata.rubric as unknown as Prisma.InputJsonValue,
    };
    await prisma.question.upsert({ where: { id }, update: data, create: { id, ...data } });
    await replaceQuestionCompanies(id, question.companies);
  }
}

async function main() {
  await upsertDemoUser();
  await upsertTopics();
  await upsertCompanies();
  await upsertQuestions();

  console.log(`Seeded ${topics.length} topics, ${companies.length} companies, and ${questions.length} questions.`);
  // B2: never log the password itself — only which email was seeded and
  // whether the password came from an env override or the local dev default.
  const passwordSource = process.env.SEED_USER_PASSWORD ? 'SEED_USER_PASSWORD env var' : 'local dev default';
  console.log(`Demo login email: ${SEED_USER_EMAIL} (password from ${passwordSource})`);
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
