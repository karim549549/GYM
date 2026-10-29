/** What a coach's client can agree to. Each is its own choice, never bundled into another. */
export enum ClientConsentType {
  /** The coach may keep and use the client's name, phone and coaching records. */
  DATA_PROCESSING = 'data_processing',
  /** Explicit consent for health data (body measurements, check-in answers), which the law treats as sensitive. */
  HEALTH_DATA = 'health_data',
  /** Renewal reminders and check-in links over WhatsApp. Optional: refusing it never blocks coaching. */
  WHATSAPP_NOTIFICATIONS = 'whatsapp_notifications',
}
