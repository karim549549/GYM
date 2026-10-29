import { Injectable } from '@nestjs/common';
import { PeopleQueryHandler } from './handlers/people-query.handler';
import type {
  CreatedPerson,
  NewPerson,
  PersonContact,
  PersonRecord,
} from './interfaces/person.interface';

/** The people module's interface: the global identity table, one row per login. */
@Injectable()
export class PeopleService {
  constructor(private readonly peopleQuery: PeopleQueryHandler) {}

  findByAuthUserId(authUserId: string): Promise<PersonRecord | null> {
    return this.peopleQuery.findByAuthUserId(authUserId);
  }

  findByPhone(phone: string): Promise<PersonRecord | null> {
    return this.peopleQuery.findByPhone(phone);
  }

  findContactsByIds(ids: string[]): Promise<PersonContact[]> {
    return this.peopleQuery.findContactsByIds(ids);
  }

  findContactById(id: string): Promise<PersonContact | null> {
    return this.peopleQuery.findContactById(id);
  }

  create(person: NewPerson): Promise<CreatedPerson> {
    return this.peopleQuery.create(person);
  }

  /** Called when a login succeeds, not on every request. */
  recordLogin(personId: string): Promise<void> {
    return this.peopleQuery.touchLastLogin(personId);
  }
}
