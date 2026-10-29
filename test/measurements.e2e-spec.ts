import { randomInt, randomUUID } from 'node:crypto';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { eq, inArray } from 'drizzle-orm';
import { validateEnv } from '../src/config/env.schema';
import { DatabaseModule } from '../src/database/database.module';
import {
  clients,
  measurements,
  people,
  workspaces,
} from '../src/database/schema';
import { TransactionManager } from '../src/database/transaction.manager';
import { MeasurementSource } from '../src/measurements/enums/measurement-source.enum';
import { MeasurementsModule } from '../src/measurements/measurements.module';
import { MeasurementsService } from '../src/measurements/measurements.service';
import { WorkspacesModule } from '../src/workspaces/workspaces.module';
import { WorkspacesService } from '../src/workspaces/workspaces.service';

describe('MeasurementsService against the database', () => {
  let moduleRef: TestingModule;
  let measurementsService: MeasurementsService;
  let workspacesService: WorkspacesService;
  let tx: TransactionManager;

  let workspaceId: string;
  let otherWorkspaceId: string;
  let clientId: string;
  const personIds: string[] = [];

  const newWorkspace = async () => {
    const [owner] = await tx.db
      .insert(people)
      .values({
        phone: `+2010${randomInt(10_000_000, 99_999_999)}`,
        fullName: 'Measurements Owner',
        authUserId: randomUUID(),
      })
      .returning({ id: people.id });
    personIds.push(owner.id);
    return workspacesService.create({
      brandName: `Measurements ${randomInt(100_000_000, 999_999_999)}`,
      ownerId: owner.id,
    });
  };

  const newClient = (forWorkspace: string) =>
    tx.run(
      async () => {
        const [row] = await tx.db
          .insert(clients)
          .values({
            workspaceId: forWorkspace,
            fullName: 'Measured Client',
            phone: `+2010${randomInt(10_000_000, 99_999_999)}`,
          })
          .returning({ id: clients.id });
        return row.id;
      },
      { workspaceId: forWorkspace },
    );

  const stored = () =>
    tx.run(
      () =>
        tx.db
          .select({
            metric: measurements.metric,
            value: measurements.value,
            unit: measurements.unit,
            measuredAt: measurements.measuredAt,
            source: measurements.source,
          })
          .from(measurements)
          .where(eq(measurements.clientId, clientId)),
      { workspaceId },
    );

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
        DatabaseModule,
        WorkspacesModule,
        MeasurementsModule,
      ],
    }).compile();
    measurementsService = moduleRef.get(MeasurementsService);
    workspacesService = moduleRef.get(WorkspacesService);
    tx = moduleRef.get(TransactionManager);

    workspaceId = (await newWorkspace()).id;
    otherWorkspaceId = (await newWorkspace()).id;
    clientId = await newClient(workspaceId);
  });

  afterAll(async () => {
    for (const id of [workspaceId, otherWorkspaceId]) {
      await tx.run(
        () => tx.db.delete(workspaces).where(eq(workspaces.id, id)),
        {
          workspaceId: id,
        },
      );
    }
    await tx.db.delete(people).where(inArray(people.id, personIds));
    await moduleRef.close();
  });

  beforeEach(async () => {
    await tx.run(
      () =>
        tx.db.delete(measurements).where(eq(measurements.clientId, clientId)),
      { workspaceId },
    );
  });

  it('records the readings as numbers, with their unit, day and source', async () => {
    await measurementsService.record(
      workspaceId,
      clientId,
      [
        { metric: 'weight', value: 82.55, unit: 'kg' },
        { metric: 'sleep_quality', value: 7, unit: 'score' },
      ],
      MeasurementSource.INTAKE,
    );

    const rows = await stored();
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        {
          metric: 'weight',
          value: 82.55,
          unit: 'kg',
          measuredAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          source: 'intake',
        },
        expect.objectContaining({ metric: 'sleep_quality', value: 7 }),
      ]),
    );
  });

  it('replaces a reading taken again the same day instead of doubling the point', async () => {
    const first = [{ metric: 'weight', value: 80, unit: 'kg' }];
    const again = [{ metric: 'weight', value: 79.4, unit: 'kg' }];

    await measurementsService.record(
      workspaceId,
      clientId,
      first,
      MeasurementSource.INTAKE,
    );
    await measurementsService.record(
      workspaceId,
      clientId,
      again,
      MeasurementSource.COACH,
    );

    const rows = await stored();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ value: 79.4, source: 'coach' });
  });

  it('keeps the other metrics of that day when one is replaced', async () => {
    await measurementsService.record(
      workspaceId,
      clientId,
      [
        { metric: 'weight', value: 80, unit: 'kg' },
        { metric: 'height', value: 178, unit: 'cm' },
      ],
      MeasurementSource.INTAKE,
    );

    await measurementsService.record(
      workspaceId,
      clientId,
      [{ metric: 'weight', value: 79, unit: 'kg' }],
      MeasurementSource.CHECKIN,
    );

    const byMetric = Object.fromEntries(
      (await stored()).map((row) => [row.metric, row.value]),
    );
    expect(byMetric).toEqual({ weight: 79, height: 178 });
  });

  it('does nothing for no readings', async () => {
    await expect(
      measurementsService.record(
        workspaceId,
        clientId,
        [],
        MeasurementSource.INTAKE,
      ),
    ).resolves.toBeUndefined();

    expect(await stored()).toEqual([]);
  });

  it('will not record into a workspace the client does not belong to', async () => {
    await expect(
      measurementsService.record(
        otherWorkspaceId,
        clientId,
        [{ metric: 'weight', value: 80, unit: 'kg' }],
        MeasurementSource.INTAKE,
      ),
    ).rejects.toThrow();

    expect(await stored()).toEqual([]);
  });

  it('refuses a number the column cannot hold, and records none of the others', async () => {
    await expect(
      measurementsService.record(
        workspaceId,
        clientId,
        [
          { metric: 'height', value: 178, unit: 'cm' },
          { metric: 'weight', value: 1_000_000, unit: 'kg' },
        ],
        MeasurementSource.INTAKE,
      ),
    ).rejects.toThrow();

    expect(await stored()).toEqual([]);
  });
});
