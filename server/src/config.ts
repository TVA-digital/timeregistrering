import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Ugyldig miljøkonfigurasjon:', parsed.error.flatten().fieldErrors);
  throw new Error('Ugyldig miljøkonfigurasjon');
}

export const config = parsed.data;
