import { Injectable } from '@nestjs/common';
import { and, asc, count, eq, ilike, inArray, isNull, or } from 'drizzle-orm';
import {
  BaseQueryHandler,
  type PaginatedResponse,
} from '../../common/handlers/base-query.handler';
import { foodUnits, foods } from '../../database/schema';
import type {
  FoodChanges,
  FoodListFilter,
  FoodRecord,
  NewFood,
} from '../interfaces/food.interface';

const ROW = {
  id: foods.id,
  workspaceId: foods.workspaceId,
  nameAr: foods.nameAr,
  nameEn: foods.nameEn,
  slug: foods.slug,
  category: foods.category,
  kcal100g: foods.kcal100g,
  protein100g: foods.protein100g,
  carb100g: foods.carb100g,
  fat100g: foods.fat100g,
  fiber100g: foods.fiber100g,
  isActive: foods.isActive,
  source: foods.source,
};

type Row = {
  workspaceId: string | null;
} & Omit<FoodRecord, 'isCustom' | 'units'>;

/**
 * Data access for `foods` and `food_units`. Row level security lets a workspace read the library
 * and its own additions, and write only its own.
 */
@Injectable()
export class FoodsQueryHandler extends BaseQueryHandler {
  list(
    filter: FoodListFilter,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<FoodRecord>> {
    const where = and(
      filter.includeInactive ? undefined : eq(foods.isActive, true),
      filter.search ? this.matching(filter.search) : undefined,
      filter.category ? eq(foods.category, filter.category) : undefined,
    );
    return this.executePageQuery(
      {
        fetchItems: (take, skip) =>
          this.db
            .select(ROW)
            .from(foods)
            .where(where)
            .orderBy(asc(foods.nameAr), asc(foods.id))
            .limit(take)
            .offset(skip),
        count: async () => {
          const [row] = await this.db
            .select({ total: count() })
            .from(foods)
            .where(where);
          return row.total;
        },
      },
      page,
      limit,
      (rows) => this.withUnits(rows),
    );
  }

  async findById(id: string): Promise<FoodRecord | null> {
    return this.firstOrNull(await this.findMany([id]));
  }

  /** Those of these ids the workspace can see (the library's and its own), with their units. */
  async findMany(ids: string[]): Promise<FoodRecord[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.db
      .select(ROW)
      .from(foods)
      .where(inArray(foods.id, ids));
    return this.withUnits(rows);
  }

  /** The library's own foods with these handles, with their units. */
  async findLibraryBySlugs(slugs: string[]): Promise<FoodRecord[]> {
    const rows = await this.db
      .select(ROW)
      .from(foods)
      .where(and(isNull(foods.workspaceId), inArray(foods.slug, slugs)));
    return this.withUnits(rows);
  }

  async create(workspaceId: string, food: NewFood): Promise<string> {
    const [created] = await this.db
      .insert(foods)
      .values({
        workspaceId,
        nameAr: food.nameAr,
        nameEn: food.nameEn,
        category: food.category,
        kcal100g: food.kcal100g,
        protein100g: food.protein100g,
        carb100g: food.carb100g,
        fat100g: food.fat100g,
        fiber100g: food.fiber100g,
        source: 'manual',
      })
      .returning({ id: foods.id });
    return created.id;
  }

  /** Sets only the fields given (the units are separate). */
  async update(id: string, changes: FoodChanges): Promise<void> {
    const set = {
      ...(changes.nameAr !== undefined && { nameAr: changes.nameAr }),
      ...(changes.nameEn !== undefined && { nameEn: changes.nameEn }),
      ...(changes.category !== undefined && { category: changes.category }),
      ...(changes.kcal100g !== undefined && { kcal100g: changes.kcal100g }),
      ...(changes.protein100g !== undefined && {
        protein100g: changes.protein100g,
      }),
      ...(changes.carb100g !== undefined && { carb100g: changes.carb100g }),
      ...(changes.fat100g !== undefined && { fat100g: changes.fat100g }),
      ...(changes.fiber100g !== undefined && { fiber100g: changes.fiber100g }),
      ...(changes.isActive !== undefined && { isActive: changes.isActive }),
    };
    if (Object.keys(set).length === 0) {
      return;
    }
    await this.db.update(foods).set(set).where(eq(foods.id, id));
  }

  async replaceUnits(
    workspaceId: string,
    foodId: string,
    units: { labelAr: string; grams: number; isDefault: boolean }[],
  ): Promise<void> {
    await this.db.delete(foodUnits).where(eq(foodUnits.foodId, foodId));
    if (units.length === 0) {
      return;
    }
    await this.db.insert(foodUnits).values(
      units.map((unit, position) => ({
        workspaceId,
        foodId,
        labelAr: unit.labelAr,
        grams: unit.grams,
        isDefault: unit.isDefault,
        position,
      })),
    );
  }

  private async withUnits(rows: Row[]): Promise<FoodRecord[]> {
    if (rows.length === 0) {
      return [];
    }
    const units = await this.db
      .select({
        id: foodUnits.id,
        foodId: foodUnits.foodId,
        labelAr: foodUnits.labelAr,
        grams: foodUnits.grams,
        isDefault: foodUnits.isDefault,
      })
      .from(foodUnits)
      .where(
        inArray(
          foodUnits.foodId,
          rows.map((row) => row.id),
        ),
      )
      .orderBy(asc(foodUnits.position));

    return rows.map(({ workspaceId, ...row }) => ({
      ...row,
      isCustom: workspaceId !== null,
      units: units
        .filter((unit) => unit.foodId === row.id)
        .map(({ foodId: _foodId, ...unit }) => unit),
    }));
  }

  private matching(search: string) {
    const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
    return or(ilike(foods.nameAr, pattern), ilike(foods.nameEn, pattern));
  }
}
