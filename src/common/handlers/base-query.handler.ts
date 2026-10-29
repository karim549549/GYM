import { BadRequestException, Injectable } from '@nestjs/common';
import {
  type DbExecutor,
  TransactionManager,
} from '../../database/transaction.manager';

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** The two reads a page needs; the handler supplies them, the base runs them. */
export interface PageSource<T> {
  fetchItems(limit: number, offset: number): Promise<T[]>;
  count(): Promise<number>;
}

/**
 * Base of every query handler: data access only. It owns the generic
 * building blocks (the current database executor, single-row lookup and
 * pagination) so subclasses never re-implement them.
 */
@Injectable()
export abstract class BaseQueryHandler {
  protected static readonly DEFAULT_PAGE = 1;
  protected static readonly DEFAULT_LIMIT = 20;
  protected static readonly MAX_LIMIT = 1000;

  constructor(protected readonly transactionManager: TransactionManager) {}

  /** The open transaction when there is one, otherwise the shared connection. */
  protected get db(): DbExecutor {
    return this.transactionManager.db;
  }

  protected firstOrNull<T>(rows: T[]): T | null {
    return rows[0] ?? null;
  }

  protected validatePaginationParams(
    page?: number,
    limit?: number,
    maxLimit: number = BaseQueryHandler.MAX_LIMIT,
  ): { page: number; limit: number } {
    const validPage = this.positiveInteger(page, BaseQueryHandler.DEFAULT_PAGE);
    const validLimit = this.positiveInteger(
      limit,
      BaseQueryHandler.DEFAULT_LIMIT,
    );

    if (validLimit > maxLimit) {
      throw new BadRequestException({
        code: 'PAGINATION_LIMIT_EXCEEDED',
        message: `limit must be at most ${maxLimit}`,
      });
    }
    return { page: validPage, limit: validLimit };
  }

  protected calculateOffset(page: number, limit: number): number {
    return (page - 1) * limit;
  }

  protected buildPaginatedResponse<T>(
    items: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedResponse<T> {
    const totalPages = Math.ceil(total / limit);
    return {
      items,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  protected async executePageQuery<T, R = T>(
    source: PageSource<T>,
    page?: number,
    limit?: number,
    mapItems?: (items: T[]) => Promise<R[]>,
  ): Promise<PaginatedResponse<R>> {
    const { page: validPage, limit: validLimit } =
      this.validatePaginationParams(page, limit);

    // one after the other: both run on the open transaction's single connection, which cannot take two at once
    const items = await source.fetchItems(
      validLimit,
      this.calculateOffset(validPage, validLimit),
    );
    const total = await source.count();

    const mapped = mapItems ? await mapItems(items) : (items as unknown as R[]);
    return this.buildPaginatedResponse(mapped, total, validPage, validLimit);
  }

  private positiveInteger(value: number | undefined, fallback: number): number {
    const whole = Math.floor(Number(value));
    return Number.isFinite(whole) && whole >= 1 ? whole : fallback;
  }
}
