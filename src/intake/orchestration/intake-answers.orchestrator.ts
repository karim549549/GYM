import { Injectable } from '@nestjs/common';
import { ClientsService } from '../../clients/clients.service';
import { ClientConsentType } from '../../consents/enums/client-consent-type.enum';
import { ConsentsService } from '../../consents/consents.service';
import { TransactionManager } from '../../database/transaction.manager';
import { IntakeNotSubmittedException } from '../exceptions/intake-exceptions';
import { IntakeQueryHandler } from '../handlers/intake-query.handler';
import type { IntakeResponseView } from '../interfaces/intake.interface';

/** Takes over `IntakeService.latestAnswers`: what a client handed in, for the coach to read. */
@Injectable()
export class IntakeAnswersOrchestrator {
  constructor(
    private readonly intakeQuery: IntakeQueryHandler,
    private readonly clients: ClientsService,
    private readonly consents: ConsentsService,
    private readonly transactions: TransactionManager,
  ) {}

  async execute(
    workspaceId: string,
    clientId: string,
  ): Promise<IntakeResponseView> {
    const response = await this.transactions.run(
      async () => {
        await this.clients.findOne(workspaceId, clientId);
        const found = await this.intakeQuery.findLatestResponse(clientId);
        if (found) {
          // health data: the coach may read it only while the client agrees
          await this.consents.require(workspaceId, clientId, [
            ClientConsentType.DATA_PROCESSING,
            ClientConsentType.HEALTH_DATA,
          ]);
        }
        return found;
      },
      { workspaceId },
    );
    if (!response) {
      throw new IntakeNotSubmittedException();
    }
    return response;
  }
}
