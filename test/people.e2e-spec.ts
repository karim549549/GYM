import { randomInt, randomUUID } from 'node:crypto';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { eq, inArray } from 'drizzle-orm';
import { validateEnv } from '../src/config/env.schema';
import { DatabaseModule } from '../src/database/database.module';
import { people } from '../src/database/schema';
import { TransactionManager } from '../src/database/transaction.manager';
import { PeopleModule } from '../src/people/people.module';
import type { NewPerson } from '../src/people/interfaces/person.interface';
import { PeopleService } from '../src/people/people.service';

describe('PeopleService against the database', () => {
  let moduleRef: TestingModule;
  let peopleService: PeopleService;
  let tx: TransactionManager;
  const personIds: string[] = [];

  const newPerson = (fullName = 'People Test'): NewPerson => ({
    phone: `+2010${randomInt(10_000_000, 99_999_999)}`,
    fullName,
    authUserId: randomUUID(),
  });

  const create = async (person = newPerson()) => {
    const created = await peopleService.create(person);
    personIds.push(created.id);
    return { person, created };
  };

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        DatabaseModule,
        PeopleModule,
      ],
    }).compile();
    peopleService = moduleRef.get(PeopleService);
    tx = moduleRef.get(TransactionManager);
  });

  afterAll(async () => {
    await tx.db.delete(people).where(inArray(people.id, personIds));
    await moduleRef.close();
  });

  it('returns the id the database chose', async () => {
    const { created } = await create();

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('never gives two people the same id', async () => {
    const first = await create();
    const second = await create();

    expect(first.created.id).not.toBe(second.created.id);
  });

  it('finds a person by their login id', async () => {
    const { person, created } = await create({
      ...newPerson('Known Person'),
    });

    expect(await peopleService.findByAuthUserId(person.authUserId)).toEqual({
      id: created.id,
      fullName: 'Known Person',
    });
  });

  it('stores the optional email', async () => {
    const email = `known-${randomUUID()}@example.com`;
    const { created } = await create({ ...newPerson(), email });

    const [stored] = await tx.db
      .select({ email: people.email })
      .from(people)
      .where(inArray(people.id, [created.id]));
    expect(stored.email).toBe(email);
  });

  describe('recordLogin', () => {
    const lastLoginOf = async (id: string) => {
      const [row] = await tx.db
        .select({ lastLoginAt: people.lastLoginAt })
        .from(people)
        .where(eq(people.id, id));
      return row.lastLoginAt;
    };

    it('starts with no login recorded', async () => {
      const { created } = await create();

      expect(await lastLoginOf(created.id)).toBeNull();
    });

    // the database clock and this machine's can differ by a second or more
    it('stamps the time of the login', async () => {
      const { created } = await create();
      const before = Date.now();

      await peopleService.recordLogin(created.id);

      const stamped = await lastLoginOf(created.id);
      expect(stamped).toBeInstanceOf(Date);
      expect(stamped!.getTime()).toBeGreaterThanOrEqual(before - 5_000);
      expect(stamped!.getTime()).toBeLessThanOrEqual(Date.now() + 5_000);
    });

    it('moves the stamp forward on the next login', async () => {
      const { created } = await create();
      await peopleService.recordLogin(created.id);
      const first = await lastLoginOf(created.id);

      await new Promise((resolve) => setTimeout(resolve, 20));
      await peopleService.recordLogin(created.id);

      expect((await lastLoginOf(created.id))!.getTime()).toBeGreaterThan(
        first!.getTime(),
      );
    });

    it('touches only that person', async () => {
      const { created } = await create();
      const { created: other } = await create();

      await peopleService.recordLogin(created.id);

      expect(await lastLoginOf(other.id)).toBeNull();
    });

    it('does nothing, and does not throw, for an unknown person', async () => {
      await expect(
        peopleService.recordLogin(randomUUID()),
      ).resolves.toBeUndefined();
    });
  });

  describe('findByPhone', () => {
    it('finds a person by the phone number they signed up with', async () => {
      const { person, created } = await create();

      expect(await peopleService.findByPhone(person.phone)).toEqual({
        id: created.id,
        fullName: 'People Test',
      });
    });

    it('returns null for a number nobody signed up with', async () => {
      await expect(
        peopleService.findByPhone('+201000000000'),
      ).resolves.toBeNull();
    });
  });

  it('returns null, and does not throw, for an unknown login', async () => {
    await expect(
      peopleService.findByAuthUserId(randomUUID()),
    ).resolves.toBeNull();
  });

  it('joins the open transaction, so a failure undoes the write', async () => {
    const person = newPerson();

    await expect(
      tx.run(async () => {
        await peopleService.create(person);
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');

    expect(await peopleService.findByAuthUserId(person.authUserId)).toBeNull();
  });

  it('refuses a second person with the same phone number', async () => {
    const { person } = await create();

    await expect(
      peopleService.create({ ...newPerson(), phone: person.phone }),
    ).rejects.toMatchObject({ cause: { code: '23505' } });
  });
});
