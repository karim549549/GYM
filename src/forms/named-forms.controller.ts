import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentWorkspaceId } from '../common/decorators/current-workspace-id.decorator';
import { RequireAction } from '../common/decorators/require-action.decorator';
import { WorkspaceAction } from '../members/enums/workspace-action.enum';
import {
  CreateNamedFormDto,
  ListNamedFormsQueryDto,
  NamedFormParamsDto,
  UpdateNamedFormDto,
} from './dto/named-form.dto';
import { FormsService } from './forms.service';
import type {
  NamedFormRecord,
  NamedFormSummary,
} from './interfaces/form.interface';

/** The coach's library of forms: each has a name and versions of its own questions. */
@Controller('named-forms')
export class NamedFormsController {
  constructor(private readonly forms: FormsService) {}

  @RequireAction(WorkspaceAction.COACHING_READ)
  @Get()
  list(
    @CurrentWorkspaceId() workspaceId: string,
    @Query() query: ListNamedFormsQueryDto,
  ): Promise<NamedFormSummary[]> {
    return this.forms.namedForms(workspaceId, query.purpose);
  }

  @RequireAction(WorkspaceAction.COACHING_WRITE)
  @Post()
  create(
    @CurrentWorkspaceId() workspaceId: string,
    @Body() dto: CreateNamedFormDto,
  ): Promise<NamedFormRecord> {
    return this.forms.createNamedForm(
      workspaceId,
      dto.purpose,
      dto.name,
      dto.questions,
    );
  }

  @RequireAction(WorkspaceAction.COACHING_READ)
  @Get(':id')
  details(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: NamedFormParamsDto,
  ): Promise<NamedFormRecord> {
    return this.forms.namedForm(workspaceId, params.id);
  }

  /** A new name, new questions (the next version), or both. */
  @RequireAction(WorkspaceAction.COACHING_WRITE)
  @Put(':id')
  update(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: NamedFormParamsDto,
    @Body() dto: UpdateNamedFormDto,
  ): Promise<NamedFormRecord> {
    return this.forms.updateNamedForm(workspaceId, params.id, dto);
  }

  /** Takes it off the coach's list. Answers and links already sent keep working. */
  @RequireAction(WorkspaceAction.COACHING_WRITE)
  @Delete(':id')
  @HttpCode(204)
  archive(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: NamedFormParamsDto,
  ): Promise<void> {
    return this.forms.archiveNamedForm(workspaceId, params.id);
  }
}
