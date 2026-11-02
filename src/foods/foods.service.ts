import { FoodPublicationStatus } from './enums/food-publication-status.enum';
import type { ListFoodPublicationsQueryDto } from './dto/food-publication.dto';
import { FoodPublicationRequestOrchestrator } from './orchestration/food-publication-request.orchestrator';
import { FoodPublicationListOrchestrator } from './orchestration/food-publication-list.orchestrator';
import { FoodPublicationReviewOrchestrator } from './orchestration/food-publication-review.orchestrator';
import { Injectable } from '@nestjs/common';
import type { PaginatedResponse } from '../common/handlers/base-query.handler';
import type {
  FoodChanges,
  FoodListFilter,
  FoodRecord,
  NewFood,
} from './interfaces/food.interface';
import { FoodCreationOrchestrator } from './orchestration/food-creation.orchestrator';
import { FoodDetailsOrchestrator } from './orchestration/food-details.orchestrator';
import { FoodListOrchestrator } from './orchestration/food-list.orchestrator';
import { FoodLookupOrchestrator } from './orchestration/food-lookup.orchestrator';
import { FoodUpdateOrchestrator } from './orchestration/food-update.orchestrator';

/** The foods module's interface: the food database nutrition plans are built from. */
@Injectable()
export class FoodsService {
  constructor(
    private readonly publicationRequest: FoodPublicationRequestOrchestrator,
    private readonly publicationList: FoodPublicationListOrchestrator,
    private readonly publicationReview: FoodPublicationReviewOrchestrator,
    private readonly foodList: FoodListOrchestrator,
    private readonly foodDetails: FoodDetailsOrchestrator,
    private readonly foodCreation: FoodCreationOrchestrator,
    private readonly foodUpdate: FoodUpdateOrchestrator,
    private readonly foodLookup: FoodLookupOrchestrator,
  ) {}

  requestPublication(workspaceId: string, foodId: string) {
    return this.publicationRequest.execute(workspaceId, foodId);
  }
  listPublications(query: ListFoodPublicationsQueryDto, workspaceId?: string) {
    return this.publicationList.execute(query, workspaceId);
  }
  approvePublication(id: string, personId: string, note?: string) {
    return this.publicationReview.execute(
      id,
      personId,
      FoodPublicationStatus.APPROVED,
      note,
    );
  }
  rejectPublication(id: string, personId: string, note: string) {
    return this.publicationReview.execute(
      id,
      personId,
      FoodPublicationStatus.REJECTED,
      note,
    );
  }
  duplicatePublication(
    id: string,
    personId: string,
    duplicateOfFoodId: string,
    note?: string,
  ) {
    return this.publicationReview.execute(
      id,
      personId,
      FoodPublicationStatus.DUPLICATE,
      note,
      duplicateOfFoodId,
    );
  }

  list(
    workspaceId: string,
    filter: FoodListFilter,
    page?: number,
    limit?: number,
  ): Promise<PaginatedResponse<FoodRecord>> {
    return this.foodList.execute(workspaceId, filter, page, limit);
  }

  findOne(workspaceId: string, foodId: string): Promise<FoodRecord> {
    return this.foodDetails.execute(workspaceId, foodId);
  }

  create(workspaceId: string, food: NewFood): Promise<FoodRecord> {
    return this.foodCreation.execute(workspaceId, food);
  }

  update(
    workspaceId: string,
    foodId: string,
    changes: FoodChanges,
  ): Promise<FoodRecord> {
    return this.foodUpdate.execute(workspaceId, foodId, changes);
  }

  /** For nutrition plans: which of these the workspace can use, with their portions. */
  findVisible(workspaceId: string, foodIds: string[]): Promise<FoodRecord[]> {
    return this.foodLookup.visible(workspaceId, foodIds);
  }

  /** For starter plans: the library's foods by handle. Needs no workspace, so it works inside the transaction that creates one. */
  findLibraryBySlugs(slugs: string[]): Promise<FoodRecord[]> {
    return this.foodLookup.library(slugs);
  }
}
