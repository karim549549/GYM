import { Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { BaseQueryHandler } from '../../common/handlers/base-query.handler';
import { clientConsents, personConsents } from '../../database/schema';
import type { ClientConsentType } from '../enums/client-consent-type.enum';
import type { ConsentSource } from '../enums/consent-source.enum';
import type { PersonConsentType } from '../enums/person-consent-type.enum';
import type { StoredConsent } from '../interfaces/consent.interface';

interface NewConsentRow<T> {
  type: T;
  granted: boolean;
  textVersion: string;
  source: ConsentSource;
}

/** Data access for the two consent ledgers. Rows are only ever added. */
@Injectable()
export class ConsentsQueryHandler extends BaseQueryHandler {
  /** The newest row of each type for a client: where each consent stands. */
  newestForClient(clientId: string): Promise<StoredConsent[]> {
    return this.db
      .selectDistinctOn([clientConsents.type], {
        type: clientConsents.type,
        granted: clientConsents.granted,
        textVersion: clientConsents.textVersion,
        source: clientConsents.source,
        recordedAt: clientConsents.recordedAt,
      })
      .from(clientConsents)
      .where(eq(clientConsents.clientId, clientId))
      .orderBy(clientConsents.type, desc(clientConsents.seq));
  }

  async addForClient(
    workspaceId: string,
    clientId: string,
    rows: NewConsentRow<ClientConsentType>[],
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }
    await this.db
      .insert(clientConsents)
      .values(rows.map((row) => ({ workspaceId, clientId, ...row })));
  }

  newestForPerson(personId: string): Promise<StoredConsent[]> {
    return this.db
      .selectDistinctOn([personConsents.type], {
        type: personConsents.type,
        granted: personConsents.granted,
        textVersion: personConsents.textVersion,
        source: personConsents.source,
        recordedAt: personConsents.recordedAt,
      })
      .from(personConsents)
      .where(eq(personConsents.personId, personId))
      .orderBy(personConsents.type, desc(personConsents.seq));
  }

  async addForPerson(
    personId: string,
    rows: NewConsentRow<PersonConsentType>[],
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }
    await this.db
      .insert(personConsents)
      .values(rows.map((row) => ({ personId, ...row })));
  }
}
