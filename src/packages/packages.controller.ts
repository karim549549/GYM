import { RequireAction } from '../common/decorators/require-action.decorator';
import { WorkspaceAction } from '../members/enums/workspace-action.enum';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentWorkspaceId } from '../common/decorators/current-workspace-id.decorator';
import { CreatePackageDto } from './dto/create-package.dto';
import { ListPackagesQueryDto } from './dto/list-packages.query.dto';
import { PackageParamsDto } from './dto/package-params.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import type { PackageRecord } from './interfaces/package.interface';
import { PackagesService } from './packages.service';

@Controller('packages')
export class PackagesController {
  constructor(private readonly packages: PackagesService) {}

  @RequireAction(WorkspaceAction.MEMBER)
  @Get()
  list(
    @CurrentWorkspaceId() workspaceId: string,
    @Query() query: ListPackagesQueryDto,
  ): Promise<PackageRecord[]> {
    return this.packages.list(workspaceId, query.includeInactive === 'true');
  }

  @RequireAction(WorkspaceAction.PACKAGES_WRITE)
  @Post()
  create(
    @CurrentWorkspaceId() workspaceId: string,
    @Body() dto: CreatePackageDto,
  ): Promise<PackageRecord> {
    return this.packages.create(workspaceId, dto);
  }

  @RequireAction(WorkspaceAction.PACKAGES_WRITE)
  @Patch(':id')
  update(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: PackageParamsDto,
    @Body() dto: UpdatePackageDto,
  ): Promise<PackageRecord> {
    return this.packages.update(workspaceId, params.id, dto);
  }

  /** Only a package nobody bought. Otherwise `PACKAGE_IN_USE`: set `isActive: false` instead. */
  @RequireAction(WorkspaceAction.PACKAGES_WRITE)
  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: PackageParamsDto,
  ): Promise<void> {
    return this.packages.remove(workspaceId, params.id);
  }
}
