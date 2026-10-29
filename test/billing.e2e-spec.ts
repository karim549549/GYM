import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { platformAdmins, platformSubscriptions } from '../src/database/schema';
import { HttpTestApp, type TestSession } from './support/http-test-app';

jest.setTimeout(60_000);

describe('Billing: what coaches pay the platform', () => {
  let harness: HttpTestApp;
  let admin: TestSession;

  beforeAll(async () => {
    harness = await HttpTestApp.start();
    const { body, session } = await harness.signedUpPerson();
    const person = await harness.personRow(body.phone as string);
    await harness.tx.db.insert(platformAdmins).values({ personId: person.id });
    admin = session;
  });

  afterAll(() => harness.stop(), 60_000);

  const newCoach = async () => {
    const { session } = await harness.signedUpPerson();
    const created = await harness
      .as(session)
      .post('/workspaces')
      .send({ brandName: 'Billing Gym' })
      .expect(201);
    harness.trackWorkspace(created.body.id);
    return { session, workspaceId: created.body.id as string };
  };

  const addClient = (session: TestSession, phone = harness.uniquePhone()) =>
    harness
      .as(session)
      .post('/clients')
      .send({ fullName: 'Omar Khaled', phone });

  const addClients = async (session: TestSession, total: number) => {
    const added: { id: string; phone: string }[] = [];
    for (let i = 0; i < total; i += 1) {
      const phone = harness.uniquePhone();
      const response = await addClient(session, phone).expect(201);
      added.push({ id: response.body.id, phone });
    }
    return added;
  };

  type Invoice = {
    id: string;
    planId: string;
    amountMinor: number;
    currency: string;
    periodStart: string;
    periodEnd: string;
    status: string;
    method: string | null;
    paidAt: string | null;
    createdAt: string;
  };
  type Overview = {
    plan: {
      id: string;
      name: string;
      priceMinor: number;
      currency: string;
      clientLimit: number | null;
      interval: string;
    };
    status: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    usage: { clients: number; limit: number | null };
    openInvoice: Invoice | null;
  };

  const overview = async (session: TestSession) =>
    (await harness.as(session).get('/billing/subscription').expect(200))
      .body as Overview;

  const change = (session: TestSession, planId: string) =>
    harness.as(session).post('/billing/subscription/change').send({ planId });

  const asAdmin = () => harness.as(admin);

  const pay = (
    invoiceId: string,
    body: Record<string, unknown> = { method: 'instapay' },
  ) =>
    asAdmin().post(`/admin/billing/invoices/${invoiceId}/mark-paid`).send(body);

  /** A coach who asked for a plan: the invoice waiting to be paid. */
  const requested = async (session: TestSession, planId: string) => {
    const result = (await change(session, planId).expect(201)).body as Overview;
    return result.openInvoice as Invoice;
  };

  /** A coach on a paid plan, as if they had paid. */
  const onPlan = async (planId: string) => {
    const coach = await newCoach();
    const invoice = await requested(coach.session, planId);
    await pay(invoice.id).expect(201);
    return coach;
  };

  const cairoToday = () =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(
      new Date(),
    );
  const daysFromToday = (days: number) => {
    const moved = new Date(Date.parse(`${cairoToday()}T00:00:00Z`));
    moved.setUTCDate(moved.getUTCDate() + days);
    return moved.toISOString().slice(0, 10);
  };

  describe('GET /billing/plans', () => {
    it('lists what the platform sells, cheapest first', async () => {
      const { session } = await newCoach();

      const response = await harness
        .as(session)
        .get('/billing/plans')
        .expect(200);

      expect(response.body).toEqual([
        {
          id: 'free',
          name: 'Free',
          priceMinor: 0,
          currency: 'EGP',
          clientLimit: 5,
          interval: 'month',
        },
        {
          id: 'basic',
          name: 'Basic',
          priceMinor: 39_900,
          currency: 'EGP',
          clientLimit: 30,
          interval: 'month',
        },
        {
          id: 'pro',
          name: 'Pro',
          priceMinor: 79_900,
          currency: 'EGP',
          clientLimit: null,
          interval: 'month',
        },
        {
          id: 'basic_annual',
          name: 'Basic (yearly)',
          priceMinor: 399_000,
          currency: 'EGP',
          clientLimit: 30,
          interval: 'year',
        },
        {
          id: 'pro_annual',
          name: 'Pro (yearly)',
          priceMinor: 799_000,
          currency: 'EGP',
          clientLimit: null,
          interval: 'year',
        },
      ]);
    });
  });

  describe('a new coach', () => {
    it('starts on the free plan with five places and none used', async () => {
      const { session } = await newCoach();

      const result = await overview(session);

      expect(result).toEqual({
        plan: expect.objectContaining({ id: 'free', clientLimit: 5 }),
        status: 'active',
        currentPeriodStart: null,
        currentPeriodEnd: null,
        usage: { clients: 0, limit: 5 },
        openInvoice: null,
      });
    });

    it('counts clients against the places, and not the removed ones', async () => {
      const { session } = await newCoach();
      const [first] = await addClients(session, 3);

      await harness.as(session).delete(`/clients/${first.id}`).expect(204);

      expect((await overview(session)).usage).toEqual({ clients: 2, limit: 5 });
    });
  });

  describe('the client limit, enforced by the database', () => {
    it('lets a coach add five clients and refuses the sixth', async () => {
      const { session } = await newCoach();
      await addClients(session, 5);

      const response = await addClient(session).expect(409);

      expect(response.body.code).toBe('CLIENT_LIMIT_REACHED');
      expect((await overview(session)).usage.clients).toBe(5);
    });

    it('frees a place when a client is removed', async () => {
      const { session } = await newCoach();
      const added = await addClients(session, 5);
      await harness.as(session).delete(`/clients/${added[0].id}`).expect(204);

      await addClient(session).expect(201);
    });

    it('does not let a removed client be brought back past the limit', async () => {
      const { session } = await newCoach();
      const added = await addClients(session, 5);
      await harness.as(session).delete(`/clients/${added[0].id}`).expect(204);
      await addClient(session).expect(201);

      const response = await addClient(session, added[0].phone).expect(409);

      expect(response.body.code).toBe('CLIENT_LIMIT_REACHED');
    });

    it('lets only one of two additions at the same moment take the last place', async () => {
      const { session } = await newCoach();
      await addClients(session, 4);

      const results = await Promise.all([
        addClient(session),
        addClient(session),
      ]);

      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect((await overview(session)).usage.clients).toBe(5);
    });

    it('raises with the plan: a coach on Basic can have thirty', async () => {
      const { session } = await onPlan('basic');
      await addClients(session, 6);

      expect((await overview(session)).usage).toEqual({
        clients: 6,
        limit: 30,
      });
    });
  });

  describe('POST /billing/subscription/change', () => {
    it('makes an invoice for a paid plan, and changes nothing until it is paid', async () => {
      const { session } = await newCoach();

      const result = (await change(session, 'basic').expect(201))
        .body as Overview;

      expect(result.plan.id).toBe('free');
      expect(result.openInvoice).toEqual({
        id: expect.any(String),
        planId: 'basic',
        amountMinor: 39_900,
        currency: 'EGP',
        periodStart: cairoToday(),
        periodEnd: expect.any(String),
        status: 'open',
        method: null,
        paidAt: null,
        createdAt: expect.any(String),
      });
    });

    it('returns the invoice already waiting when the same plan is asked for again', async () => {
      const { session } = await newCoach();
      const first = await requested(session, 'basic');

      const second = await requested(session, 'basic');
      const list = await harness
        .as(session)
        .get('/billing/invoices')
        .expect(200);

      expect(second.id).toBe(first.id);
      expect(list.body.total).toBe(1);
    });

    it('bills a yearly plan for the year', async () => {
      const { session } = await newCoach();

      const invoice = await requested(session, 'pro_annual');

      expect(invoice.amountMinor).toBe(799_000);
    });

    it('moves to the free plan at once, cancelling what was waiting to be paid', async () => {
      const { session } = await onPlan('basic');
      await requested(session, 'pro');

      const result = (await change(session, 'free').expect(201))
        .body as Overview;
      const invoices = await harness
        .as(session)
        .get('/billing/invoices?status=void')
        .expect(200);

      expect(result).toMatchObject({
        plan: { id: 'free' },
        status: 'active',
        currentPeriodEnd: null,
        openInvoice: null,
      });
      expect(invoices.body.items.map((i: Invoice) => i.planId)).toEqual([
        'pro',
      ]);
    });

    it('is refused for the free plan when already on it', async () => {
      const { session } = await newCoach();

      const response = await change(session, 'free').expect(409);

      expect(response.body.code).toBe('ALREADY_ON_FREE_PLAN');
    });

    it('is refused for a plan with fewer places than the coach has clients', async () => {
      const { session } = await onPlan('pro');
      await addClients(session, 6);

      const toFree = await change(session, 'free').expect(409);
      const toBasic = await change(session, 'basic').expect(201);

      expect(toFree.body.code).toBe('PLAN_LIMIT_BELOW_CLIENTS');
      expect(toBasic.body.openInvoice.planId).toBe('basic');
    });

    it('is refused for a plan that does not exist', async () => {
      const { session } = await newCoach();

      const response = await change(session, 'platinum').expect(404);

      expect(response.body.code).toBe('PLATFORM_PLAN_NOT_FOUND');
    });

    it.each([
      ['no plan', {}],
      ['a blank plan', { planId: '' }],
      ['a number', { planId: 5 }],
    ])('refuses %s', async (_label, body) => {
      const { session } = await newCoach();

      await harness
        .as(session)
        .post('/billing/subscription/change')
        .send(body)
        .expect(400);
    });
  });

  describe('the platform’s people', () => {
    it('are the only ones who can see or confirm invoices', async () => {
      const { session } = await newCoach();
      const invoice = await requested(session, 'basic');

      for (const call of [
        () => harness.as(session).get('/admin/billing/invoices'),
        () =>
          harness
            .as(session)
            .post(`/admin/billing/invoices/${invoice.id}/mark-paid`)
            .send({ method: 'cash' }),
        () =>
          harness
            .as(session)
            .post(`/admin/billing/invoices/${invoice.id}/void`),
      ]) {
        const response = await call().expect(403);
        expect(response.body.code).toBe('PLATFORM_ADMIN_ONLY');
      }
      expect((await overview(session)).plan.id).toBe('free');
    });

    it('see every coach’s invoices, oldest first, and can filter them', async () => {
      const a = await newCoach();
      const b = await newCoach();
      const first = await requested(a.session, 'basic');
      const second = await requested(b.session, 'pro');
      await pay(first.id).expect(201);

      const open = await asAdmin()
        .get('/admin/billing/invoices?status=open&limit=100')
        .expect(200);
      const paid = await asAdmin()
        .get('/admin/billing/invoices?status=paid&limit=100')
        .expect(200);

      const openIds = open.body.items.map((i: Invoice) => i.id);
      expect(openIds).toContain(second.id);
      expect(openIds).not.toContain(first.id);
      expect(paid.body.items.map((i: Invoice) => i.id)).toContain(first.id);
      expect(open.body.items[0]).toHaveProperty('workspaceId');
    });
  });

  describe('confirming a transfer', () => {
    it('puts the coach on the plan for the period, and records who confirmed it', async () => {
      const { session, workspaceId } = await newCoach();
      const invoice = await requested(session, 'basic');

      const paid = await pay(invoice.id, {
        method: 'wallet',
        paidOn: daysFromToday(0),
      }).expect(201);
      const result = await overview(session);
      const list = await harness
        .as(session)
        .get('/billing/invoices')
        .expect(200);

      expect(paid.body).toMatchObject({
        id: invoice.id,
        workspaceId,
        status: 'paid',
        method: 'wallet',
        paidAt: expect.any(String),
      });
      expect(result).toMatchObject({
        plan: { id: 'basic' },
        status: 'active',
        currentPeriodStart: cairoToday(),
        usage: { limit: 30 },
        openInvoice: null,
      });
      expect(result.currentPeriodEnd).toBe(paid.body.periodEnd);
      expect(list.body.items[0]).toMatchObject({
        status: 'paid',
        method: 'wallet',
      });
    });

    it('covers a month: the period ends the day before the same date next month', async () => {
      const { session } = await onPlan('basic');

      const result = await overview(session);

      const start = new Date(`${result.currentPeriodStart}T00:00:00Z`);
      const end = new Date(`${result.currentPeriodEnd}T00:00:00Z`);
      const days = (end.getTime() - start.getTime()) / 86_400_000 + 1;
      expect(days).toBeGreaterThanOrEqual(28);
      expect(days).toBeLessThanOrEqual(31);
    });

    it('covers a year for a yearly plan', async () => {
      const { session } = await onPlan('basic_annual');

      const result = await overview(session);

      const start = new Date(`${result.currentPeriodStart}T00:00:00Z`);
      const end = new Date(`${result.currentPeriodEnd}T00:00:00Z`);
      const days = (end.getTime() - start.getTime()) / 86_400_000 + 1;
      expect(days).toBeGreaterThanOrEqual(365);
      expect(days).toBeLessThanOrEqual(366);
    });

    it('continues the plan from the day after it ends when the same plan is paid again early', async () => {
      const { session } = await onPlan('basic');
      const running = await overview(session);
      const renewal = await requested(session, 'basic');

      await pay(renewal.id).expect(201);
      const renewed = await overview(session);

      expect(renewed.currentPeriodStart).toBe(
        new Date(
          Date.parse(`${running.currentPeriodEnd}T00:00:00Z`) + 86_400_000,
        )
          .toISOString()
          .slice(0, 10),
      );
    });

    it('starts a different plan today, with no credit carried over', async () => {
      const { session } = await onPlan('basic');
      const upgrade = await requested(session, 'pro');

      await pay(upgrade.id).expect(201);
      const result = await overview(session);

      expect(result).toMatchObject({
        plan: { id: 'pro' },
        currentPeriodStart: cairoToday(),
        usage: { limit: null },
      });
    });

    it('can be confirmed only once, and by only one of two people at the same moment', async () => {
      const { session } = await newCoach();
      const invoice = await requested(session, 'basic');

      const results = await Promise.all([pay(invoice.id), pay(invoice.id)]);
      const again = await pay(invoice.id).expect(409);

      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(again.body.code).toBe('INVOICE_NOT_OPEN');
    });

    it('can cancel an invoice raised in error, but not one already paid', async () => {
      const { session } = await newCoach();
      const open = await requested(session, 'basic');
      const other = await newCoach();
      const paid = await requested(other.session, 'basic');
      await pay(paid.id).expect(201);

      const voided = await asAdmin()
        .post(`/admin/billing/invoices/${open.id}/void`)
        .expect(201);
      const refused = await asAdmin()
        .post(`/admin/billing/invoices/${paid.id}/void`)
        .expect(409);
      const late = await pay(open.id).expect(409);

      expect(voided.body.status).toBe('void');
      expect(refused.body.code).toBe('INVOICE_NOT_OPEN');
      expect(late.body.code).toBe('INVOICE_NOT_OPEN');
    });

    it('is not found for an invoice that does not exist, and refuses one that is not an id', async () => {
      const missing = await pay(randomUUID()).expect(404);
      await asAdmin()
        .post('/admin/billing/invoices/nope/mark-paid')
        .send({ method: 'cash' })
        .expect(400);

      expect(missing.body.code).toBe('INVOICE_NOT_FOUND');
    });

    it.each([
      ['no method', {}],
      ['a method nobody offers', { method: 'card' }],
      ['a date that is not a date', { method: 'cash', paidOn: 'yesterday' }],
    ])('refuses %s', async (_label, body) => {
      const { session } = await newCoach();
      const invoice = await requested(session, 'basic');

      await pay(invoice.id, body).expect(400);
    });
  });

  describe('a paid plan that was not renewed', () => {
    it('is past due the day after its period ends', async () => {
      const { session, workspaceId } = await onPlan('basic');
      await harness.tx.run(
        () =>
          harness.tx.db
            .update(platformSubscriptions)
            .set({
              currentPeriodStart: daysFromToday(-31),
              currentPeriodEnd: daysFromToday(-1),
            })
            .where(eq(platformSubscriptions.workspaceId, workspaceId)),
        { workspaceId },
      );

      expect((await overview(session)).status).toBe('past_due');
    });
  });

  describe('keeping each coach’s billing apart', () => {
    it('shows only a coach’s own invoices', async () => {
      const mine = await newCoach();
      const theirs = await newCoach();
      await requested(theirs.session, 'basic');

      const list = await harness
        .as(mine.session)
        .get('/billing/invoices')
        .expect(200);

      expect(list.body.total).toBe(0);
    });
  });
});
