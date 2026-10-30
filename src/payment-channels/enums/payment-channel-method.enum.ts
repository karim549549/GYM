/** The apps and ways a client can send money to a coach. No gateway: the client transfers outside the app. */
export enum PaymentChannelMethod {
  INSTAPAY = 'instapay',
  WALLET = 'wallet',
  BANK = 'bank',
}
