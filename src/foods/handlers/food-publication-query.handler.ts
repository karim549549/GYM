import { Injectable } from '@nestjs/common';
import { and, asc, count, eq, sql } from 'drizzle-orm';
import { BaseQueryHandler } from '../../common/handlers/base-query.handler';
import { foodPublicationRequests } from '../../database/schema';
import { FoodPublicationStatus } from '../enums/food-publication-status.enum';
import type { NutritionConfidence } from '../enums/nutrition-confidence.enum';
import type { FoodPublicationRecord } from '../interfaces/food-publication.interface';

@Injectable()
export class FoodPublicationQueryHandler extends BaseQueryHandler {
  async request(
    workspaceId: string,
    foodId: string,
  ): Promise<FoodPublicationRecord | null> {
    return this.firstOrNull(
      await this.db
        .insert(foodPublicationRequests)
        .values({ workspaceId, foodId })
        .onConflictDoNothing()
        .returning(),
    );
  }

  async find(id: string): Promise<FoodPublicationRecord | null> {
    return this.firstOrNull(
      await this.db
        .select()
        .from(foodPublicationRequests)
        .where(eq(foodPublicationRequests.id, id)),
    );
  }

  list(status?: FoodPublicationStatus, page?: number, limit?: number) {
    const where = status
      ? eq(foodPublicationRequests.status, status)
      : undefined;
    return this.executePageQuery(
      {
        fetchItems: (take, skip) =>
          this.db
            .select()
            .from(foodPublicationRequests)
            .where(where)
            .orderBy(
              asc(foodPublicationRequests.requestedAt),
              asc(foodPublicationRequests.id),
            )
            .limit(take)
            .offset(skip),
        count: async () =>
          (
            await this.db
              .select({ total: count() })
              .from(foodPublicationRequests)
              .where(where)
          )[0].total,
      },
      page,
      limit,
    );
  }

  async decide(
    id: string,
    status: FoodPublicationStatus,
    reviewedBy: string,
    note?: string,
    duplicateOfFoodId?: string,
  ): Promise<FoodPublicationRecord | null> {
    return this.firstOrNull(
      await this.db
        .update(foodPublicationRequests)
        .set({
          status,
          reviewedBy,
          reviewerNote: note ?? null,
          duplicateOfFoodId: duplicateOfFoodId ?? null,
          reviewedAt: new Date(),
        })
        .where(
          and(
            eq(foodPublicationRequests.id, id),
            eq(foodPublicationRequests.status, FoodPublicationStatus.PENDING),
          ),
        )
        .returning(),
    );
  }

  async copyShared(
    foodId: string,
    metadata: {
      originNote: string;
      confidence: NutritionConfidence;
      isVerified: boolean;
    },
  ): Promise<string | null> {
    const result = await this.db.execute<{ id: string }>(sql`
      insert into foods (workspace_id, slug, name_ar, name_en, brand, barcode, description_ar, state, origin, origin_note, confidence, review_flags, usda_fdc_id, entry_basis, entered_serving_weight_g, is_verified, category, calories_kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g, is_active)
      select null, null, name_ar, name_en, brand, barcode, description_ar, state, origin, ${metadata.originNote}, ${metadata.confidence}, review_flags, usda_fdc_id, entry_basis, entered_serving_weight_g, ${metadata.isVerified}, category, calories_kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g, is_active
      from foods where id = ${foodId}
      on conflict (barcode) where workspace_id is null do nothing returning id`);
    const id = result.rows[0]?.id;
    if (!id) return null;
    await this.db.execute(
      sql`insert into food_portions (food_id, workspace_id, name_ar, weight_g, is_default, sort_order) select ${id}::uuid, null, name_ar, weight_g, is_default, sort_order from food_portions where food_id = ${foodId}`,
    );
    await this.db.execute(
      sql`insert into food_nutrients (food_id, workspace_id, nutrient_id, amount_per_100g) select ${id}::uuid, null, nutrient_id, amount_per_100g from food_nutrients where food_id = ${foodId}`,
    );
    await this.db.execute(
      sql`insert into food_aliases (food_id, workspace_id, kind, alias) select ${id}::uuid, null, kind, alias from food_aliases where food_id = ${foodId}`,
    );
    return id;
  }
}
