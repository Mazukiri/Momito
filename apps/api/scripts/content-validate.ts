import { validateContent } from './content-lib';

const issues = validateContent();
const errors = issues.filter((issue) => issue.severity === 'error');
const warnings = issues.filter((issue) => issue.severity === 'warning');

for (const issue of issues) {
  const prefix = issue.severity === 'error' ? '✖' : '⚠';
  console.log(`${prefix} [${issue.questionTitle}] ${issue.message}`);
}

console.log(`\n${errors.length} error(s), ${warnings.length} warning(s).`);

if (errors.length > 0) {
  process.exitCode = 1;
}
