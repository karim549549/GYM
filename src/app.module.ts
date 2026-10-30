import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ClientOverviewModule } from './client-overview/client-overview.module';
import { ClientsModule } from './clients/clients.module';
import { validateEnv } from './config/env.schema';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { BillingModule } from './billing/billing.module';
import { CheckinsModule } from './checkins/checkins.module';
import { ConsentsModule } from './consents/consents.module';
import { ExercisesModule } from './exercises/exercises.module';
import { FoodsModule } from './foods/foods.module';
import { FormsModule } from './forms/forms.module';
import { HomeModule } from './home/home.module';
import { IntakeModule } from './intake/intake.module';
import { InvitationsModule } from './invitations/invitations.module';
import { PaymentsModule } from './payments/payments.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { PlansModule } from './plans/plans.module';
import { MealPlansModule } from './meal-plans/meal-plans.module';
import { LoggingModule } from './logging/logging.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { PackagesModule } from './packages/packages.module';
import { PaymentChannelsModule } from './payment-channels/payment-channels.module';
import { ReminderMessagesModule } from './reminder-messages/reminder-messages.module';
import { WorkspacesModule } from './workspaces/workspaces.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggingModule,
    DatabaseModule,
    AuthModule,
    HealthModule,
    WorkspacesModule,
    PackagesModule,
    PaymentChannelsModule,
    ReminderMessagesModule,
    ClientsModule,
    ClientOverviewModule,
    IntakeModule,
    SubscriptionsModule,
    PaymentsModule,
    HomeModule,
    CheckinsModule,
    ExercisesModule,
    PlansModule,
    FoodsModule,
    MealPlansModule,
    BillingModule,
    AnalyticsModule,
    FormsModule,
    ConsentsModule,
    InvitationsModule,
    OnboardingModule,
  ],
})
export class AppModule {}
