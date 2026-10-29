import { Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, inArray, ne } from 'drizzle-orm';
import {
  BaseQueryHandler,
  type PaginatedResponse,
} from '../../common/handlers/base-query.handler';
import {
  foodUnits,
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
  kcalTarget: mealPlans.kcalTarget,
  proteinTargetG: mealPlans.proteinTargetG,
  carbTargetG: mealPlans.carbTargetG,
  fatTargetG: mealPlans.fatTargetG,
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
      kcalTarget?: number | null;
      proteinTargetG?: number | null;
      carbTargetG?: number | null;
      fatTargetG?: number | null;
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
        kcalTarget: plan.kcalTarget ?? null,
        proteinTargetG: plan.proteinTargetG ?? null,
        carbTargetG: plan.carbTargetG ?? null,
        fatTargetG: plan.fatTargetG ?? null,
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
      kcalTarget: number;
      proteinTargetG: number;
      carbTargetG: number;
      fatTargetG: number;
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
      ...(changes.kcalTarget !== undefined && {
        kcalTarget: changes.kcalTarget,
      }),
      ...(changes.proteinTargetG !== undefined && {
        proteinTargetG: changes.proteinTargetG,
      }),
      ...(changes.carbTargetG !== undefined && {
        carbTargetG: changes.carbTargetG,
      }),
      ...(changes.fatTargetG !== undefined && {
        fatTargetG: changes.fatTargetG,
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
    return [...new Set([...items, ...subs].map((row) => row.id))];
  }

  /** The whole structure, in reading order: by day, then position. */
  async loadMeals(planId: string): Promise<StoredMealRecord[]> {
    const mealRows = await this.db
      .select()
      .from(meals)
      .where(eq(meals.mealPlanId, planId))
      .orderBy(asc(meals.dayNo), asc(meals.position));
    if (mealRows.length === 0) {
      return [];
    }
    const itemRows = await this.db
      .select({ item: mealItems, unitLabelAr: foodUnits.labelAr })
      .from(mealItems)
      .leftJoin(foodUnits, eq(foodUnits.id, mealItems.unitId))
      .where(
        inArray(
          mealItems.mealId,
          mealRows.map((meal) => meal.id),
        ),
      )
      .orderBy(asc(mealItems.position));
    const subRows =
      itemRows.length === 0
        ? []
        : await this.db
            .select({ sub: mealItemSubs, unitLabelAr: foodUnits.labelAr })
            .from(mealItemSubs)
            .leftJoin(foodUnits, eq(foodUnits.id, mealItemSubs.unitId))
            .where(
              inArray(
                mealItemSubs.mealItemId,
                itemRows.map((row) => row.item.id),
              ),
            )
            .orderBy(asc(mealItemSubs.position));

    return mealRows.map((meal) => {
      const items: MealItemRecord[] = itemRows
        .filter((row) => row.item.mealId === meal.id)
        .map(({ item, unitLabelAr }) => ({
          ...this.macrosOf(item),
          position: item.position,
          foodId: item.foodId,
          foodName: item.foodName,
          quantity: item.quantity,
          unitId: item.unitId,
          unitLabelAr,
          substitutes: subRows
            .filter((row) => row.sub.mealItemId === item.id)
            .map(({ sub, unitLabelAr: label }): MealSubstituteRecord => ({
              ...this.macrosOf(sub),
              position: sub.position,
              foodId: sub.foodId,
              foodName: sub.foodName,
              quantity: sub.quantity,
              unitId: sub.unitId,
              unitLabelAr: label,
            })),
        }));
      return {
        dayNo: meal.dayNo,
        position: meal.position,
        name: meal.name,
        timeHint: meal.timeHint ? meal.timeHint.slice(0, 5) : null,
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
    // a meal's position is its place among that day's meals of its plan
    const placed = new Map<string, number>();
    const all = plansToFill.flatMap(({ planId, meals: own }) =>
      own.map((meal) => {
        const key = `${planId}:${meal.dayNo}`;
        const position = (placed.get(key) ?? 0) + 1;
        placed.set(key, position);
        return { planId, meal, position };
      }),
    );
    if (all.length === 0) {
      return;
    }

    const mealRows = await this.insertChunked(all, (chunk) =>
      this.db
        .insert(meals)
        .values(
          chunk.map(({ planId, meal, position }) => ({
            workspaceId,
            mealPlanId: planId,
            dayNo: meal.dayNo,
            position,
            name: meal.name,
            timeHint: meal.timeHint,
            notes: meal.notes,
          })),
        )
        .returning({
          id: meals.id,
          mealPlanId: meals.mealPlanId,
          dayNo: meals.dayNo,
          position: meals.position,
        }),
    );
    const mealId = new Map(
      mealRows.map((row) => [
        `${row.mealPlanId}:${row.dayNo}:${row.position}`,
        row.id,
      ]),
    );

    const wanted = all.flatMap(({ planId, meal, position }) => {
      const id = mealId.get(`${planId}:${meal.dayNo}:${position}`) as string;
      return meal.items.map((item, index) => ({
        mealId: id,
        item,
        position: index + 1,
      }));
    });
    if (wanted.length === 0) {
      return;
    }
    const itemRows = await this.insertChunked(wanted, (chunk) =>
      this.db
        .insert(mealItems)
        .values(
          chunk.map(({ mealId: id, item, position }) => ({
            workspaceId,
            mealId: id,
            position,
            foodId: item.foodId,
            quantity: item.quantity,
            unitId: item.unitId,
            grams: item.grams,
            foodName: item.foodName,
            kcal: item.kcal,
            proteinG: item.proteinG,
            carbG: item.carbG,
            fatG: item.fatG,
          })),
        )
        .returning({
          id: mealItems.id,
          mealId: mealItems.mealId,
          position: mealItems.position,
        }),
    );
    const itemId = new Map(
      itemRows.map((row) => [`${row.mealId}:${row.position}`, row.id]),
    );

    const subs = wanted.flatMap(({ mealId: id, item, position }) =>
      item.substitutes.map((sub, index) => ({
        workspaceId,
        mealItemId: itemId.get(`${id}:${position}`) as string,
        position: index + 1,
        foodId: sub.foodId,
        quantity: sub.quantity,
        unitId: sub.unitId,
        grams: sub.grams,
        foodName: sub.foodName,
        kcal: sub.kcal,
        proteinG: sub.proteinG,
        carbG: sub.carbG,
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
    grams: number;
    kcal: number;
    proteinG: number;
    carbG: number;
    fatG: number;
  }) {
    return {
      grams: row.grams,
      kcal: row.kcal,
      proteinG: row.proteinG,
      carbG: row.carbG,
      fatG: row.fatG,
    };
  }

  private async insertChunked<T, R>(
    rows: T[],
    insert: (chunk: T[]) => Promise<R[]>,
  ): Promise<R[]> {
    const done: R[] = [];
    for (let at = 0; at < rows.length; at += CHUNK) {
      done.push(...(await insert(rows.slice(at, at + CHUNK))));
    }
    return done;
  }
}
