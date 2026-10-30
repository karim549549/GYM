import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { workspaceInvitations } from '../src/database/schema';
import { HttpTestApp, type TestSession } from './support/http-test-app';

jest.setTimeout(60_000);

interface Invitation {
  id: string;
  phone: string;
  role: string;
  state: string;
  expiresAt: string;
}

describe('Assistants and teams over HTTP and the database', () => {
  let harness: HttpTestApp;

  beforeAll(async () => {
    harness = await HttpTestApp.start();
  });

  afterAll(() => harness.stop(), 120_000);

  const person = async () => {
    const { body, session } = await harness.signedUpPerson();
    return { phone: body.phone as string, session };
  };

  const newOwner = async (brandName = 'Team Gym') => {
    const { phone, session } = await person();
    const created = await harness
      .as(session)
      .post('/workspaces')
      .send({ brandName })
      .expect(201);
    harness.trackWorkspace(created.body.id);
    return { phone, session, workspaceId: created.body.id as string };
  };

  const invite = (session: TestSession, phone: string) =>
    harness.as(session).post('/invitations').send({ phone });

  /** An owner with an assistant who has accepted. */
  const team = async (brandName?: string) => {
    const owner = await newOwner(brandName);
    const assistant = await person();
    const invitation = (
      await invite(owner.session, assistant.phone).expect(201)
    ).body as Invitation;
    await harness
      .as(assistant.session)
      .post(`/invitations/${invitation.id}/accept`)
      .expect(200);
    return { owner, assistant, invitation };
  };

  const asIn = (session: TestSession, workspaceId: string) =>
    harness.as(session, workspaceId);

  describe('POST /invitations', () => {
    it('invites a phone number as an assistant, valid for two weeks', async () => {
      const owner = await newOwner();
      const invitee = await person();

      const response = await invite(owner.session, invitee.phone).expect(201);

      expect(response.body).toMatchObject({
        phone: invitee.phone,
        role: 'assistant',
        state: 'pending',
        respondedAt: null,
      });
      const days =
        (new Date(response.body.expiresAt).getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(13.9);
      expect(days).toBeLessThan(14.1);
    });

    it('returns the same invitation when asked again for a number that has one waiting', async () => {
      const owner = await newOwner();
      const invitee = await person();
      const first = await invite(owner.session, invitee.phone).expect(201);

      const again = await invite(owner.session, invitee.phone).expect(201);

      expect(again.body.id).toBe(first.body.id);
    });

    it('accepts a local number and keeps it international', async () => {
      const owner = await newOwner();
      const local = `0${harness.uniquePhone().slice(3)}`;

      const response = await invite(owner.session, local).expect(201);

      expect(response.body.phone).toBe(`+20${local.slice(1)}`);
    });

    it('refuses a number that is not a phone number', async () => {
      const owner = await newOwner();

      await invite(owner.session, 'not-a-phone').expect(400);
    });

    it('refuses to invite someone who already has a place in the workspace, even the owner', async () => {
      const { owner, assistant } = await team();

      const assistantAgain = await invite(
        owner.session,
        assistant.phone,
      ).expect(409);
      const ownerHimself = await invite(owner.session, owner.phone).expect(409);

      expect(assistantAgain.body.code).toBe('ALREADY_A_MEMBER');
      expect(ownerHimself.body.code).toBe('ALREADY_A_MEMBER');
    });

    it('refuses an invitation from an assistant', async () => {
      const { assistant, owner } = await team();

      const response = await asIn(assistant.session, owner.workspaceId)
        .post('/invitations')
        .send({ phone: harness.uniquePhone() })
        .expect(403);

      expect(response.body.code).toBe('ROLE_NOT_ALLOWED');
    });

    it('limits how many invitations can wait at once', async () => {
      const owner = await newOwner();
      await Array.from({ length: 20 }).reduce(async (previous) => {
        await previous;
        await invite(owner.session, harness.uniquePhone()).expect(201);
      }, Promise.resolve());

      const response = await invite(
        owner.session,
        harness.uniquePhone(),
      ).expect(422);

      expect(response.body.code).toBe('INVITATION_LIMIT_REACHED');
    }, 120_000);
  });

  describe('what the invited person sees and does', () => {
    it('lists what is waiting for them, with who is asking, and nothing for anyone else', async () => {
      const owner = await newOwner('Coach Karim Fitness');
      const invitee = await person();
      const stranger = await person();
      await invite(owner.session, invitee.phone).expect(201);

      const mine = await harness
        .as(invitee.session)
        .get('/invitations/mine')
        .expect(200);
      const theirs = await harness
        .as(stranger.session)
        .get('/invitations/mine')
        .expect(200);

      expect(mine.body).toEqual([
        {
          id: expect.any(String),
          brandName: 'Coach Karim Fitness',
          role: 'assistant',
          expiresAt: expect.any(String),
          createdAt: expect.any(String),
        },
      ]);
      expect(theirs.body).toEqual([]);
    });

    it('waits for a person who signs up after being invited', async () => {
      const owner = await newOwner();
      const phone = harness.uniquePhone();
      await invite(owner.session, phone).expect(201);

      const { session } = await harness.signedUpPerson({ phone });

      const mine = await harness
        .as(session)
        .get('/invitations/mine')
        .expect(200);
      expect(mine.body).toHaveLength(1);
    });

    it('joins the workspace as an assistant on accepting', async () => {
      const owner = await newOwner();
      const invitee = await person();
      const invitation = (
        await invite(owner.session, invitee.phone).expect(201)
      ).body as Invitation;

      const accepted = await harness
        .as(invitee.session)
        .post(`/invitations/${invitation.id}/accept`)
        .expect(200);

      expect(accepted.body).toEqual({
        workspaceId: owner.workspaceId,
        role: 'assistant',
      });
      const me = await harness.as(invitee.session).get('/auth/me').expect(200);
      expect(me.body.workspaces).toEqual([
        { workspaceId: owner.workspaceId, role: 'assistant', isOwner: false },
      ]);
      expect(
        (await harness.as(invitee.session).get('/invitations/mine').expect(200))
          .body,
      ).toEqual([]);
    });

    it('cannot be answered by someone it was not sent to', async () => {
      const owner = await newOwner();
      const invitee = await person();
      const stranger = await person();
      const invitation = (
        await invite(owner.session, invitee.phone).expect(201)
      ).body as Invitation;

      await harness
        .as(stranger.session)
        .post(`/invitations/${invitation.id}/accept`)
        .expect(404);
      await harness
        .as(stranger.session)
        .post(`/invitations/${invitation.id}/decline`)
        .expect(404);
    });

    it('can be declined, and then cannot be accepted', async () => {
      const owner = await newOwner();
      const invitee = await person();
      const invitation = (
        await invite(owner.session, invitee.phone).expect(201)
      ).body as Invitation;

      await harness
        .as(invitee.session)
        .post(`/invitations/${invitation.id}/decline`)
        .expect(204);
      const late = await harness
        .as(invitee.session)
        .post(`/invitations/${invitation.id}/accept`)
        .expect(409);

      expect(late.body.code).toBe('INVITATION_NOT_PENDING');
      const listed = await harness
        .as(owner.session)
        .get('/invitations?status=declined')
        .expect(200);
      expect(listed.body.items.map((i: Invitation) => i.state)).toEqual([
        'declined',
      ]);
    });

    it('can be taken back by the owner before it is answered', async () => {
      const owner = await newOwner();
      const invitee = await person();
      const invitation = (
        await invite(owner.session, invitee.phone).expect(201)
      ).body as Invitation;

      await harness
        .as(owner.session)
        .delete(`/invitations/${invitation.id}`)
        .expect(204);

      expect(
        (await harness.as(invitee.session).get('/invitations/mine').expect(200))
          .body,
      ).toEqual([]);
      await harness
        .as(invitee.session)
        .post(`/invitations/${invitation.id}/accept`)
        .expect(409);
      await harness
        .as(owner.session)
        .delete(`/invitations/${invitation.id}`)
        .expect(409);
    });

    it('cannot be accepted once it has expired, and the owner can then ask again', async () => {
      const owner = await newOwner();
      const invitee = await person();
      const invitation = (
        await invite(owner.session, invitee.phone).expect(201)
      ).body as Invitation;
      await harness.tx.run(
        () =>
          harness.tx.db
            .update(workspaceInvitations)
            .set({ expiresAt: new Date(Date.now() - 60_000) })
            .where(eq(workspaceInvitations.id, invitation.id)),
        { workspaceId: owner.workspaceId },
      );

      const late = await harness
        .as(invitee.session)
        .post(`/invitations/${invitation.id}/accept`)
        .expect(410);
      const listed = await harness
        .as(owner.session)
        .get('/invitations')
        .expect(200);
      const fresh = await invite(owner.session, invitee.phone).expect(201);

      expect(late.body.code).toBe('INVITATION_EXPIRED');
      expect(listed.body.items[0].state).toBe('expired');
      expect(fresh.body.id).not.toBe(invitation.id);
      await harness
        .as(invitee.session)
        .post(`/invitations/${fresh.body.id}/accept`)
        .expect(200);
    });

    it('lets only one of two answers at once through', async () => {
      const owner = await newOwner();
      const invitee = await person();
      const invitation = (
        await invite(owner.session, invitee.phone).expect(201)
      ).body as Invitation;

      const results = await Promise.all([
        harness
          .as(invitee.session)
          .post(`/invitations/${invitation.id}/accept`),
        harness
          .as(invitee.session)
          .post(`/invitations/${invitation.id}/accept`),
      ]);

      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        200, 409,
      ]);
      const members = await harness
        .as(owner.session)
        .get('/members')
        .expect(200);
      expect(members.body).toHaveLength(2);
    });
  });

  describe('one person, several workspaces', () => {
    it('can be an assistant in one workspace and the owner of another', async () => {
      const { owner: ownerA, assistant } = await team('Gym A');

      const created = await harness
        .as(assistant.session)
        .post('/workspaces')
        .send({ brandName: 'Gym B' })
        .expect(201);
      const workspaceB = created.body.id as string;
      harness.trackWorkspace(workspaceB);

      const me = await asIn(assistant.session, ownerA.workspaceId)
        .get('/auth/me')
        .expect(200);
      expect(
        me.body.workspaces.map(
          (m: { workspaceId: string; role: string; isOwner: boolean }) => [
            m.workspaceId,
            m.role,
            m.isOwner,
          ],
        ),
      ).toEqual(
        expect.arrayContaining([
          [ownerA.workspaceId, 'assistant', false],
          [workspaceB, 'coach', true],
        ]),
      );
    });

    it('must say which workspace it acts in, and is judged by its role in that one', async () => {
      const { owner: ownerA, assistant } = await team('Gym A');
      const workspaceB = (
        await harness
          .as(assistant.session)
          .post('/workspaces')
          .send({ brandName: 'Gym B' })
          .expect(201)
      ).body.id as string;
      harness.trackWorkspace(workspaceB);

      const unsaid = await harness
        .as(assistant.session)
        .get('/clients')
        .expect(400);
      expect(unsaid.body.code).toBe('WORKSPACE_REQUIRED');
      // an assistant in A: day-to-day only
      await asIn(assistant.session, ownerA.workspaceId)
        .get('/clients')
        .expect(200);
      const refused = await asIn(assistant.session, ownerA.workspaceId)
        .get('/plans')
        .expect(403);
      expect(refused.body.code).toBe('ROLE_NOT_ALLOWED');
      await asIn(assistant.session, ownerA.workspaceId)
        .patch('/workspaces/current')
        .send({ brandName: 'Hijacked' })
        .expect(403);
      // the owner of B: everything
      await asIn(assistant.session, workspaceB).get('/plans').expect(200);
      await asIn(assistant.session, workspaceB)
        .patch('/workspaces/current')
        .send({ brandName: 'Gym B renamed' })
        .expect(200);
    });

    it('sees only the data of the workspace it names', async () => {
      const { owner: ownerA, assistant } = await team('Gym A');
      const workspaceB = (
        await harness
          .as(assistant.session)
          .post('/workspaces')
          .send({ brandName: 'Gym B' })
          .expect(201)
      ).body.id as string;
      harness.trackWorkspace(workspaceB);
      const inA = (
        await asIn(assistant.session, ownerA.workspaceId)
          .post('/clients')
          .send({ fullName: 'Client of A', phone: harness.uniquePhone() })
          .expect(201)
      ).body as { id: string };

      const listedInB = await asIn(assistant.session, workspaceB)
        .get('/clients')
        .expect(200);
      const readFromB = await asIn(assistant.session, workspaceB)
        .get(`/clients/${inA.id}`)
        .expect(404);

      expect(listedInB.body.items).toEqual([]);
      expect(readFromB.body.code).toBe('CLIENT_NOT_FOUND');
    });

    it('cannot act in a workspace it does not belong to', async () => {
      const { assistant } = await team();
      const outsider = await newOwner();

      const response = await asIn(assistant.session, outsider.workspaceId)
        .get('/clients')
        .expect(403);

      expect(response.body.code).toBe('WORKSPACE_FORBIDDEN');
    });
  });

  describe('what an assistant may do', () => {
    let owner: Awaited<ReturnType<typeof newOwner>>;
    let assistant: Awaited<ReturnType<typeof person>>;
    let clientId: string;
    let subscriptionId: string;

    const asAssistant = () => asIn(assistant.session, owner.workspaceId);
    const asOwner = () => asIn(owner.session, owner.workspaceId);

    beforeAll(async () => {
      const made = await team('Assistant Gym');
      owner = made.owner;
      assistant = made.assistant;
      clientId = (
        await asOwner()
          .post('/clients')
          .send({ fullName: 'Omar Khaled', phone: harness.uniquePhone() })
          .expect(201)
      ).body.id;
    });

    it('runs the day-to-day: clients, selling, payments, check-in schedules, the home numbers', async () => {
      const added = await asAssistant()
        .post('/clients')
        .send({ fullName: 'Added by assistant', phone: harness.uniquePhone() })
        .expect(201);
      await asAssistant().get('/clients').expect(200);
      await asAssistant().get(`/clients/${added.body.id}`).expect(200);
      await asAssistant()
        .patch(`/clients/${added.body.id}`)
        .send({ fullName: 'Renamed by assistant' })
        .expect(200);
      const made = await asOwner()
        .post('/packages')
        .send({ name: 'Monthly', durationDays: 30, priceMinor: 100_000 })
        .expect(201);
      const packages = (await asAssistant().get('/packages').expect(200))
        .body as { id: string }[];
      expect(packages.map((p) => p.id)).toContain(made.body.id);
      const sold = await asAssistant()
        .post(`/clients/${clientId}/subscriptions`)
        .send({ packageId: made.body.id, priceMinor: 100_000 })
        .expect(201);
      subscriptionId = sold.body.id;
      await asAssistant().get('/subscriptions').expect(200);
      await asAssistant()
        .post(`/subscriptions/${subscriptionId}/payments`)
        .send({ amountMinor: 40_000, method: 'cash' })
        .expect(201);
      await asAssistant().get('/payments').expect(200);
      await asAssistant()
        .put(`/clients/${clientId}/checkin-schedule`)
        .send({ frequency: 'weekly' })
        .expect(200);
      await asAssistant().get('/home').expect(200);
      await asAssistant().get('/workspaces/current').expect(200);
      await asAssistant().get('/members').expect(200);
      await asAssistant().get('/members/me').expect(200);
    });

    const id = randomUUID();
    it.each([
      ['get', '/plans'],
      ['post', '/plans'],
      ['get', '/meal-plans'],
      ['get', '/exercises'],
      ['post', '/exercises'],
      ['get', '/foods'],
      ['get', '/forms/intake'],
      ['put', '/forms/intake'],
      ['get', `/clients/${id}/intake`],
      ['get', `/clients/${id}/progress`],
      ['get', '/checkins'],
      ['post', `/checkins/${id}/reply`],
      ['get', '/analytics/business'],
      ['get', '/billing/subscription'],
      ['post', '/billing/subscription/change'],
      ['get', '/billing/invoices'],
      ['patch', '/workspaces/current'],
      ['put', '/workspaces/current/logo'],
      ['post', '/packages'],
      ['patch', `/packages/${id}`],
      ['delete', `/packages/${id}`],
      ['post', '/payment-channels'],
      ['put', '/reminder-messages/expired'],
      ['patch', `/payment-channels/${id}`],
      ['delete', `/payment-channels/${id}`],
      ['post', '/invitations'],
      ['get', '/invitations'],
      ['delete', `/invitations/${id}`],
      ['delete', `/members/${id}`],
    ] as const)(
      'refuses %s %s: that is for the coach',
      async (method, path) => {
        const response = await asAssistant()[method](path).send({});

        expect(response.status).toBe(403);
        expect(response.body.code).toBe('ROLE_NOT_ALLOWED');
      },
    );

    it('is refused the same things as the owner is allowed', async () => {
      await asOwner().get('/plans').expect(200);
      await asOwner().get('/forms/intake').expect(200);
      await asOwner().get('/analytics/business').expect(200);
      await asOwner().get('/billing/subscription').expect(200);
      await asOwner().get('/invitations').expect(200);
    });

    it('is refused before the route runs, so even a missing client is a 403 and not a 404', async () => {
      const response = await asAssistant()
        .get(`/clients/${randomUUID()}/progress`)
        .expect(403);

      expect(response.body.code).toBe('ROLE_NOT_ALLOWED');
    });
  });

  describe('the team', () => {
    it('lists the owner first, then the assistants, with their names and numbers', async () => {
      const { owner, assistant } = await team();

      const response = await asIn(owner.session, owner.workspaceId)
        .get('/members')
        .expect(200);

      expect(
        response.body.map(
          (m: { phone: string; role: string; isOwner: boolean }) => [
            m.phone,
            m.role,
            m.isOwner,
          ],
        ),
      ).toEqual([
        [owner.phone, 'coach', true],
        [assistant.phone, 'assistant', false],
      ]);
      expect(response.body[0].fullName).toEqual(expect.any(String));
    });

    it('lets the owner remove an assistant, who loses access at once but leaves their work behind', async () => {
      const { owner, assistant } = await team();
      const asAssistant = () => asIn(assistant.session, owner.workspaceId);
      const added = (
        await asAssistant()
          .post('/clients')
          .send({ fullName: 'Kept client', phone: harness.uniquePhone() })
          .expect(201)
      ).body as { id: string };
      const members = (
        await asIn(owner.session, owner.workspaceId).get('/members').expect(200)
      ).body as { personId: string; role: string }[];
      const target = members.find((m) => m.role === 'assistant')!;

      await asIn(owner.session, owner.workspaceId)
        .delete(`/members/${target.personId}`)
        .expect(204);

      const refused = await asAssistant().get('/clients').expect(403);
      expect(refused.body.code).toBe('WORKSPACE_FORBIDDEN');
      await asIn(owner.session, owner.workspaceId)
        .get(`/clients/${added.id}`)
        .expect(200);
    });

    it('lets an assistant leave', async () => {
      const { owner, assistant } = await team();

      await asIn(assistant.session, owner.workspaceId)
        .delete('/members/me')
        .expect(204);

      const members = await asIn(owner.session, owner.workspaceId)
        .get('/members')
        .expect(200);
      expect(members.body).toHaveLength(1);
    });

    it('lets a person who left, or was removed, be invited again', async () => {
      const { owner, assistant } = await team();
      await asIn(assistant.session, owner.workspaceId)
        .delete('/members/me')
        .expect(204);

      const again = await invite(owner.session, assistant.phone).expect(201);
      await harness
        .as(assistant.session)
        .post(`/invitations/${again.body.id}/accept`)
        .expect(200);

      const members = await asIn(owner.session, owner.workspaceId)
        .get('/members')
        .expect(200);
      expect(members.body).toHaveLength(2);
    });

    it('never removes the owner, by the owner or by anyone', async () => {
      const { owner } = await team();
      const members = (
        await asIn(owner.session, owner.workspaceId).get('/members').expect(200)
      ).body as { personId: string; isOwner: boolean }[];
      const ownerId = members.find((m) => m.isOwner)!.personId;

      const removed = await asIn(owner.session, owner.workspaceId)
        .delete(`/members/${ownerId}`)
        .expect(403);
      const left = await asIn(owner.session, owner.workspaceId)
        .delete('/members/me')
        .expect(403);

      expect(removed.body.code).toBe('OWNER_CANNOT_BE_REMOVED');
      expect(left.body.code).toBe('OWNER_CANNOT_BE_REMOVED');
    });

    it('says so when the person to remove is not on the team', async () => {
      const owner = await newOwner();

      const response = await asIn(owner.session, owner.workspaceId)
        .delete(`/members/${randomUUID()}`)
        .expect(404);

      expect(response.body.code).toBe('MEMBER_NOT_FOUND');
    });

    it('does not show one workspace’s team to another', async () => {
      const { owner } = await team();
      const other = await newOwner();

      const response = await asIn(other.session, other.workspaceId)
        .get('/members')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].phone).not.toBe(owner.phone);
    });
  });
});
