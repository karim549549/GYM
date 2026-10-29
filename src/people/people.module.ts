import { Module } from '@nestjs/common';
import { PeopleQueryHandler } from './handlers/people-query.handler';
import { PeopleService } from './people.service';

@Module({
  providers: [PeopleService, PeopleQueryHandler],
  exports: [PeopleService],
})
export class PeopleModule {}
