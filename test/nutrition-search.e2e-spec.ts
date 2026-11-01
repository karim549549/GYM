import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { sql } from 'drizzle-orm';
import { validateEnv } from '../src/config/env.schema';
import { DatabaseModule } from '../src/database/database.module';
import { TransactionManager } from '../src/database/transaction.manager';

describe('Nutrition search normalization in PostgreSQL', () => {
  let moduleRef: TestingModule;
  let tx: TransactionManager;
  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        DatabaseModule,
      ],
    }).compile();
    tx = moduleRef.get(TransactionManager);
  });
  afterAll(async () => {
    await moduleRef?.close();
  });

  it.each([
    ['\u0623\u064e\u0631\u064f\u0632\u0651', '\u0627\u0631\u0632'],
    ['\u0625\u062f\u0627\u0645', '\u0627\u062f\u0627\u0645'],
    [
      '\u0622\u064a\u0633 \u0643\u0631\u064a\u0645',
      '\u0627\u064a\u0633 \u0643\u0631\u064a\u0645',
    ],
    [
      '\u0671\u0644\u0652\u0623\u064e\u0631\u064f\u0632\u0651',
      '\u0627\u0644\u0627\u0631\u0632',
    ],
    ['\u0643\u064f\u0641\u0652\u062a\u064e\u0629', '\u0643\u0641\u062a\u0647'],
    [
      '\u0637\u064e\u062d\u0650\u064a\u0646\u064e\u0629',
      '\u0637\u062d\u064a\u0646\u0647',
    ],
    [
      '\u0645\u064f\u0644\u064f\u0648\u062e\u0650\u064a\u064e\u0651\u0629',
      '\u0645\u0644\u0648\u062e\u064a\u0647',
    ],
    ['\u0643\u0645\u062b\u0631\u0649', '\u0643\u0645\u062b\u0631\u064a'],
    [
      '\u0637\u0640\u0640\u0645\u0627\u0637\u0645',
      '\u0637\u0645\u0627\u0637\u0645',
    ],
    [
      '\u0644\u0628\u0646 \u0661\u0660\u0660 \u062c\u0645',
      '\u0644\u0628\u0646 100 \u062c\u0645',
    ],
    [
      '\u0632\u0628\u0627\u062f\u064a \u06f2\u06f5\u06f0 \u062c\u0645',
      '\u0632\u0628\u0627\u062f\u064a 250 \u062c\u0645',
    ],
    [
      '  \u0641\u0631\u0627\u062e\t\u0645\u0634\u0648\u064a\u0629\n ',
      '\u0641\u0631\u0627\u062e \u0645\u0634\u0648\u064a\u0647',
    ],
    ['WHEY Protein 30G', 'whey protein 30g'],
    [
      '\ufefb\u0632\u0627\u0646\u064a\u0627',
      '\u0644\u0627\u0632\u0627\u0646\u064a\u0627',
    ],
    [
      '\u062a\u064f\u0641\u064e\u0651\u0627\u062d \u0623\u062e\u0636\u0631 \u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669',
      '\u062a\u0641\u0627\u062d \u0627\u062e\u0636\u0631 0123456789',
    ],
  ])('normalizes %s', async (input, expected) => {
    const result = await tx.db.execute<{ normalized: string }>(
      sql`select normalize_search_text(${input}) as normalized`,
    );
    expect(result.rows[0].normalized).toBe(expected);
  });
  it('preserves punctuation and hamza, and collapses Unicode whitespace', async () => {
    const result = await tx.db.execute<{ normalized: string }>(
      sql`select normalize_search_text(${'\u0621\u0624\u0626\u00a0 0.5\u2003G'}) as normalized`,
    );
    expect(result.rows[0].normalized).toBe('\u0621\u0624\u0626 0.5 g');
  });
});
