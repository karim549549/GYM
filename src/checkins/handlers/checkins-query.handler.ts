import { Injectable } from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  isNotNull,
  isNull,
  lt,
  lte,
  max,
  sql,
} from 'drizzle-orm';
import {
  BaseQueryHandler,
  type PaginatedResponse,
} from '../../common/handlers/base-query.handler';
import { checkinSchedules, checkins } from '../../database/schema';
import { CheckinStatus } from '../enums/checkin-status.enum';
import type {
  ActiveSchedule,
  CheckinActivity,
  CheckinFilter,
  CheckinLinkTarget,
  CheckinScheduleRecord,
  NewCheckin,
  QuietClient,
  StoredCheckin,
} from '../interfaces/checkin.interface';

const SCHEDULE = {
  frequency: checkinSchedules.frequency,
  dayOfWeek: checkinSchedules.dayOfWeek,
  sendHour: checkinSchedules.sendHour,
  isActive: checkinSchedules.isActive,
};

const CHECKIN = {
  id: checkins.id,
  clientId: checkins.clientId,
  dueOn: checkins.dueOn,
  token: checkins.token,
  formVersion: checkins.formVersion,
  templateId: checkins.templateId,
  answers: checkins.answers,
  submittedAt: checkins.submittedAt,
  coachReply: checkins.coachReply,
  repliedAt: checkins.repliedAt,
};

/** Data access for `checkin_schedules` and `checkins`. Row level security keeps it to one workspace. */
@Injectable()
export class CheckinsQueryHandler extends BaseQueryHandler {
  /** Sets how the client checks in, turning it on if it was stopped. The id is for the check-ins made from it. */
  async upsertSchedule(
    workspaceId: string,
    clientId: string,
    schedule: Omit<CheckinScheduleRecord, 'isActive'>,
  ): Promise<CheckinScheduleRecord & { id: string }> {
    const [saved] = await this.db
      .insert(checkinSchedules)
      .values({ workspaceId, clientId, ...schedule })
      .onConflictDoUpdate({
        target: checkinSchedules.clientId,
        set: { ...schedule, isActive: true },
      })
      .returning({ id: checkinSchedules.id, ...SCHEDULE });
    return saved;
  }

  async findSchedule(
    clientId: string,
  ): Promise<(CheckinScheduleRecord & { id: string }) | null> {
    const rows = await this.db
      .select({ id: checkinSchedules.id, ...SCHEDULE })
      .from(checkinSchedules)
      .where(eq(checkinSchedules.clientId, clientId))
      .limit(1);
    return this.firstOrNull(rows);
  }

  /** Turns the schedule off. False when the client never had one. */
  async deactivateSchedule(clientId: string): Promise<boolean> {
    const rows = await this.db
      .update(checkinSchedules)
      .set({ isActive: false })
      .where(eq(checkinSchedules.clientId, clientId))
      .returning({ id: checkinSchedules.id });
    return rows.length > 0;
  }

  /** Every schedule that is on, in every workspace: for the system's job, which may read nothing else. */
  listActiveSchedules(): Promise<ActiveSchedule[]> {
    return this.db
      .select({
        id: checkinSchedules.id,
        workspaceId: checkinSchedules.workspaceId,
        clientId: checkinSchedules.clientId,
        frequency: checkinSchedules.frequency,
        dayOfWeek: checkinSchedules.dayOfWeek,
        sendHour: checkinSchedules.sendHour,
      })
      .from(checkinSchedules)
      .where(eq(checkinSchedules.isActive, true));
  }

  /** Drops the coming check-ins nobody has answered, after `day`. Returns their ids. */
  async deleteOpenAfter(clientId: string, day: string): Promise<string[]> {
    const rows = await this.db
      .delete(checkins)
      .where(
        and(
          eq(checkins.clientId, clientId),
          gt(checkins.dueOn, day),
          isNull(checkins.submittedAt),
        ),
      )
      .returning({ id: checkins.id });
    return rows.map((row) => row.id);
  }

  /**
   * Creates the check-ins that do not exist yet. A day the client already has one for is left alone
   * (that is the unique rule on client and day, named so that a clash of tokens, which would be a
   * real error, is not swallowed with it).
   */
  async createMany(
    planned: NewCheckin[],
  ): Promise<{ id: string; clientId: string; dueOn: string; token: string }[]> {
    if (planned.length === 0) {
      return [];
    }
    return this.db
      .insert(checkins)
      .values(planned)
      .onConflictDoNothing({ target: [checkins.clientId, checkins.dueOn] })
      .returning({
        id: checkins.id,
        clientId: checkins.clientId,
        dueOn: checkins.dueOn,
        token: checkins.token,
      });
  }

