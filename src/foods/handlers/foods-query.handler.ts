import { Injectable } from '@nestjs/common';
import {
  and,
  asc,
  count,
  eq,
  inArray,
  isNull,
  isNotNull,
  ne,
  sql,
  desc,
} from 'drizzle-orm';
import {
  BaseQueryHandler,
  type PaginatedResponse,
} from '../../common/handlers/base-query.handler';
import {
  foodPortions,
  foods,
  foodAliases,
  foodNutrients,
  nutrients,
} from '../../database/schema';
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
  caloriesKcalPer100g: foods.caloriesKcalPer100g,
  proteinGPer100g: foods.proteinGPer100g,
  carbsGPer100g: foods.carbsGPer100g,
  fatGPer100g: foods.fatGPer100g,
  fiberGPer100g: foods.fiberGPer100g,
  isActive: foods.isActive,
  originNote: foods.originNote,
  brand: foods.brand,
  barcode: foods.barcode,
  state: foods.state,
  description: foods.descriptionAr,
  origin: foods.origin,
  usdaFdcId: foods.usdaFdcId,
  confidence: foods.confidence,
  reviewFlags: foods.reviewFlags,
  isVerified: foods.isVerified,
  entryBasis: foods.entryBasis,
  enteredServingWeightG: foods.enteredServingWeightG,
  isOwn: sql<boolean>`foods.workspace_id = app_workspace_id()`,
};

type Row = {
  workspaceId: string | null;
} & Omit<
  FoodRecord,
  'isCustom' | 'portions' | 'defaultPortion' | 'aliases' | 'nutrients'
>;

