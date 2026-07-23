import { cp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const destination = join('public', 'orbit');
const sources = ['main.js', 'config.js', 'src', 'assets/platforms'];

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

for (const source of sources) {
  await cp(source, join(destination, source), { recursive: true });
}