  async lastDueOn(clientId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ last: max(checkins.dueOn) })
      .from(checkins)
      .where(eq(checkins.clientId, clientId));
    return row?.last ?? null;
  }

  list(
    filter: CheckinFilter,
    today: string,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<StoredCheckin>> {
    const where = and(
      filter.clientId ? eq(checkins.clientId, filter.clientId) : undefined,
      filter.status ? this.hasStatus(filter.status, today) : undefined,
      filter.needsReply
        ? and(isNotNull(checkins.submittedAt), isNull(checkins.coachReply))
        : undefined,
    );
    return this.executePageQuery(
      {
        fetchItems: (take, skip) =>
          this.db
            .select(CHECKIN)
            .from(checkins)
            .where(where)
            .orderBy(
              sql`${checkins.submittedAt} desc nulls last`,
              desc(checkins.dueOn),
              desc(checkins.id),
            )
            .limit(take)
            .offset(skip),
        count: async () => {
          const [row] = await this.db
            .select({ total: count() })
            .from(checkins)
            .where(where);
          return row.total;
        },
      },
      page,
      limit,
    );
  }

  /** The check-ins due in a window, oldest first: what a client was asked and what they answered. */
  async activityBetween(
    clientId: string,
    from: string,
    to: string,
  ): Promise<CheckinActivity[]> {
    return this.db
      .select({
        dueOn: checkins.dueOn,
        submittedAt: checkins.submittedAt,
        answers: checkins.answers,
      })
      .from(checkins)
      .where(
        and(
          eq(checkins.clientId, clientId),
          gte(checkins.dueOn, from),
          lte(checkins.dueOn, to),
        ),
      )
      .orderBy(asc(checkins.dueOn));
  }

  async lastSubmittedAt(clientId: string): Promise<Date | null> {
    const [row] = await this.db
      .select({ last: max(checkins.submittedAt) })
      .from(checkins)
      .where(eq(checkins.clientId, clientId));
    return row?.last ?? null;
  }

  async findById(id: string): Promise<StoredCheckin | null> {
    const rows = await this.db
      .select(CHECKIN)
      .from(checkins)
      .where(eq(checkins.id, id))
      .limit(1);
    return this.firstOrNull(rows);
  }

  /** Null when there is no such check-in or it has not been handed in. */
  async setReply(
    id: string,
    text: string,
    repliedBy: string,
  ): Promise<StoredCheckin | null> {
    const rows = await this.db
      .update(checkins)
      .set({ coachReply: text, repliedAt: sql`now()`, repliedBy })
      .where(and(eq(checkins.id, id), isNotNull(checkins.submittedAt)))
      .returning(CHECKIN);
    return this.firstOrNull(rows);
  }

  /** Clients with two or more check-ins missed in the 30 days before `today`, most missed first. */
  atRisk(
    today: string,
    since: string,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<QuietClient>> {
    const quiet = this.db
      .select({
        clientId: checkins.clientId,
        missedCount: count().as('missed_count'),
      })
      .from(checkins)
      .where(
        and(
          isNull(checkins.submittedAt),
          lt(checkins.dueOn, today),
          gt(checkins.dueOn, since),
        ),
      )
      .groupBy(checkins.clientId)
      .having(({ missedCount }) => gte(missedCount, 2))
      .as('quiet');

    return this.executePageQuery(
      {
        fetchItems: (take, skip) =>
          this.db
            .select({
              clientId: quiet.clientId,
              missedCount: quiet.missedCount,
            })
            .from(quiet)
            .orderBy(desc(quiet.missedCount), quiet.clientId)
            .limit(take)
            .offset(skip),
        count: async () => {
          const [row] = await this.db.select({ total: count() }).from(quiet);
          return row.total;
        },
      },
      page,
      limit,
    );
  }

  /** Only visible while acting under that token (see the `checkinToken` scope). */
  async findByToken(token: string): Promise<CheckinLinkTarget | null> {
    const rows = await this.db
      .select({
        id: checkins.id,
        workspaceId: checkins.workspaceId,
        clientId: checkins.clientId,
        dueOn: checkins.dueOn,
        submittedAt: checkins.submittedAt,
      })
      .from(checkins)
      .where(eq(checkins.token, token))
      .limit(1);
    return this.firstOrNull(rows);
  }

  /**
   * Hands the check-in in, atomically: of two requests racing for it, one gets the time and the
   * other waits for the first to finish and gets null. This is what makes a link single use.
   */
  async submit(
    id: string,
    answers: Record<string, unknown>,
    form: { version: string; templateId: string | null },
  ): Promise<Date | null> {
    const rows = await this.db
      .update(checkins)
      .set({
        answers,
        formVersion: form.version,
        templateId: form.templateId,
        submittedAt: sql`now()`,
      })
      .where(and(eq(checkins.id, id), isNull(checkins.submittedAt)))
      .returning({ submittedAt: checkins.submittedAt });
    return rows[0]?.submittedAt ?? null;
  }

  private hasStatus(status: CheckinStatus, today: string) {
    switch (status) {
      case CheckinStatus.SUBMITTED:
        return isNotNull(checkins.submittedAt);
      case CheckinStatus.MISSED:
        return and(isNull(checkins.submittedAt), lt(checkins.dueOn, today));
      case CheckinStatus.PENDING:
        return and(isNull(checkins.submittedAt), gte(checkins.dueOn, today));
    }
  }
}
