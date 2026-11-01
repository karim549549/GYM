import { TransactionManager } from '../../database/transaction.manager';
import { FoodPublicationStatus } from '../enums/food-publication-status.enum';
import { NutritionConfidence } from '../enums/nutrition-confidence.enum';
import { FoodPublicationQueryHandler } from '../handlers/food-publication-query.handler';
import { FoodsQueryHandler } from '../handlers/foods-query.handler';
import type { FoodPublicationRecord } from '../interfaces/food-publication.interface';
import type { FoodRecord } from '../interfaces/food.interface';
import { FoodPublicationReviewOrchestrator } from './food-publication-review.orchestrator';

describe('Food publication decisions', () => {
  const setup = () => {
    const pending = {
      id: 'request',
      foodId: 'private-food',
      status: FoodPublicationStatus.PENDING,
    } as FoodPublicationRecord;
    const food = {
      id: 'private-food',
      originNote: 'Package source',
      barcode: null,
      isCustom: true,
    } as FoodRecord;
    const query = {
      findById: jest.fn(async (): Promise<FoodRecord | null> => food),
      findBarcode: jest.fn(async (): Promise<FoodRecord | null> => null),
    };
    const requests = {
      find: jest.fn(async (): Promise<FoodPublicationRecord | null> => pending),
      decide: jest.fn(async (): Promise<FoodPublicationRecord | null> => ({
        ...pending,
        status: FoodPublicationStatus.APPROVED,
      })),
      copyShared: jest.fn(async (): Promise<string | null> => 'shared-copy'),
    };
    const transactions = {
      run: jest.fn(async <T>(work: () => Promise<T>) => work()),
    };
    const orchestrator = new FoodPublicationReviewOrchestrator(
      transactions as unknown as TransactionManager,
      query as unknown as FoodsQueryHandler,
      requests as unknown as FoodPublicationQueryHandler,
    );
    return { orchestrator, query, requests, transactions, pending, food };
  };

  it('claims pending before copying and carries review metadata in a system transaction', async () => {
    const { orchestrator, requests, transactions } = setup();
    const result = await orchestrator.execute(
      'request',
      'reviewer',
      FoodPublicationStatus.APPROVED,
      'Checked',
    );
    expect(result.sharedFoodId).toBe('shared-copy');
    expect(transactions.run).toHaveBeenCalledWith(expect.any(Function), {
      system: true,
    });
    expect(requests.decide).toHaveBeenCalledWith(
      'request',
      FoodPublicationStatus.APPROVED,
      'reviewer',
      'Checked',
      undefined,
    );
    expect(requests.copyShared).toHaveBeenCalledWith('private-food', {
      confidence: NutritionConfidence.LOW,
      isVerified: false,
      originNote: expect.stringContaining(
        'Package source\nSuggested by a coach, approved on ',
      ),
    });
    expect(requests.decide.mock.invocationCallOrder[0]).toBeLessThan(
      requests.copyShared.mock.invocationCallOrder[0],
    );
  });

  it('does not copy when another reviewer wins the atomic claim', async () => {
    const { orchestrator, requests } = setup();
    requests.decide.mockResolvedValue(null);
    await expect(
      orchestrator.execute(
        'request',
        'reviewer',
        FoodPublicationStatus.APPROVED,
      ),
    ).rejects.toMatchObject({
      response: { code: 'FOOD_PUBLICATION_NOT_PENDING' },
    });
    expect(requests.copyShared).not.toHaveBeenCalled();
  });

  it('does not copy a missing or already decided request', async () => {
    const { orchestrator, requests, pending } = setup();
    requests.find.mockResolvedValue({
      ...pending,
      status: FoodPublicationStatus.REJECTED,
    });
    await expect(
      orchestrator.execute(
        'request',
        'reviewer',
        FoodPublicationStatus.APPROVED,
      ),
    ).rejects.toMatchObject({
      response: { code: 'FOOD_PUBLICATION_NOT_PENDING' },
    });
    requests.find.mockResolvedValue(null);
    await expect(
      orchestrator.execute(
        'request',
        'reviewer',
        FoodPublicationStatus.APPROVED,
      ),
    ).rejects.toMatchObject({
      response: { code: 'FOOD_PUBLICATION_NOT_FOUND' },
    });
    expect(requests.decide).not.toHaveBeenCalled();
    expect(requests.copyShared).not.toHaveBeenCalled();
  });

  it('refuses private duplicate targets before claiming', async () => {
    const { orchestrator, requests } = setup();
    await expect(
      orchestrator.execute(
        'request',
        'reviewer',
        FoodPublicationStatus.DUPLICATE,
        undefined,
        'private-food',
      ),
    ).rejects.toMatchObject({ response: { code: 'INVALID_FOOD' } });
    expect(requests.decide).not.toHaveBeenCalled();
  });

  it('reports a shared barcode collision that wins during insertion', async () => {
    const { orchestrator, query, requests, food } = setup();
    query.findById.mockResolvedValue({ ...food, barcode: '96385074' });
    query.findBarcode.mockResolvedValueOnce(null).mockResolvedValueOnce({
      ...food,
      id: 'existing-shared',
      isCustom: false,
    });
    requests.copyShared.mockResolvedValue(null);
    await expect(
      orchestrator.execute(
        'request',
        'reviewer',
        FoodPublicationStatus.APPROVED,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'FOOD_BARCODE_EXISTS',
        details: { id: 'existing-shared' },
      },
    });
  });
});
