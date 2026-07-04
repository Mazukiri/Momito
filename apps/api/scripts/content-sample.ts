import { sampleContent } from './content-lib';

const count = Number(process.argv[2] ?? 5);
const sample = sampleContent(count);

for (const question of sample) {
  console.log(`\n# ${question.title} [${question.type}/${question.difficulty}]`);
  console.log(question.prompt);
  console.log(`\nReference: ${question.answer}`);
  console.log('---');
}
