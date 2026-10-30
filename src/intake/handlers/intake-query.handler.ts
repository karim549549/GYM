import { Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { BaseQueryHandler } from '../../common/handlers/base-query.handler';
import { intakeLinks, intakeResponses } from '../../database/schema';
import type { IntakeSubmitter } from '../enums/intake-submitter.enum';
import type {
  IntakeLinkTarget,
  IntakeResponseView,
} from '../interfaces/intake.interface';

/** Data access for `intake_links` and `intake_responses`. Row level security keeps it to one workspace. */
@Injectable()
export class IntakeQueryHandler extends BaseQueryHandler {
  /** The newest link of this client that can still be used. */
  async findOpenLinkForClient(clientId: string): Promise<{
    id: string;
    token: string;
    expiresAt: Date;
    namedFormId: string | null;
  } | null> {
    const rows = await this.db
      .select({
        id: intakeLinks.id,
        token: intakeLinks.token,
        expiresAt: intakeLinks.expiresAt,
        namedFormId: intakeLinks.namedFormId,
      })
      .from(intakeLinks)
      .where(
        and(
          eq(intakeLinks.clientId, clientId),
          isNull(intakeLinks.submittedAt),
          gt(intakeLinks.expiresAt, sql`now()`),
        ),
      )
      .orderBy(desc(intakeLinks.createdAt))
      .limit(1);
    return this.firstOrNull(rows);
  }

  async createLink(
    workspaceId: string,
    clientId: string,
    token: string,
    namedFormId: string | null = null,
  ): Promise<{ token: string; expiresAt: Date; namedFormId: string | null }> {
    const [created] = await this.db
      .insert(intakeLinks)
      .values({ workspaceId, clientId, token, namedFormId })
      .returning({
        token: intakeLinks.token,
        expiresAt: intakeLinks.expiresAt,
        namedFormId: intakeLinks.namedFormId,
      });
    return created;
  }

  /** Changes which form an open link asks. The address stays the same. */
  async pinLink(id: string, namedFormId: string | null): Promise<void> {
    await this.db
      .update(intakeLinks)
      .set({ namedFormId })
      .where(and(eq(intakeLinks.id, id), isNull(intakeLinks.submittedAt)));
  }

  /** Only visible while acting under that token (see the `intakeToken` scope): no workspace is needed to find it. */
  async findLinkByToken(token: string): Promise<IntakeLinkTarget | null> {
    const rows = await this.db
      .select({
        id: intakeLinks.id,
        workspaceId: intakeLinks.workspaceId,
        clientId: intakeLinks.clientId,
        expiresAt: intakeLinks.expiresAt,
        submittedAt: intakeLinks.submittedAt,
        namedFormId: intakeLinks.namedFormId,
      })
      .from(intakeLinks)
      .where(eq(intakeLinks.token, token))
      .limit(1);
    return this.firstOrNull(rows);
  }

  /**
   * Takes the link, atomically: of two requests racing for it, one gets true and the other
   * waits for the first to finish and then gets false. This is what makes a link single use.
   */
  async claimLink(id: string): Promise<boolean> {
    const rows = await this.db
      .update(intakeLinks)
      .set({ submittedAt: sql`now()` })
      .where(
        and(
          eq(intakeLinks.id, id),
          isNull(intakeLinks.submittedAt),
          gt(intakeLinks.expiresAt, sql`now()`),
        ),
      )
      .returning({ id: intakeLinks.id });
    return rows.length > 0;
  }

  async insertResponse(response: {
    workspaceId: string;
    clientId: string;
    linkId: string;
    answers: Record<string, unknown>;
    formVersion: string;
    templateId: string | null;
    submittedBy: IntakeSubmitter;
  }): Promise<{ submittedAt: Date }> {
    const [created] = await this.db
      .insert(intakeResponses)
      .values(response)
      .returning({ submittedAt: intakeResponses.submittedAt });
    return created;
  }

  async findLatestResponse(
    clientId: string,
  ): Promise<IntakeResponseView | null> {
    const rows = await this.db
      .select({
        submittedAt: intakeResponses.submittedAt,
        submittedBy: intakeResponses.submittedBy,
        formVersion: intakeResponses.formVersion,
        templateId: intakeResponses.templateId,
        answers: intakeResponses.answers,
      })
      .from(intakeResponses)
      .where(eq(intakeResponses.clientId, clientId))
      .orderBy(desc(intakeResponses.submittedAt))
      .limit(1);
    return this.firstOrNull(rows);
  }
}
