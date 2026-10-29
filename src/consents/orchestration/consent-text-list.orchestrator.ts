import { Injectable } from '@nestjs/common';
import type { ConsentText } from '../interfaces/consent.interface';
import { ConsentTextsPolicy } from '../policies/consent-texts.policy';

/** Takes over `ConsentsService.texts`: the wording of every consent, for the forms that ask for them. */
@Injectable()
export class ConsentTextListOrchestrator {
  constructor(private readonly textsPolicy: ConsentTextsPolicy) {}

  execute(): {
    version: string;
    client: ConsentText[];
    person: ConsentText[];
  } {
    return {
      version: ConsentTextsPolicy.VERSION,
      client: this.textsPolicy.forClient(),
      person: this.textsPolicy.forPerson(),
    };
  }
}
