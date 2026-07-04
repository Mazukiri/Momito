import { contentStats } from './content-lib';

const stats = contentStats();
console.log(JSON.stringify(stats, null, 2));
