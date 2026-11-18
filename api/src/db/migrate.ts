import { sql } from './client';

const schema = await Bun.file(new URL('./schema.sql', import.meta.url)).text();
await sql.unsafe(schema).simple();
console.log('Database schema is up to date.');
await sql.close();
