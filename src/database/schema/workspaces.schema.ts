import { sql } from 'drizzle-orm';
import {
  char,
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { UnitSystem } from '../../workspaces/enums/unit-system.enum';

// the allowed units are the enum's values, so the constraint cannot drift from the code
const UNIT_VALUES = Object.values(UnitSystem)
  .map((unit) => `'${unit}'`)
  .join(', ');

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandName: text('brand_name').notNull(),
    slug: text('slug').notNull().unique(),
    /** Where the logo is in storage (a key); the address is built when it is read. */
    logoKey: text('logo_key'),
    currency: char('currency', { length: 3 }).notNull().default('EGP'),
    unitSystem: text('unit_system')
      .$type<UnitSystem>()
      .notNull()
      .default(UnitSystem.METRIC),
    expiryAlertDays: integer('expiry_alert_days').notNull().default(7),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'workspaces_unit_system_check',
      sql`${table.unitSystem} in (${sql.raw(UNIT_VALUES)})`,
    ),
  ],
);
