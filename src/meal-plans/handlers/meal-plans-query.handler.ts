import { Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import {
  BaseQueryHandler,
  type PaginatedResponse,
} from '../../common/handlers/base-query.handler';
import {
  foodPortions,
  mealItemSubs,
  mealItems,
  mealPlans,
  meals,
} from '../../database/schema';
import { MealPlanStatus } from '../enums/meal-plan-status.enum';
import type {
  MealItemRecord,
  MealPlanChanges,
  MealPlanListFilter,
  MealPlanSummary,
  MealSubstituteRecord,
  StoredMealRecord,
  NewMealPlan,
  StoredMeal,
} from '../interfaces/meal-plan.interface';

const SUMMARY = {
  id: mealPlans.id,
  clientId: mealPlans.clientId,
  isTemplate: mealPlans.isTemplate,
  name: mealPlans.name,
  caloriesKcalTarget: mealPlans.caloriesKcalTarget,
  proteinGTarget: mealPlans.proteinGTarget,
  carbsGTarget: mealPlans.carbsGTarget,
  fatGTarget: mealPlans.fatGTarget,
  status: mealPlans.status,
  startsOn: mealPlans.startsOn,
  notes: mealPlans.notes,
  createdAt: mealPlans.createdAt,
};

/** Rows are inserted in chunks: a long plan has far more values than one statement may carry. */
const CHUNK = 1500;

/** Data access for the four tables of a nutrition plan. Row level security keeps it to one workspace. */
@Injectable()
export class MealPlansQueryHandler extends BaseQueryHandler {
  async create(
    workspaceId: string,
    createdBy: string | null,
    plan: Pick<NewMealPlan, 'name' | 'notes' | 'clientId'> & {
      caloriesKcalTarget?: number | null;
      proteinGTarget?: number | null;
      carbsGTarget?: number | null;
      fatGTarget?: number | null;
    },
  ): Promise<MealPlanSummary> {
    const [created] = await this.db
      .insert(mealPlans)
      .values({
        workspaceId,
        createdBy,
        clientId: plan.clientId ?? null,
        isTemplate: plan.clientId === undefined,
        name: plan.name,
        caloriesKcalTarget: plan.caloriesKcalTarget ?? null,
        proteinGTarget: plan.proteinGTarget ?? null,
        carbsGTarget: plan.carbsGTarget ?? null,
        fatGTarget: plan.fatGTarget ?? null,
        notes: plan.notes ?? null,
      })
      .returning(SUMMARY);
    return created;
  }

  /** Several templates in one go, for a new workspace. */
  createTemplates(
    workspaceId: string,
    templates: {
      name: string;
      caloriesKcalTarget: number;
      proteinGTarget: number;
      carbsGTarget: number;
      fatGTarget: number;
    }[],
  ): Promise<MealPlanSummary[]> {
    return this.db
      .insert(mealPlans)
      .values(
        templates.map((template) => ({
          workspaceId,
          isTemplate: true,
          ...template,
        })),
      )
      .returning(SUMMARY);
  }

  async findSummary(id: string): Promise<MealPlanSummary | null> {
    const rows = await this.db
      .select(SUMMARY)
      .from(mealPlans)
      .where(eq(mealPlans.id, id))
      .limit(1);
    return this.firstOrNull(rows);
  }

  list(
    filter: MealPlanListFilter,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<MealPlanSummary>> {
    const where = and(
      filter.clientId ? eq(mealPlans.clientId, filter.clientId) : undefined,
      filter.isTemplate !== undefined
        ? eq(mealPlans.isTemplate, filter.isTemplate)
        : undefined,
      filter.status ? eq(mealPlans.status, filter.status) : undefined,
    );
    return this.executePageQuery(
      {
        fetchItems: (take, skip) =>
          this.db
            .select(SUMMARY)
            .from(mealPlans)
            .where(where)
            .orderBy(desc(mealPlans.createdAt), desc(mealPlans.id))
            .limit(take)
            .offset(skip),
        count: async () => {
          const [row] = await this.db
            .select({ total: count() })
            .from(mealPlans)
            .where(where);
          return row.total;
        },
      },
      page,
      limit,
    );
  }

  async update(
    id: string,
    changes: MealPlanChanges,
  ): Promise<MealPlanSummary | null> {
    const set = {
      ...(changes.name !== undefined && { name: changes.name }),
      ...(changes.caloriesKcalTarget !== undefined && {
        caloriesKcalTarget: changes.caloriesKcalTarget,
      }),
      ...(changes.proteinGTarget !== undefined && {
        proteinGTarget: changes.proteinGTarget,
      }),
      ...(changes.carbsGTarget !== undefined && {
        carbsGTarget: changes.carbsGTarget,
      }),
      ...(changes.fatGTarget !== undefined && {
        fatGTarget: changes.fatGTarget,
      }),
      ...(changes.notes !== undefined && { notes: changes.notes }),
    };
    if (Object.keys(set).length === 0) {
      return this.findSummary(id);
    }
    const rows = await this.db
      .update(mealPlans)
      .set(set)
      .where(eq(mealPlans.id, id))
      .returning(SUMMARY);
    return this.firstOrNull(rows);
  }

  async remove(id: string): Promise<void> {
    await this.db.delete(mealPlans).where(eq(mealPlans.id, id));
  }

  async setStatus(
    id: string,
    status: MealPlanStatus,
    startsOn?: string,
  ): Promise<void> {
    await this.db
      .update(mealPlans)
      .set({ status, ...(startsOn !== undefined && { startsOn }) })
      .where(eq(mealPlans.id, id));
  }

  /** Ends the client's running plan, if there is one, apart from `exceptId`. */
  async endActiveOfClient(clientId: string, exceptId: string): Promise<void> {
    await this.db
      .update(mealPlans)
      .set({ status: MealPlanStatus.ENDED })
      .where(
        and(
          eq(mealPlans.clientId, clientId),
          eq(mealPlans.status, MealPlanStatus.ACTIVE),
          ne(mealPlans.id, exceptId),
        ),
      );
  }

  /** The foods the plan holds already, so an old plan keeps showing one that was deactivated since. */
  async foodIdsOf(planId: string): Promise<string[]> {
    const items = await this.db
      .selectDistinct({ id: mealItems.foodId })
      .from(mealItems)
      .innerJoin(meals, eq(meals.id, mealItems.mealId))
      .where(eq(meals.mealPlanId, planId));
    const subs = await this.db
      .selectDistinct({ id: mealItemSubs.foodId })
      .from(mealItemSubs)
      .innerJoin(mealItems, eq(mealItems.id, mealItemSubs.mealItemId))
      .innerJoin(meals, eq(meals.id, mealItems.mealId))
      .where(eq(meals.mealPlanId, planId));
    return [
      ...new Set(
        [...items, ...subs]
          .map((row) => row.id)
          .filter((id): id is string => id !== null),
      ),
    ];
  }

  /** The whole structure, in reading order: by day, then order. */
  async loadMeals(planId: string): Promise<StoredMealRecord[]> {
    const mealRows = await this.db
      .select()
      .from(meals)
      .where(eq(meals.mealPlanId, planId))
      .orderBy(sql`${meals.weekday} asc nulls first`, asc(meals.sortOrder));
    if (mealRows.length === 0) {
      return [];
    }
    const itemRows = await this.db
      .select({ item: mealItems, portionNameAr: foodPortions.nameAr })
      .from(mealItems)
      .leftJoin(foodPortions, eq(foodPortions.id, mealItems.portionId))
      .where(
        inArray(
          mealItems.mealId,
          mealRows.map((meal) => meal.id),
        ),
      )
      .orderBy(asc(mealItems.sortOrder));
    const subRows =
      itemRows.length === 0
        ? []
        : await this.db
            .select({ sub: mealItemSubs, portionNameAr: foodPortions.nameAr })
            .from(mealItemSubs)
            .leftJoin(foodPortions, eq(foodPortions.id, mealItemSubs.portionId))
            .where(
              inArray(
                mealItemSubs.mealItemId,
                itemRows.map((row) => row.item.id),
              ),
            )
            .orderBy(asc(mealItemSubs.sortOrder));

    return mealRows.map((meal) => {
      const items: MealItemRecord[] = itemRows
        .filter((row) => row.item.mealId === meal.id)
        .map(({ item, portionNameAr }) => ({
          ...this.macrosOf(item),
          sortOrder: item.sortOrder,
          foodId: item.foodId,
          recipeId: item.recipeId,
          kind: item.recipeId ? 'recipe' : 'food',
          itemName: item.itemName,
          quantity: item.quantity,
          portionId: item.portionId,
          portionNameAr,
          substitutes: subRows
            .filter((row) => row.sub.mealItemId === item.id)
            .map(({ sub, portionNameAr: label }): MealSubstituteRecord => ({
              ...this.macrosOf(sub),
              sortOrder: sub.sortOrder,
              foodId: sub.foodId,
              recipeId: sub.recipeId,
              kind: sub.recipeId ? 'recipe' : 'food',
              itemName: sub.itemName,
              quantity: sub.quantity,
              portionId: sub.portionId,
              portionNameAr: label,
            })),
        }));
      return {
        weekday: meal.weekday,
        sortOrder: meal.sortOrder,
        name: meal.name,
        suggestedTime: meal.suggestedTime
          ? meal.suggestedTime.slice(0, 5)
          : null,
        notes: meal.notes,
        items,
      };
    });
  }

  /** Replaces the whole structure with these meals. Items and substitutes go with the meals they belong to. */
  async replaceMeals(
    workspaceId: string,
    planId: string,
    stored: StoredMeal[],
  ): Promise<void> {
    await this.db.delete(meals).where(eq(meals.mealPlanId, planId));
    await this.insertMeals(workspaceId, [{ planId, meals: stored }]);
  }

  /**
   * Stores the meals of several new plans together, in as few statements as there are levels, however
   * many plans there are: a new workspace gets its starter templates this way, and every round trip is
   * a wait for the coach.
   */
  async insertMeals(
    workspaceId: string,
    plansToFill: { planId: string; meals: StoredMeal[] }[],
  ): Promise<void> {
    // a meal's order is its place among that day's meals of its plan
    const placed = new Map<string, number>();
    const all = plansToFill.flatMap(({ planId, meals: own }) =>
      own.map((meal) => {
        const key = `${planId}:${meal.weekday}`;
        const sortOrder = (placed.get(key) ?? 0) + 1;
        placed.set(key, sortOrder);
        return { planId, meal, sortOrder };
      }),
    );
    if (all.length === 0) {
      return;
    }

    const mealRows = await this.insertChunked(all, (chunk) =>
      this.db
        .insert(meals)
        .values(
          chunk.map(({ planId, meal, sortOrder }) => ({
            workspaceId,
            mealPlanId: planId,
            weekday: meal.weekday,
            sortOrder,
            name: meal.name,
            suggestedTime: meal.suggestedTime,
            notes: meal.notes,
          })),
        )
        .returning({
          id: meals.id,
          mealPlanId: meals.mealPlanId,
          weekday: meals.weekday,
          sortOrder: meals.sortOrder,
        }),
    );
    const mealId = new Map(
      mealRows.map((row) => [
        `${row.mealPlanId}:${row.weekday}:${row.sortOrder}`,
        row.id,
      ]),
    );

    const wanted = all.flatMap(({ planId, meal, sortOrder }) => {
      const id = mealId.get(`${planId}:${meal.weekday}:${sortOrder}`) as string;
      return meal.items.map((item, index) => ({
        mealId: id,
        item,
        sortOrder: index + 1,
      }));
    });
    if (wanted.length === 0) {
      return;
    }
    const itemRows = await this.insertChunked(wanted, (chunk) =>
      this.db
        .insert(mealItems)
        .values(
          chunk.map(({ mealId: id, item, sortOrder }) => ({
            workspaceId,
            mealId: id,
            sortOrder,
            foodId: item.foodId,
            recipeId: item.recipeId,
            quantity: item.quantity,
            portionId: item.portionId,
            weightG: item.weightG,
            itemName: item.itemName,
            caloriesKcal: item.caloriesKcal,
            proteinG: item.proteinG,
            carbsG: item.carbsG,
            fatG: item.fatG,
          })),
        )
        .returning({
          id: mealItems.id,
          mealId: mealItems.mealId,
          sortOrder: mealItems.sortOrder,
        }),
    );
    const itemId = new Map(
      itemRows.map((row) => [`${row.mealId}:${row.sortOrder}`, row.id]),
    );

    const subs = wanted.flatMap(({ mealId: id, item, sortOrder }) =>
      item.substitutes.map((sub, index) => ({
        workspaceId,
        mealItemId: itemId.get(`${id}:${sortOrder}`) as string,
        sortOrder: index + 1,
        foodId: sub.foodId,
        recipeId: sub.recipeId,
        quantity: sub.quantity,
        portionId: sub.portionId,
        weightG: sub.weightG,
        itemName: sub.itemName,
        caloriesKcal: sub.caloriesKcal,
        proteinG: sub.proteinG,
        carbsG: sub.carbsG,
        fatG: sub.fatG,
      })),
    );
    await this.insertChunked(subs, (chunk) =>
      this.db
        .insert(mealItemSubs)
        .values(chunk)
        .returning({ id: mealItemSubs.id }),
    );
  }

  private macrosOf(row: {
    weightG: number;
    caloriesKcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  }) {
    return {
      weightG: row.weightG,
      caloriesKcal: row.caloriesKcal,
      proteinG: row.proteinG,
      carbsG: row.carbsG,
      fatG: row.fatG,
    };
  }

  private async insertChunked<T, R>(
    rows: T[],
    insert: (chunk: T[]) => Promise<R[]>,
  ): Promise<R[]> {
    const chunks: T[][] = [];
    for (let at = 0; at < rows.length; at += CHUNK) {
      chunks.push(rows.slice(at, at + CHUNK));
    }
    return chunks.reduce(async (pending, chunk) => {
      const done = await pending;
      done.push(...(await insert(chunk)));
      return done;
    }, Promise.resolve<R[]>([]));
  }
}
