import { Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { BaseQueryHandler } from '../../common/handlers/base-query.handler';
import { programLinks } from '../../database/schema';
import type { ProgramLinkTarget } from '../interfaces/program-link.interface';

const TARGET = {
  id: programLinks.id,
  workspaceId: programLinks.workspaceId,
  clientId: programLinks.clientId,
  token: programLinks.token,
  passwordHash: programLinks.passwordHash,
  sessionVersion: programLinks.sessionVersion,
  failedAttempts: programLinks.failedAttempts,
  lockedUntil: programLinks.lockedUntil,
};

/** Data access for `program_links`. Row level security keeps it to one workspace, or to one link by its token. */
@Injectable()
export class ProgramLinksQueryHandler extends BaseQueryHandler {
  async findByClient(clientId: string): Promise<ProgramLinkTarget | null> {
    const rows = await this.db
      .select(TARGET)
      .from(programLinks)
      .where(eq(programLinks.clientId, clientId))
      .limit(1);
    return this.firstOrNull(rows);
  }

  /** Only visible while acting under that token (see the `programToken` scope): no workspace is needed to find it. */
  async findByToken(token: string): Promise<ProgramLinkTarget | null> {
    const rows = await this.db
      .select(TARGET)
      .from(programLinks)
      .where(eq(programLinks.token, token))
      .limit(1);
    return this.firstOrNull(rows);
  }

  async create(
    workspaceId: string,
    clientId: string,
    token: string,
  ): Promise<ProgramLinkTarget> {
    const [created] = await this.db
      .insert(programLinks)
      .values({ workspaceId, clientId, token })
      .returning(TARGET);
    return created;
  }

  /**
   * Stores the password the client chose, atomically and only while none is set: of two first visits
   * racing, one gets true and the other false.
   */
  async setPassword(id: string, passwordHash: string): Promise<boolean> {
    const rows = await this.db
      .update(programLinks)
      .set({
        passwordHash,
        passwordSetAt: sql`now()`,
        failedAttempts: 0,
        lockedUntil: null,
      })
      .where(and(eq(programLinks.id, id), isNull(programLinks.passwordHash)))
      .returning({ id: programLinks.id });
    return rows.length > 0;
  }

  /** One more wrong try; the one that reaches the limit locks the link for a while. */
  async recordFailure(
    id: string,
    lockAfter: number,
    lockMinutes: number,
  ): Promise<void> {
    await this.db
      .update(programLinks)
      .set({
        failedAttempts: sql`${programLinks.failedAttempts} + 1`,
        lockedUntil: sql`case when ${programLinks.failedAttempts} + 1 >= ${lockAfter}
          then now() + make_interval(mins => ${lockMinutes})
          else ${programLinks.lockedUntil} end`,
      })
      .where(eq(programLinks.id, id));
  }

  async clearFailures(id: string): Promise<void> {
    await this.db
      .update(programLinks)
      .set({ failedAttempts: 0, lockedUntil: null })
      .where(eq(programLinks.id, id));
  }

  /** Forgets the password and signs every device out, keeping the address. */
  async resetAccess(id: string): Promise<void> {
    await this.db
      .update(programLinks)
      .set({
        passwordHash: null,
        passwordSetAt: null,
        sessionVersion: sql`${programLinks.sessionVersion} + 1`,
        failedAttempts: 0,
        lockedUntil: null,
      })
      .where(eq(programLinks.id, id));
  }

  /** A new address, and the old one stops working; the password and every session go with it. */
  async rotate(id: string, token: string): Promise<ProgramLinkTarget> {
    const [rotated] = await this.db
      .update(programLinks)
      .set({
        token,
        passwordHash: null,
        passwordSetAt: null,
        sessionVersion: sql`${programLinks.sessionVersion} + 1`,
        failedAttempts: 0,
        lockedUntil: null,
      })
      .where(eq(programLinks.id, id))
      .returning(TARGET);
    return rotated;
  }
}
