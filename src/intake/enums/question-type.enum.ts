/** The kinds of question a form can ask (the product's version one). */
export enum QuestionType {
  SHORT_TEXT = 'short_text',
  LONG_TEXT = 'long_text',
  NUMBER = 'number',
  SINGLE_SELECT = 'single_select',
  MULTI_SELECT = 'multi_select',
  /** One of many options, shown as a list instead of buttons. */
  DROPDOWN = 'dropdown',
  /** A calendar day, YYYY-MM-DD. */
  DATE = 'date',
  /** Yes or no. */
  BOOLEAN = 'boolean',
  /** A whole number on a scale, such as 1 to 10. */
  SCALE = 'scale',
  /** A photo. Can be asked, but no answer is accepted until photos have their own private storage flow. */
  IMAGE = 'image',
}
