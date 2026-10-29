import { Module } from '@nestjs/common';
import { PeopleModule } from '../people/people.module';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { ClientsQueryHandler } from './handlers/clients-query.handler';
import { ClientCreationOrchestrator } from './orchestration/client-creation.orchestrator';
import { ClientCountOrchestrator } from './orchestration/client-count.orchestrator';
import { ClientDetailsOrchestrator } from './orchestration/client-details.orchestrator';
import { ClientIntakeStatusOrchestrator } from './orchestration/client-intake-status.orchestrator';
import { ClientListOrchestrator } from './orchestration/client-list.orchestrator';
import { ClientRemovalOrchestrator } from './orchestration/client-removal.orchestrator';
import { ClientUpdateOrchestrator } from './orchestration/client-update.orchestrator';

@Module({
  imports: [PeopleModule],
  controllers: [ClientsController],
  providers: [
    ClientsService,
    ClientsQueryHandler,
    ClientCreationOrchestrator,
    ClientDetailsOrchestrator,
    ClientListOrchestrator,
    ClientUpdateOrchestrator,
    ClientRemovalOrchestrator,
    ClientIntakeStatusOrchestrator,
    ClientCountOrchestrator,
  ],
  exports: [ClientsService],
})
export class ClientsModule {}
