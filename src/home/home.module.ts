import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { HomeSummaryOrchestrator } from './orchestration/home-summary.orchestrator';

@Module({
  imports: [SubscriptionsModule, PaymentsModule],
  controllers: [HomeController],
  providers: [HomeService, HomeSummaryOrchestrator],
})
export class HomeModule {}
