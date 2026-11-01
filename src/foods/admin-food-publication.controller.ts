import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { Principal } from '../auth/interfaces/principal.interface';
import { PlatformAdminGuard } from '../billing/guards/platform-admin.guard';
import { CurrentPrincipal } from '../common/decorators/current-principal.decorator';
import { FoodParamsDto } from './dto/food-params.dto';
import {
  ApproveFoodPublicationDto,
  DuplicateFoodPublicationDto,
  ListFoodPublicationsQueryDto,
  RejectFoodPublicationDto,
} from './dto/food-publication.dto';
import { FoodsService } from './foods.service';

@UseGuards(PlatformAdminGuard)
@Controller('admin/food-publication-requests')
export class AdminFoodPublicationController {
  constructor(private readonly foods: FoodsService) {}
  @Get()
  list(@Query() query: ListFoodPublicationsQueryDto) {
    return this.foods.listPublications(query);
  }
  @Post(':id/approve')
  approve(
    @CurrentPrincipal() principal: Principal,
    @Param() params: FoodParamsDto,
    @Body() dto: ApproveFoodPublicationDto,
  ) {
    return this.foods.approvePublication(
      params.id,
      principal.personId,
      dto.note,
    );
  }
  @Post(':id/reject')
  reject(
    @CurrentPrincipal() principal: Principal,
    @Param() params: FoodParamsDto,
    @Body() dto: RejectFoodPublicationDto,
  ) {
    return this.foods.rejectPublication(
      params.id,
      principal.personId,
      dto.note,
    );
  }
  @Post(':id/duplicate')
  duplicate(
    @CurrentPrincipal() principal: Principal,
    @Param() params: FoodParamsDto,
    @Body() dto: DuplicateFoodPublicationDto,
  ) {
    return this.foods.duplicatePublication(
      params.id,
      principal.personId,
      dto.duplicateOfFoodId,
      dto.note,
    );
  }
}
