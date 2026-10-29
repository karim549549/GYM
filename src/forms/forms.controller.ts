import { RequireAction } from '../common/decorators/require-action.decorator';
import { WorkspaceAction } from '../members/enums/workspace-action.enum';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
} from '@nestjs/common';
import { CurrentWorkspaceId } from '../common/decorators/current-workspace-id.decorator';
import {
  FormPurposeParamsDto,
  FormTemplateParamsDto,
} from './dto/form-params.dto';
import { SaveFormDto } from './dto/save-form.dto';
import { FormsService } from './forms.service';
import type { FormRecord } from './interfaces/form.interface';

/** The coach's own questions: the intake form clients fill in first, and the check-in they answer after. */
@Controller('forms')
export class FormsController {
  constructor(private readonly forms: FormsService) {}

  // declared before ':purpose' so that "templates" is not read as a purpose
  @RequireAction(WorkspaceAction.COACHING_READ)
  @Get('templates/:id')
  template(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: FormTemplateParamsDto,
  ): Promise<FormRecord> {
    return this.forms.template(workspaceId, params.id);
  }

  @RequireAction(WorkspaceAction.COACHING_READ)
  @Get(':purpose')
  current(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: FormPurposeParamsDto,
  ): Promise<FormRecord> {
    return this.forms.current(workspaceId, params.purpose);
  }

  @RequireAction(WorkspaceAction.COACHING_WRITE)
  @Put(':purpose')
  save(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: FormPurposeParamsDto,
    @Body() dto: SaveFormDto,
  ): Promise<FormRecord> {
    return this.forms.save(workspaceId, params.purpose, dto.questions);
  }

  @RequireAction(WorkspaceAction.COACHING_WRITE)
  @Delete(':purpose')
  @HttpCode(204)
  reset(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: FormPurposeParamsDto,
  ): Promise<void> {
    return this.forms.reset(workspaceId, params.purpose);
  }
}
