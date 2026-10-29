import { and, eq } from 'drizzle-orm';
import { reminders, workspaces } from '../src/database/schema';
import { ReminderAudience } from '../src/reminders/enums/reminder-audience.enum';
import { ReminderKind } from '../src/reminders/enums/reminder-kind.enum';
import { ReminderSubjectType } from '../src/reminders/enums/reminder-subject-type.enum';
import { RemindersService } from '../src/reminders/reminders.service';
import { WhatsAppTemplate } from '../src/whatsapp/enums/whatsapp-template.enum';
import { HttpTestApp, type TestSession } from './support/http-test-app';

jest.setTimeout(30_000);

describe('Reminders over HTTP and the database', () => {
  let harness: HttpTestApp;
  let service: RemindersService;

  beforeAll(async () => {
    harness = await HttpTestApp.start();
    service = harness.app.get(RemindersService);
  });

  afterAll(() => harness.stop(), 60_000);

  const newCoach = async (brandName = 'Reminder Gym') => {
    const { session } = await harness.signedUpPerson();
    const created = await harness
      .as(session)
      .post('/workspaces')
      .send({ brandName })
      .expect(201);
    harness.trackWorkspace(created.body.id);
    return { session, workspaceId: created.body.id as string };
  };

  const addClient = async (session: TestSession, fullName = 'Omar Khaled') => {
    const phone = harness.uniquePhone();
    const body = (
      await harness
        .as(session)
        .post('/clients')
        .send({ fullName, phone })
        .expect(201)
    ).body as { id: string };
    return { ...body, phone };
  };

  const addPackage = async (session: TestSession, durationDays: number) =>
    (
      await harness
        .as(session)
        .post('/packages')
        .send({ name: `${durationDays} days`, durationDays, priceMinor: 0 })
        .expect(201)
    ).body as { id: string };

  const sell = async (
    session: TestSession,
    clientId: string,
    packageId: string,
    startsOn?: string,
  ) =>
    (
      await harness
        .as(session)
        .post(`/clients/${clientId}/subscriptions`)
        .send({ packageId, startsOn })
        .expect(201)
    ).body as { id: string; endsOn: string };

  /** A coach with a client holding a subscription of this many days. */
  const ready = async (durationDays = 30, brandName?: string) => {
    const coach = await newCoach(brandName);
    const client = await addClient(coach.session);
    // reminders go only to a client who agreed to receive them
    await harness.grantClientConsents(coach.workspaceId, client.id);
    const pkg = await addPackage(coach.session, durationDays);
    const subscription = await sell(coach.session, client.id, pkg.id);
    return { ...coach, client, pkg, subscription };
  };

  const rowsOf = (workspaceId: string, subscriptionId: string) =>
    harness.tx.run(
      () =>
        harness.tx.db
          .select({
            id: reminders.id,
            kind: reminders.kind,
            audience: reminders.audience,
            channel: reminders.channel,
            scheduledFor: reminders.scheduledFor,
            sentAt: reminders.sentAt,
            failedReason: reminders.failedReason,
            payload: reminders.payload,
          })
          .from(reminders)
          .where(eq(reminders.subjectId, subscriptionId))
          .orderBy(reminders.scheduledFor),
      { workspaceId },
    );

  /** Makes every reminder of the subscription due now, as if its day had come. */
  const makeDue = (workspaceId: string, subscriptionId: string) =>
    harness.tx.run(
      () =>
        harness.tx.db
          .update(reminders)
          .set({ scheduledFor: new Date(Date.now() - 60_000) })
          .where(eq(reminders.subjectId, subscriptionId)),
      { workspaceId },
    );

  const sentTo = (phone: string) =>
    harness.whatsapp.outbox.filter((message) => message.to === phone);

  const daysFromToday = (days: number) => {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Cairo',
    }).format(new Date());
    const moved = new Date(Date.parse(`${today}T00:00:00Z`));
    moved.setUTCDate(moved.getUTCDate() + days);
    return moved.toISOString().slice(0, 10);
  };

  describe('planning', () => {
    it('plans a warning three days before the end and a notice on the end date, for the client', async () => {
      const { workspaceId, subscription } = await ready(30);

      const rows = await rowsOf(workspaceId, subscription.id);

      expect(rows).toEqual([
        expect.objectContaining({
          kind: 'expiring_soon',
          audience: ReminderAudience.CLIENT,
          channel: 'whatsapp',
          sentAt: null,
          payload: { endsOn: subscription.endsOn },
        }),
        expect.objectContaining({
          kind: ReminderKind.EXPIRED,
          audience: ReminderAudience.CLIENT,
          channel: 'whatsapp',
          sentAt: null,
          payload: { endsOn: subscription.endsOn },
        }),
      ]);
      expect(rows[0].scheduledFor.getTime()).toBeLessThan(
        rows[1].scheduledFor.getTime(),
      );
    });

    it('plans only what is still ahead for a subscription that is nearly over', async () => {
      const { workspaceId, subscription } = await ready(2);

      const rows = await rowsOf(workspaceId, subscription.id);

      expect(rows.map((row) => row.kind)).toEqual(['expired']);
    });

    it('plans again from the new date when the coach moves the end', async () => {
      const { session, workspaceId, subscription } = await ready(30);
      const before = await rowsOf(workspaceId, subscription.id);

      await harness
        .as(session)
        .patch(`/subscriptions/${subscription.id}`)
        .send({ endsOn: daysFromToday(60) })
        .expect(200);
      const after = await rowsOf(workspaceId, subscription.id);

      expect(after).toHaveLength(2);
      expect(after[0].payload).toEqual({ endsOn: daysFromToday(60) });
      expect(after[0].scheduledFor.getTime()).toBeGreaterThan(
        before[1].scheduledFor.getTime(),
      );
    });

    it('does not plan a second set when the end date is saved again', async () => {
      const { session, workspaceId, subscription } = await ready(30);

      for (let i = 0; i < 2; i += 1) {
        await harness
          .as(session)
          .patch(`/subscriptions/${subscription.id}`)
          .send({ endsOn: daysFromToday(45) })
          .expect(200);
      }

      expect(await rowsOf(workspaceId, subscription.id)).toHaveLength(2);
    });

    it('drops them while the subscription is frozen and plans them again on resume, from the later date', async () => {
      const { session, workspaceId, subscription } = await ready(30);
      const url = `/subscriptions/${subscription.id}`;

      await harness.as(session).post(`${url}/freeze`).expect(201);
      expect(await rowsOf(workspaceId, subscription.id)).toEqual([]);

      await harness
        .as(session)
        .post(`${url}/resume`)
        .send({ resumedOn: daysFromToday(10) })
        .expect(201);
      const rows = await rowsOf(workspaceId, subscription.id);

      expect(rows).toHaveLength(2);
      expect(rows[0].payload).toEqual({ endsOn: daysFromToday(39) });
    });

    it('drops them when the subscription is cancelled', async () => {
      const { session, workspaceId, subscription } = await ready(30);

      await harness
        .as(session)
        .post(`/subscriptions/${subscription.id}/cancel`)
        .expect(201);

      expect(await rowsOf(workspaceId, subscription.id)).toEqual([]);
    });

    it('drops them for a subscription closed to make room for a new one', async () => {
      const coach = await newCoach();
      const client = await addClient(coach.session);
      const pkg = await addPackage(coach.session, 30);
      const old = await sell(
        coach.session,
        client.id,
        pkg.id,
        daysFromToday(-40),
      );
      // the old one ended 11 days ago, so its notice was due and is left to the sender
      await harness.tx.run(
        () =>
          harness.tx.db
            .delete(reminders)
            .where(eq(reminders.subjectId, old.id)),
        { workspaceId: coach.workspaceId },
      );
      await harness.tx.run(
        () =>
          harness.tx.db.insert(reminders).values({
            workspaceId: coach.workspaceId,
            clientId: client.id,
            subjectType: ReminderSubjectType.SUBSCRIPTION,
            subjectId: old.id,
            kind: ReminderKind.EXPIRED,
            audience: ReminderAudience.CLIENT,
            scheduledFor: new Date(Date.now() + 86_400_000),
          }),
        { workspaceId: coach.workspaceId },
      );

      await sell(coach.session, client.id, pkg.id);

      expect(await rowsOf(coach.workspaceId, old.id)).toEqual([]);
    });

    it('keeps what already went out when the end date moves, and does not send it again', async () => {
      const { session, workspaceId, subscription } = await ready(30);
      await makeDue(workspaceId, subscription.id);
      await service.dispatchDue();

      await harness
        .as(session)
        .patch(`/subscriptions/${subscription.id}`)
        .send({ endsOn: daysFromToday(60) })
        .expect(200);
      const rows = await rowsOf(workspaceId, subscription.id);

      expect(rows).toHaveLength(2);
      expect(rows.every((row) => row.sentAt !== null)).toBe(true);
      expect(rows[0].payload).toEqual({ endsOn: subscription.endsOn });
    });
  });

  describe('sending', () => {
    it('tells the client in Arabic what their coach’s brand is and when it ends', async () => {
      const { workspaceId, client, subscription } = await ready(
        30,
        'Coach Hana Fitness',
      );
      await makeDue(workspaceId, subscription.id);
      harness.whatsapp.clear();

      const delivered = await service.dispatchDue();

      expect(delivered).toBeGreaterThanOrEqual(2);
      const messages = sentTo(client.phone);
      expect(messages).toHaveLength(2);
      expect(messages.map((m) => m.template).sort()).toEqual([
        WhatsAppTemplate.SUBSCRIPTION_EXPIRED,
        WhatsAppTemplate.SUBSCRIPTION_EXPIRING,
      ]);
      for (const message of messages) {
        expect(message.language).toBe('ar');
        expect(message.params).toEqual([
          'Omar Khaled',
          'Coach Hana Fitness',
          subscription.endsOn,
        ]);
      }
    });

    it('marks what it sent, so a second run sends nothing', async () => {
      const { workspaceId, client, subscription } = await ready(30);
      await makeDue(workspaceId, subscription.id);
      await service.dispatchDue();
      harness.whatsapp.clear();

      await service.dispatchDue();

      expect(sentTo(client.phone)).toEqual([]);
      const rows = await rowsOf(workspaceId, subscription.id);
      expect(rows.every((row) => row.sentAt !== null)).toBe(true);
    });

    it('sends each reminder once even when two senders run at the same time', async () => {
      const { workspaceId, client, subscription } = await ready(30);
      await makeDue(workspaceId, subscription.id);
      harness.whatsapp.clear();

      await Promise.all([
        service.dispatchDue(),
        service.dispatchDue(),
        service.dispatchDue(),
      ]);

      expect(sentTo(client.phone)).toHaveLength(2);
    });

    it('leaves a reminder that is not due yet alone', async () => {
      const { workspaceId, client, subscription } = await ready(30);
      harness.whatsapp.clear();

      await service.dispatchDue();

      expect(sentTo(client.phone)).toEqual([]);
      const rows = await rowsOf(workspaceId, subscription.id);
      expect(rows.every((row) => row.sentAt === null)).toBe(true);
    });

    it('reaches the clients of every workspace, each with their own coach’s brand', async () => {
      const first = await ready(30, 'First Coach');
      const second = await ready(30, 'Second Coach');
      await makeDue(first.workspaceId, first.subscription.id);
      await makeDue(second.workspaceId, second.subscription.id);
      harness.whatsapp.clear();

      await service.dispatchDue();

      expect(sentTo(first.client.phone)[0].params[1]).toBe('First Coach');
      expect(sentTo(second.client.phone)[0].params[1]).toBe('Second Coach');
    });

    it('does not message a client who was removed, and says why', async () => {
      const { session, workspaceId, client, subscription } = await ready(30);
      await makeDue(workspaceId, subscription.id);
      await harness.as(session).delete(`/clients/${client.id}`).expect(204);
      harness.whatsapp.clear();

      await service.dispatchDue();

      expect(sentTo(client.phone)).toEqual([]);
      const rows = await rowsOf(workspaceId, subscription.id);
      expect(rows.map((row) => row.failedReason)).toEqual([
        'client_removed',
        'client_removed',
      ]);
    });

    it('records that a send failed without keeping the provider’s error, and does not retry it', async () => {
      const { workspaceId, client, subscription } = await ready(30);
      await makeDue(workspaceId, subscription.id);
      const send = jest
        .spyOn(harness.whatsapp, 'sendTemplate')
        .mockRejectedValue(new Error(`provider said no to ${client.phone}`));

      await service.dispatchDue();
      await service.dispatchDue();
      expect(send).toHaveBeenCalledTimes(2);
      send.mockRestore();

      const rows = await rowsOf(workspaceId, subscription.id);
      expect(rows.map((row) => row.failedReason)).toEqual([
        'send_failed',
        'send_failed',
      ]);
      expect(rows.every((row) => row.sentAt !== null)).toBe(true);
    });

    it('carries on with the others when one reminder cannot be delivered', async () => {
      const broken = await ready(30);
      const fine = await ready(30);
      await makeDue(broken.workspaceId, broken.subscription.id);
      await makeDue(fine.workspaceId, fine.subscription.id);
      harness.whatsapp.clear();
      const real = harness.whatsapp.sendTemplate.bind(harness.whatsapp);
      const send = jest
        .spyOn(harness.whatsapp, 'sendTemplate')
        .mockImplementation((message) =>
          message.to === broken.client.phone
            ? Promise.reject(new Error('nope'))
            : real(message),
        );

      await service.dispatchDue();
      send.mockRestore();

      expect(sentTo(fine.client.phone)).toHaveLength(2);
      const rows = await rowsOf(fine.workspaceId, fine.subscription.id);
      expect(rows.every((row) => row.failedReason === null)).toBe(true);
    });
  });

  describe('integrity', () => {
    it('never holds two reminders for the same subscription, kind and audience', async () => {
      const { workspaceId, client, subscription } = await ready(30);

      await expect(
        harness.tx.run(
          () =>
            harness.tx.db.insert(reminders).values({
              workspaceId,
              clientId: client.id,
              subjectType: ReminderSubjectType.SUBSCRIPTION,
              subjectId: subscription.id,
              kind: ReminderKind.EXPIRED,
              audience: ReminderAudience.CLIENT,
              scheduledFor: new Date(Date.now() + 86_400_000),
            }),
          { workspaceId },
        ),
      ).rejects.toMatchObject({ cause: { code: '23505' } });
    });

    it('goes with the workspace when it is deleted', async () => {
      const { workspaceId, subscription } = await ready(30);

      await harness.tx.run(
        async () => {
          await harness.tx.db
            .delete(workspaces)
            .where(eq(workspaces.id, workspaceId));
        },
        { workspaceId },
      );

      const left = await harness.tx.run(
        () =>
          harness.tx.db
            .select({ id: reminders.id })
            .from(reminders)
            .where(
              and(
                eq(reminders.subjectId, subscription.id),
                eq(reminders.workspaceId, workspaceId),
              ),
            ),
        { system: true },
      );
      expect(left).toEqual([]);
    });
  });
});
