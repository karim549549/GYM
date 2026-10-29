import { BadRequestException } from '@nestjs/common';
import type { TransactionManager } from '../../database/transaction.manager';
import { BaseQueryHandler, type PageSource } from './base-query.handler';

class ProbeQueryHandler extends BaseQueryHandler {
  database() {
    return this.db;
  }

  first<T>(rows: T[]) {
    return this.firstOrNull(rows);
  }

  validate(page?: number, limit?: number, maxLimit?: number) {
    return this.validatePaginationParams(page, limit, maxLimit);
  }

  offset(page: number, limit: number) {
    return this.calculateOffset(page, limit);
  }

  build<T>(items: T[], total: number, page: number, limit: number) {
    return this.buildPaginatedResponse(items, total, page, limit);
  }

  paged<T, R = T>(
    source: PageSource<T>,
    page?: number,
    limit?: number,
    mapItems?: (items: T[]) => Promise<R[]>,
  ) {
    return this.executePageQuery(source, page, limit, mapItems);
  }
}

const setup = () => {
  const transactionManager = { db: 'the-current-executor' };
  return new ProbeQueryHandler(
    transactionManager as unknown as TransactionManager,
  );
};

describe('BaseQueryHandler', () => {
  describe('db', () => {
    it('is whatever the transaction manager currently exposes', () => {
      expect(setup().database()).toBe('the-current-executor');
    });
  });

  describe('firstOrNull', () => {
    it('returns null for no rows', () => {
      expect(setup().first([])).toBeNull();
    });

    it('returns the first row', () => {
      expect(setup().first([{ id: 1 }, { id: 2 }])).toEqual({ id: 1 });
    });
  });

  describe('validatePaginationParams', () => {
    it.each([
      [undefined, undefined, { page: 1, limit: 20 }],
      [3, 50, { page: 3, limit: 50 }],
      [0, 0, { page: 1, limit: 20 }],
      [-4, -1, { page: 1, limit: 20 }],
      [Number.NaN, Number.NaN, { page: 1, limit: 20 }],
      [2.7, 10.9, { page: 2, limit: 10 }],
    ])('turns page %p and limit %p into %p', (page, limit, expected) => {
      expect(setup().validate(page, limit)).toEqual(expected);
    });

    it('accepts the largest allowed limit and refuses one above it', () => {
      expect(setup().validate(1, 1000)).toEqual({ page: 1, limit: 1000 });
      expect(() => setup().validate(1, 1001)).toThrow(BadRequestException);
    });

    it('names the problem with a stable code', () => {
      try {
        setup().validate(1, 5000);
        throw new Error('expected a refusal');
      } catch (error) {
        expect((error as BadRequestException).getResponse()).toMatchObject({
          code: 'PAGINATION_LIMIT_EXCEEDED',
        });
      }
    });

    it('honours a lower cap passed by the caller', () => {
      expect(setup().validate(1, 100, 100)).toEqual({ page: 1, limit: 100 });
      expect(() => setup().validate(1, 101, 100)).toThrow(BadRequestException);
    });
  });

  describe('calculateOffset', () => {
    it.each([
      [1, 20, 0],
      [2, 20, 20],
      [5, 10, 40],
    ])('page %i of %i per page starts at row %i', (page, limit, expected) => {
      expect(setup().offset(page, limit)).toBe(expected);
    });
  });

  describe('buildPaginatedResponse', () => {
    it('describes a middle page', () => {
      expect(setup().build(['a', 'b'], 45, 2, 20)).toEqual({
        items: ['a', 'b'],
        total: 45,
        page: 2,
        limit: 20,
        totalPages: 3,
        hasNext: true,
        hasPrev: true,
      });
    });

    it('describes the first and the last page', () => {
      expect(setup().build(['a'], 45, 1, 20)).toMatchObject({
        hasNext: true,
        hasPrev: false,
      });
      expect(setup().build(['a'], 45, 3, 20)).toMatchObject({
        hasNext: false,
        hasPrev: true,
      });
    });

    it('has no pages and no neighbours when there is nothing', () => {
      expect(setup().build([], 0, 1, 20)).toEqual({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      });
    });

    it('rounds a partial last page up', () => {
      expect(setup().build(['a'], 21, 1, 20).totalPages).toBe(2);
    });
  });

  describe('executePageQuery', () => {
    const source = (rows: string[]) => {
      const fetchItems = jest.fn(async (limit: number, offset: number) =>
        rows.slice(offset, offset + limit),
      );
      const count = jest.fn(async () => rows.length);
      const pageSource: PageSource<string> = { fetchItems, count };
      return { pageSource, fetchItems, count };
    };

    it('fetches the requested page and counts once', async () => {
      const rows = Array.from({ length: 45 }, (_, index) => `row-${index}`);
      const { pageSource, fetchItems, count } = source(rows);

      const result = await setup().paged(pageSource, 2, 20);

      expect(fetchItems).toHaveBeenCalledWith(20, 20);
      expect(count).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        total: 45,
        page: 2,
        limit: 20,
        totalPages: 3,
        hasNext: true,
        hasPrev: true,
      });
      expect(result.items).toEqual(rows.slice(20, 40));
    });

    it('uses the defaults when no page or limit is given', async () => {
      const { pageSource, fetchItems } = source(['only']);

      const result = await setup().paged(pageSource);

      expect(fetchItems).toHaveBeenCalledWith(20, 0);
      expect(result).toMatchObject({ page: 1, limit: 20, totalPages: 1 });
    });

    it('applies the item mapper to the fetched page only', async () => {
      const rows = Array.from({ length: 30 }, (_, index) => `row-${index}`);
      const mapItems = jest.fn(async (items: string[]) =>
        items.map((item) => item.toUpperCase()),
      );

      const result = await setup().paged(
        source(rows).pageSource,
        2,
        10,
        mapItems,
      );

      expect(mapItems).toHaveBeenCalledTimes(1);
      expect(mapItems).toHaveBeenCalledWith(rows.slice(10, 20));
      expect(result.items).toEqual(
        rows.slice(10, 20).map((r) => r.toUpperCase()),
      );
      expect(result.total).toBe(30);
    });

    it('refuses an over-large limit before touching the database', async () => {
      const { pageSource, fetchItems, count } = source(['a']);

      await expect(setup().paged(pageSource, 1, 5000)).rejects.toThrow(
        BadRequestException,
      );
      expect(fetchItems).not.toHaveBeenCalled();
      expect(count).not.toHaveBeenCalled();
    });
  });
});
