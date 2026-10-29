import { Injectable } from '@nestjs/common';
import { eq, inArray, sql } from 'drizzle-orm';
import { BaseQueryHandler } from '../../common/handlers/base-query.handler';
import { people } from '../../database/schema';
import type {
  CreatedPerson,
  NewPerson,
  PersonContact,
  PersonRecord,
} from '../interfaces/person.interface';

/** Data access for the `people` table. */
@Injectable()
export class PeopleQueryHandler extends BaseQueryHandler {
  async findByAuthUserId(authUserId: string): Promise<PersonRecord | null> {
    const rows = await this.db
      .select({ id: people.id, fullName: people.fullName })
      .from(people)
      .where(eq(people.authUserId, authUserId))
      .limit(1);
    return this.firstOrNull(rows);
  }

  async findByPhone(phone: string): Promise<PersonRecord | null> {
    const rows = await this.db
      .select({ id: people.id, fullName: people.fullName })
      .from(people)
      .where(eq(people.phone, phone))
      .limit(1);
    return this.firstOrNull(rows);
  }

  async findContactsByIds(ids: string[]): Promise<PersonContact[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.db
      .select({ id: people.id, fullName: people.fullName, phone: people.phone })
      .from(people)
      .where(inArray(people.id, ids));
  }

  async findContactById(id: string): Promise<PersonContact | null> {
    const rows = await this.findContactsByIds([id]);
    return this.firstOrNull(rows);
  }

  async create(person: NewPerson): Promise<CreatedPerson> {
    const [created] = await this.db
      .insert(people)
      .values(person)
      .returning({ id: people.id });
    return created;
  }

  async touchLastLogin(personId: string): Promise<void> {
    await this.db
      .update(people)
      .set({ lastLoginAt: sql`now()` })
      .where(eq(people.id, personId));
  }
}
