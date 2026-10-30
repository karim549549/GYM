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
} from '@nestjs/common';
import { CurrentWorkspaceId } from '../common/decorators/current-workspace-id.decorator';
import { ClientsService } from './clients.service';
import { ClientParamsDto } from './dto/client-params.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import type { ClientRecord } from './interfaces/client.interface';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @RequireAction(WorkspaceAction.CLIENTS_WRITE)
  @Post()
  create(
    @CurrentWorkspaceId() workspaceId: string,
    @Body() dto: CreateClientDto,
  ): Promise<ClientRecord> {
    return this.clients.create(workspaceId, dto);
  }

  @RequireAction(WorkspaceAction.CLIENTS_READ)
  @Get(':id')
  findOne(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: ClientParamsDto,
  ): Promise<ClientRecord> {
    return this.clients.findOne(workspaceId, params.id);
  }

  @RequireAction(WorkspaceAction.CLIENTS_WRITE)
  @Patch(':id')
  update(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: ClientParamsDto,
    @Body() dto: UpdateClientDto,
  ): Promise<ClientRecord> {
    return this.clients.update(workspaceId, params.id, dto);
  }

  @RequireAction(WorkspaceAction.CLIENTS_WRITE)
  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentWorkspaceId() workspaceId: string,
    @Param() params: ClientParamsDto,
  ): Promise<void> {
    return this.clients.remove(workspaceId, params.id);
  }
}
