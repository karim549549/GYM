import { Injectable } from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  isNotNull,
  sql,
} from 'drizzle-orm';
import { BaseQueryHandler } from '../../common/handlers/base-query.handler';
import {
  recipes,
  recipeIngredients,
  recipeSteps,
  recipePortions,
  recipeAliases,
} from '../../database/schema';
import { RecipeOrigin } from '../../foods/enums/recipe-origin.enum';
import type { FoodMacros } from '../../foods/interfaces/food.interface';
import { ListRecipesQueryDto } from '../dto/list-recipes.query.dto';
import { RecipeScope } from '../enums/recipe-scope.enum';
import type {
  NewRecipe,
  RecipeChanges,
  RecipeStoredRecord,
} from '../interfaces/recipe.interface';

@Injectable()
export class RecipesQueryHandler extends BaseQueryHandler {
  list(query: ListRecipesQueryDto) {
    const q = sql`normalize_search_text(${query.q ?? ''})`;
    const texts = sql`(select ${recipes.searchName} as value union all select a.search_alias from recipe_aliases a where a.recipe_id = ${recipes.id})`;
    const rank = sql<number>`(select min(case when t.value = ${q} then 0 when starts_with(t.value, ${q}) then 1 when strpos(t.value, ${q}) > 0 then 2 else 3 end) from ${texts} t where strpos(t.value, ${q}) > 0 or similarity(t.value, ${q}) > 0.3)`;
    const similarity = sql<number>`(select max(similarity(t.value, ${q})) from ${texts} t)`;
    const where = and(
      query.includeInactive === 'true' ? undefined : eq(recipes.isActive, true),
      query.scope === RecipeScope.SHARED
        ? isNull(recipes.workspaceId)
        : query.scope === RecipeScope.MINE
          ? isNotNull(recipes.workspaceId)
          : undefined,
      query.mealTag
        ? sql`${query.mealTag} = any(${recipes.mealTags})`
        : undefined,
      query.q ? sql`${rank} is not null` : undefined,
    );
    return this.executePageQuery(
      {
        fetchItems: (take, skip) =>
          this.db
            .select()
            .from(recipes)
            .where(where)
            .orderBy(
              ...(query.q ? [asc(rank)] : []),
              sql`${recipes.workspaceId} is not null`,
              ...(query.q ? [desc(similarity)] : []),
              asc(recipes.nameAr),
              asc(recipes.id),
            )
            .limit(take)
            .offset(skip),
        count: async () =>
          (
            await this.db.select({ total: count() }).from(recipes).where(where)
          )[0].total,
      },
      query.page,
      query.limit,
      async (rows) =>
        (await this.withChildren(rows)).map(
          ({
            ingredients: _ingredients,
            steps: _steps,
            portions: _portions,
            aliases: _aliases,
            ...summary
          }) => summary,
        ),
    );
  }
  async findMany(ids: string[]): Promise<RecipeStoredRecord[]> {
    if (!ids.length) return [];
    return this.withChildren(
      await this.db.select().from(recipes).where(inArray(recipes.id, ids)),
    );
  }
  async lock(id: string): Promise<void> {
    await this.db
      .select({ id: recipes.id })
      .from(recipes)
      .where(eq(recipes.id, id))
      .for('update');
  }
  async create(
    workspaceId: string,
    input: NewRecipe,
    macros: FoodMacros,
    copiedFromRecipeId?: string,
  ): Promise<string> {
    const {
      ingredients: _ingredients,
      steps: _steps,
      portions: _portions,
      aliases: _aliases,
      ...fields
    } = input;
    const [row] = await this.db
      .insert(recipes)
      .values({
        ...fields,
        ...macros,
        workspaceId,
        origin: RecipeOrigin.USER,
        copiedFromRecipeId,
      })
      .returning({ id: recipes.id });
    await this.replaceChildren(workspaceId, row.id, input);
    return row.id;
  }
  async update(
    workspaceId: string,
    id: string,
    changes: RecipeChanges,
    macros?: FoodMacros,
  ): Promise<void> {
    const {
      ingredients: _ingredients,
      steps: _steps,
      portions: _portions,
      aliases: _aliases,
      ...fields
    } = changes;
    if (Object.keys(fields).length || macros)
      await this.db
        .update(recipes)
        .set({ ...fields, ...macros })
        .where(eq(recipes.id, id));
    await this.replaceChildren(workspaceId, id, changes);
  }
  private async replaceChildren(
    workspaceId: string,
    recipeId: string,
    input: RecipeChanges,
  ): Promise<void> {
    if (input.ingredients !== undefined) {
      await this.db
        .delete(recipeIngredients)
        .where(eq(recipeIngredients.recipeId, recipeId));
      if (input.ingredients.length)
        await this.db.insert(recipeIngredients).values(
          input.ingredients.map((i, index) => ({
            foodId: i.foodId,
            weightG: i.weightG,
            noteAr: i.noteAr,
            workspaceId,
            recipeId,
            sortOrder: index + 1,
          })),
        );
    }
    if (input.steps !== undefined) {
      await this.db
        .delete(recipeSteps)
        .where(eq(recipeSteps.recipeId, recipeId));
      if (input.steps.length)
        await this.db.insert(recipeSteps).values(
          input.steps.map((s, index) => ({
            instruction: s.instruction,
            workspaceId,
            recipeId,
            sortOrder: index + 1,
          })),
        );
    }
    if (input.portions !== undefined) {
      await this.db
        .delete(recipePortions)
        .where(eq(recipePortions.recipeId, recipeId));
      if (input.portions.length)
        await this.db.insert(recipePortions).values(
          input.portions.map((p, index) => ({
            nameAr: p.nameAr,
            weightG: p.weightG,
            isDefault: p.isDefault,
            workspaceId,
            recipeId,
            sortOrder: index + 1,
          })),
        );
    }
    if (input.aliases !== undefined) {
      await this.db
        .delete(recipeAliases)
        .where(eq(recipeAliases.recipeId, recipeId));
      if (input.aliases.length)
        await this.db.insert(recipeAliases).values(
          input.aliases.map((a) => ({
            kind: a.kind,
            alias: a.alias,
            workspaceId,
            recipeId,
          })),
        );
    }
  }
  private async withChildren(
    rows: (typeof recipes.$inferSelect)[],
  ): Promise<RecipeStoredRecord[]> {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const ingredients = await this.db
      .select()
      .from(recipeIngredients)
      .where(inArray(recipeIngredients.recipeId, ids))
      .orderBy(asc(recipeIngredients.sortOrder));
    const steps = await this.db
      .select()
      .from(recipeSteps)
      .where(inArray(recipeSteps.recipeId, ids))
      .orderBy(asc(recipeSteps.sortOrder));
    const portions = await this.db
      .select()
      .from(recipePortions)
      .where(inArray(recipePortions.recipeId, ids))
      .orderBy(asc(recipePortions.sortOrder));
    const aliases = await this.db
      .select()
      .from(recipeAliases)
      .where(inArray(recipeAliases.recipeId, ids))
      .orderBy(asc(recipeAliases.id));
    return rows.map(
      ({
        workspaceId,
        searchName: _searchName,
        createdAt: _createdAt,
        ...row
      }) => {
        const ownPortions = portions
          .filter((p) => p.recipeId === row.id)
          .map((p) => ({
            id: p.id,
            nameAr: p.nameAr,
            weightG: p.weightG,
            isDefault: p.isDefault,
            sortOrder: p.sortOrder,
          }));
        const ownIngredients = ingredients
          .filter((i) => i.recipeId === row.id)
          .map((i) => ({
            foodId: i.foodId,
            weightG: i.weightG,
            noteAr: i.noteAr,
            sortOrder: i.sortOrder,
          }));
        return {
          ...row,
          isOwn: workspaceId !== null,
          ingredients: ownIngredients,
          ingredientCount: ownIngredients.length,
          steps: steps
            .filter((s) => s.recipeId === row.id)
            .map((s) => ({
              instruction: s.instruction,
              sortOrder: s.sortOrder,
            })),
          portions: ownPortions,
          defaultPortion: ownPortions.find((p) => p.isDefault) ?? null,
          aliases: aliases
            .filter((a) => a.recipeId === row.id)
            .map((a) => ({ kind: a.kind, alias: a.alias })),
        };
      },
    );
  }
}
