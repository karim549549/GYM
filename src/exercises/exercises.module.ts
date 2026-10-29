import { Module } from '@nestjs/common';
import { ExercisesController } from './exercises.controller';
import { ExercisesService } from './exercises.service';
import { ExercisesQueryHandler } from './handlers/exercises-query.handler';
import { ExerciseCreationOrchestrator } from './orchestration/exercise-creation.orchestrator';
import { ExerciseDetailsOrchestrator } from './orchestration/exercise-details.orchestrator';
import { ExerciseLibraryLookupOrchestrator } from './orchestration/exercise-library-lookup.orchestrator';
import { ExerciseListOrchestrator } from './orchestration/exercise-list.orchestrator';
import { ExerciseSummariesOrchestrator } from './orchestration/exercise-summaries.orchestrator';
import { ExerciseUpdateOrchestrator } from './orchestration/exercise-update.orchestrator';
import { MuscleListOrchestrator } from './orchestration/muscle-list.orchestrator';

@Module({
  controllers: [ExercisesController],
  providers: [
    ExercisesService,
    ExercisesQueryHandler,
    MuscleListOrchestrator,
    ExerciseListOrchestrator,
    ExerciseDetailsOrchestrator,
    ExerciseCreationOrchestrator,
    ExerciseUpdateOrchestrator,
    ExerciseSummariesOrchestrator,
    ExerciseLibraryLookupOrchestrator,
  ],
  exports: [ExercisesService],
})
export class ExercisesModule {}
