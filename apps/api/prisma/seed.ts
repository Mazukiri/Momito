import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { companies, inferQuestionMetadata, questions, topics } from './seed-data';

const prisma = new PrismaClient();

const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';

async function main() {
  const passwordHash = await bcrypt.hash('MomitoDemo123!', 12);
  await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: { email: 'demo@momito.local', name: 'Momito Demo' },
    create: { id: DEMO_USER_ID, email: 'demo@momito.local', name: 'Momito Demo', passwordHash },
  });

  for (const [id, name, description] of topics) {
    await prisma.topic.upsert({ where: { id }, update: { name, description }, create: { id, name, description } });
  }

  for (const [id, name, region, notes] of companies) {
    await prisma.company.upsert({ where: { id }, update: { name, region, notes }, create: { id, name, region, notes } });
  }

  for (const [index, question] of questions.entries()) {
    const id = `00000000-0000-4000-8003-${String(index + 1).padStart(12, '0')}`;
    const data = {
      title: question.title,
      prompt: question.prompt,
      type: question.type,
      difficulty: question.difficulty,
      topicId: topics[question.topic][0],
      referenceAnswer: question.answer,
      sourceUrl: question.sourceUrl ?? null,
      createdByUserId: DEMO_USER_ID,
      ...inferQuestionMetadata(question),
    };
    await prisma.question.upsert({ where: { id }, update: data, create: { id, ...data } });
    await prisma.questionCompany.deleteMany({ where: { questionId: id } });
    if (question.companies?.length) {
      await prisma.questionCompany.createMany({
        data: question.companies.map((company) => ({ questionId: id, companyId: companies[company][0] })),
      });
    }
  }

  console.log(`Seeded ${topics.length} topics, ${companies.length} companies, and ${questions.length} questions.`);
  console.log('Demo login: demo@momito.local / MomitoDemo123!');
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
