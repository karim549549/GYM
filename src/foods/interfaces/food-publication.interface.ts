import type { FoodPublicationStatus } from '../enums/food-publication-status.enum';
import type { FoodRecord } from './food.interface';

export interface FoodPublicationRecord {
  id: string;
  workspaceId: string;
  foodId: string;
  status: FoodPublicationStatus;
  duplicateOfFoodId: string | null;
  reviewerNote: string | null;
  requestedAt: Date;
  reviewedBy: string | null;
  reviewedAt: Date | null;
}

export interface FoodPublicationDetails extends FoodPublicationRecord {
  food: FoodRecord;
  coachBrandName?: string;
}