/**
 * Data access for `foods` and `food_portions`. Row level security lets a workspace read the library
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
      filter.state ? eq(foods.state, filter.state) : undefined,
      filter.scope === 'shared'
        ? isNull(foods.workspaceId)
        : filter.scope === 'mine'
          ? isNotNull(foods.workspaceId)
          : undefined,
      filter.category ? eq(foods.category, filter.category) : undefined,
    );
    return this.executePageQuery(
      {
        fetchItems: (take, skip) =>
          this.db
            .select(ROW)
            .from(foods)
            .where(where)
            .orderBy(
              ...(filter.search
                ? [
                    this.relevance(filter.search),
                    sql`case when ${foods.workspaceId} is null and ${foods.isVerified} then 0 when ${foods.workspaceId} is not null then 1 else 2 end`,
                    desc(this.similarity(filter.search)),
                  ]
                : []),
              asc(foods.nameAr),
              asc(foods.id),
            )
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
      (rows) => this.withPortions(rows),
    );
  }

  async findById(id: string): Promise<FoodRecord | null> {
    return this.firstOrNull(await this.findMany([id]));
  }

  /** Those of these ids the workspace can see (the library's and its own), with their portions. */
  async findMany(ids: string[]): Promise<FoodRecord[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.db
      .select(ROW)
      .from(foods)
      .where(inArray(foods.id, ids));
    return this.withPortions(rows);
  }

  /** The library's own foods with these handles, with their portions. */
  async findLibraryBySlugs(slugs: string[]): Promise<FoodRecord[]> {
    const rows = await this.db
      .select(ROW)
      .from(foods)
      .where(and(isNull(foods.workspaceId), inArray(foods.slug, slugs)));
    return this.withPortions(rows);
  }

  async create(workspaceId: string, food: NewFood): Promise<string> {
    const [created] = await this.db
      .insert(foods)
      .values({
        workspaceId,
        nameAr: food.nameAr,
        nameEn: food.nameEn,
        category: food.category,
        caloriesKcalPer100g: food.caloriesKcalPer100g,
        proteinGPer100g: food.proteinGPer100g,
        carbsGPer100g: food.carbsGPer100g,
        fatGPer100g: food.fatGPer100g,
        fiberGPer100g: food.fiberGPer100g,
        brand: food.brand,
        barcode: food.barcode,
        state: food.state,
        descriptionAr: food.description,
        origin: food.origin,
        entryBasis: food.entry?.basis,
        enteredServingWeightG: food.entry?.servingWeightG,
        originNote: 'manual',
      })
      .returning({ id: foods.id });
    return created.id;
  }

  /** Sets only the fields given (the portions are separate). */
  async update(id: string, changes: FoodChanges): Promise<void> {
    const set = {
      brand: changes.brand,
      barcode: changes.barcode,
      state: changes.state,
      descriptionAr: changes.description,
      origin: changes.origin,
      entryBasis: changes.entry?.basis,
      ...(changes.entry !== undefined && {
        enteredServingWeightG: changes.entry.servingWeightG ?? null,
      }),
      ...(changes.nameAr !== undefined && { nameAr: changes.nameAr }),
      ...(changes.nameEn !== undefined && { nameEn: changes.nameEn }),
      ...(changes.category !== undefined && { category: changes.category }),
      ...(changes.caloriesKcalPer100g !== undefined && {
        caloriesKcalPer100g: changes.caloriesKcalPer100g,
      }),
      ...(changes.proteinGPer100g !== undefined && {
        proteinGPer100g: changes.proteinGPer100g,
      }),
      ...(changes.carbsGPer100g !== undefined && {
        carbsGPer100g: changes.carbsGPer100g,
      }),
      ...(changes.fatGPer100g !== undefined && {
        fatGPer100g: changes.fatGPer100g,
      }),
      ...(changes.fiberGPer100g !== undefined && {
        fiberGPer100g: changes.fiberGPer100g,
      }),
      ...(changes.isActive !== undefined && { isActive: changes.isActive }),
    };
    if (Object.values(set).every((value) => value === undefined)) {
      return;
    }
    await this.db.update(foods).set(set).where(eq(foods.id, id));
  }

  async replacePortions(
    workspaceId: string,
    foodId: string,
    portions: { nameAr: string; weightG: number; isDefault: boolean }[],
  ): Promise<void> {
    await this.db.delete(foodPortions).where(eq(foodPortions.foodId, foodId));
    if (portions.length === 0) {
      return;
    }
    await this.db.insert(foodPortions).values(
      portions.map((portion, sortOrder) => ({
        workspaceId,
        foodId,
        nameAr: portion.nameAr,
        weightG: portion.weightG,
        isDefault: portion.isDefault,
        sortOrder,
      })),
    );
  }

  private async withPortions(rows: Row[]): Promise<FoodRecord[]> {
    if (rows.length === 0) {
      return [];
    }
    const portions = await this.db
      .select({
        id: foodPortions.id,
        foodId: foodPortions.foodId,
        nameAr: foodPortions.nameAr,
        weightG: foodPortions.weightG,
        isDefault: foodPortions.isDefault,
      })
      .from(foodPortions)
      .where(
        inArray(
          foodPortions.foodId,
          rows.map((row) => row.id),
        ),
      )
      .orderBy(asc(foodPortions.sortOrder));

    const ids = rows.map((row) => row.id);
    const aliases = await this.db
      .select()
      .from(foodAliases)
      .where(inArray(foodAliases.foodId, ids));
    const knownNutrients = await this.db
      .select({
        foodId: foodNutrients.foodId,
        code: nutrients.code,
        nameAr: nutrients.nameAr,
        nameEn: nutrients.nameEn,
        measureUnit: nutrients.measureUnit,
        amountPer100g: foodNutrients.amountPer100g,
      })
      .from(foodNutrients)
      .innerJoin(nutrients, eq(nutrients.id, foodNutrients.nutrientId))
      .where(inArray(foodNutrients.foodId, ids))
      .orderBy(asc(nutrients.sortOrder));
    return rows.map(({ workspaceId, ...row }) => {
      const ownPortions = portions
        .filter((portion) => portion.foodId === row.id)
        .map(({ foodId: _foodId, ...portion }) => portion);
      return {
        ...row,
        isOwn: row.isOwn === true,
        isCustom: workspaceId !== null,
        portions: ownPortions,
        defaultPortion:
          ownPortions.find((portion) => portion.isDefault) ?? null,
        aliases: {
          alias_ar: aliases
            .filter((a) => a.foodId === row.id && a.kind === 'alias_ar')
            .map((a) => a.alias),
          alias_en: aliases
            .filter((a) => a.foodId === row.id && a.kind === 'alias_en')
            .map((a) => a.alias),
          search_hint: aliases
            .filter((a) => a.foodId === row.id && a.kind === 'search_hint')
            .map((a) => a.alias),
        },
        nutrients: knownNutrients
          .filter((n) => n.foodId === row.id)
          .map(({ foodId: _foodId, ...nutrient }) => nutrient),
      };
    });
  }

  async findBarcode(
    barcode: string,
    excludeId?: string,
    sharedOnly = false,
  ): Promise<FoodRecord | null> {
    const rows = await this.db
      .select(ROW)
      .from(foods)
      .where(
        and(
          eq(foods.barcode, barcode),
          sharedOnly ? isNull(foods.workspaceId) : undefined,
          excludeId ? ne(foods.id, excludeId) : undefined,
        ),
      )
      .limit(1);
    return this.firstOrNull(await this.withPortions(rows));
  }

  async findDuplicates(
    nameAr: string,
    nameEn?: string | null,
    brand?: string | null,
    excludeId?: string,
  ): Promise<FoodRecord[]> {
    const score = sql<number>`similarity(${foods.searchName}, normalize_search_text(concat_ws(' ', ${nameAr}::text, ${nameEn ?? null}::text, ${brand ?? null}::text)))`;
    const rows = await this.db
      .select(ROW)
      .from(foods)
      .where(
        and(
          sql`${score} > 0.6`,
          excludeId ? ne(foods.id, excludeId) : undefined,
        ),
      )
      .orderBy(desc(score), asc(foods.id))
      .limit(5);
    return this.withPortions(rows);
  }

  async replaceAliases(
    workspaceId: string,
    foodId: string,
    aliases: NonNullable<FoodChanges['aliases']>,
  ): Promise<void> {
    await this.db.delete(foodAliases).where(eq(foodAliases.foodId, foodId));
    if (aliases.length)
      await this.db
        .insert(foodAliases)
        .values(aliases.map((alias) => ({ ...alias, workspaceId, foodId })))
        .onConflictDoNothing();
  }

  async replaceNutrients(
    workspaceId: string,
    foodId: string,
    input: NonNullable<FoodChanges['nutrients']>,
  ): Promise<void> {
    await this.db.delete(foodNutrients).where(eq(foodNutrients.foodId, foodId));
    if (!input.length) return;
    const catalog = await this.db
      .select()
      .from(nutrients)
      .where(
        inArray(
          nutrients.code,
          input.map((n) => n.code),
        ),
      );
    await this.db.insert(foodNutrients).values(
      catalog.map((n) => ({
        workspaceId,
        foodId,
        nutrientId: n.id,
        amountPer100g: input.find((value) => value.code === n.code)!.amount,
      })),
    );
  }

  private matching(search: string) {
    const q = sql`normalize_search_text(${search})`;
    return sql`(strpos(${foods.searchName}, ${q}) > 0
      or (${foods.searchName} % ${q} and similarity(${foods.searchName}, ${q}) > 0.3)
      or exists (select 1 from food_aliases a where a.food_id = ${foods.id}
        and (strpos(a.search_alias, ${q}) > 0 or (a.search_alias % ${q} and similarity(a.search_alias, ${q}) > 0.3))))`;
  }

  private relevance(search: string) {
    const q = sql`normalize_search_text(${search})`;
    return sql`(select min(case when term = ${q} then 0 when left(term, length(${q})) = ${q} then 1 when strpos(term, ${q}) > 0 then 2 else 3 end)
      from (select ${foods.searchName} as term union all select normalize_search_text(${foods.nameAr}) union all select normalize_search_text(${foods.nameEn})
        union all select a.search_alias from food_aliases a where a.food_id = ${foods.id}) terms)`;
  }

  private similarity(search: string) {
    return sql`greatest(similarity(${foods.searchName}, normalize_search_text(${search})),
      coalesce((select max(similarity(a.search_alias, normalize_search_text(${search}))) from food_aliases a where a.food_id = ${foods.id}), 0))`;
  }
}
