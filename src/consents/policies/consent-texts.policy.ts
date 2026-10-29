import { Injectable } from '@nestjs/common';
import { ClientConsentType } from '../enums/client-consent-type.enum';
import { PersonConsentType } from '../enums/person-consent-type.enum';
import type { ConsentText } from '../interfaces/consent.interface';

/**
 * The wording of every consent, in code so each choice is stored with the version it was made
 * on. Changing a sentence means a new version, which is how a person is asked again. The text is a
 * draft until a lawyer has read it against Egypt's data protection law (151 of 2020).
 */
@Injectable()
export class ConsentTextsPolicy {
  static readonly VERSION = 'v1-2026-10';

  forClient(): ConsentText[] {
    return [
      {
        type: ClientConsentType.DATA_PROCESSING,
        version: ConsentTextsPolicy.VERSION,
        required: true,
        textAr:
          'أوافق على أن يحتفظ مدربي ببياناتي (اسمي ورقم هاتفي وسجل تدريبي واشتراكي) وأن يستخدمها لتدريبي ومتابعة اشتراكي فقط. يمكنني سحب موافقتي في أي وقت.',
        textEn:
          'I agree that my coach keeps my details (name, phone number, training and subscription records) and uses them only to coach me and manage my subscription. I can withdraw this at any time.',
      },
      {
        type: ClientConsentType.HEALTH_DATA,
        version: ConsentTextsPolicy.VERSION,
        required: true,
        textAr:
          'أوافق صراحةً على أن يطّلع مدربي على بياناتي الصحية (قياسات الجسم وإجاباتي في الاستبيان والمتابعة) وأن يحتفظ بها لتصميم برنامجي. هذه بيانات حساسة ولن تُستخدم لغير ذلك، ويمكنني سحب موافقتي في أي وقت.',
        textEn:
          'I explicitly agree that my coach can see my health data (body measurements and my answers in the intake form and check-ins) and keep it to design my programme. This is sensitive data and will not be used for anything else. I can withdraw this at any time.',
      },
      {
        type: ClientConsentType.WHATSAPP_NOTIFICATIONS,
        version: ConsentTextsPolicy.VERSION,
        required: false,
        textAr:
          'أوافق على استلام رسائل واتساب من مدربي (تنبيهات انتهاء الاشتراك وروابط المتابعة). الموافقة اختيارية ويمكنني إيقافها في أي وقت.',
        textEn:
          'I agree to receive WhatsApp messages from my coach (subscription expiry notices and check-in links). This is optional and I can stop it at any time.',
      },
    ];
  }

  forPerson(): ConsentText[] {
    return [
      {
        type: PersonConsentType.TERMS,
        version: ConsentTextsPolicy.VERSION,
        required: true,
        textAr: 'أوافق على شروط الاستخدام.',
        textEn: 'I agree to the terms of use.',
      },
      {
        type: PersonConsentType.PRIVACY_POLICY,
        version: ConsentTextsPolicy.VERSION,
        required: true,
        textAr: 'قرأت سياسة الخصوصية وأوافق عليها.',
        textEn: 'I have read and accept the privacy policy.',
      },
      {
        type: PersonConsentType.PLATFORM_NOTIFICATIONS,
        version: ConsentTextsPolicy.VERSION,
        required: false,
        textAr:
          'أوافق على استلام رسائل من المنصة عن حسابي واشتراكي. الموافقة اختيارية ويمكنني إيقافها في أي وقت.',
        textEn:
          'I agree to receive messages from the platform about my account and plan. This is optional and I can stop it at any time.',
      },
    ];
  }
}
