import { Injectable } from '@nestjs/common';
import type {
  IntakeForm,
  IntakeQuestion,
} from '../../intake/interfaces/intake-form.interface';
import { FormPurpose } from '../enums/form-purpose.enum';

const YES_NO = { yes: 'نعم', no: 'لا' };
const NONE = { none: 'لا يوجد' };

/** question id -> its wording, and for a select the wording of each option. */
type Labels = Record<
  string,
  { label: string; options?: Record<string, string> }
>;

/**
 * The Arabic wording of the built-in forms. The built-in forms are code, and the apps translate them
 * by question id; this gives the same questions words so a coach can start from them and change what
 * they like, rather than from a blank page.
 */
@Injectable()
export class DefaultFormLabelsPolicy {
  private static readonly LABELS: Record<FormPurpose, Labels> = {
    [FormPurpose.INTAKE]: {
      age: { label: 'العمر' },
      gender: { label: 'النوع', options: { male: 'ذكر', female: 'أنثى' } },
      height: { label: 'الطول' },
      weight: { label: 'الوزن الحالي' },
      targetWeight: { label: 'الوزن المستهدف' },
      goal: {
        label: 'هدفك',
        options: {
          fat_loss: 'خسارة دهون',
          muscle_gain: 'بناء عضل',
          general_fitness: 'لياقة عامة',
          injury_rehab: 'تأهيل إصابة',
        },
      },
      experience: {
        label: 'مستوى خبرتك',
        options: {
          beginner: 'مبتدئ',
          intermediate: 'متوسط',
          advanced: 'متقدم',
        },
      },
      trainingDays: { label: 'أيام التمرين في الأسبوع' },
      sessionMinutes: { label: 'مدة الحصة بالدقائق' },
      location: {
        label: 'مكان التمرين',
        options: { gym: 'النادي', home: 'المنزل', both: 'الاثنان' },
      },
      injuries: {
        label: 'إصابات أو أمراض مزمنة',
        options: {
          knee: 'الركبة',
          back: 'الظهر',
          shoulder: 'الكتف',
          neck: 'الرقبة',
          heart_condition: 'القلب',
          diabetes: 'السكر',
          high_blood_pressure: 'الضغط',
          ...NONE,
        },
      },
      injuriesNote: { label: 'تفاصيل الإصابات' },
      medications: { label: 'الأدوية الحالية' },
      allergies: {
        label: 'الحساسية',
        options: {
          gluten: 'الجلوتين',
          dairy: 'الألبان',
          nuts: 'المكسرات',
          eggs: 'البيض',
          seafood: 'المأكولات البحرية',
          ...NONE,
        },
      },
      foodsAvoided: { label: 'أطعمة لا تأكلها' },
      mealsPerDay: { label: 'عدد الوجبات المفضل في اليوم' },
      sleepQuality: { label: 'جودة النوم' },
      stressLevel: { label: 'مستوى التوتر' },
    },
    [FormPurpose.CHECKIN]: {
      weight: { label: 'وزنك الآن' },
      waist: { label: 'محيط الوسط' },
      chest: { label: 'محيط الصدر' },
      arm: { label: 'محيط الذراع' },
      nutritionDays: { label: 'كم يوم التزمت بخطة الأكل هذا الأسبوع (من 7)' },
      trainingDays: { label: 'كم يوم تمرنت هذا الأسبوع (من 7)' },
      sleepQuality: { label: 'جودة النوم' },
      energyLevel: { label: 'مستوى الطاقة' },
      pain: { label: 'هل تشعر بألم أو إصابة؟', options: YES_NO },
      painNote: { label: 'تفاصيل الألم' },
      note: { label: 'أي شيء تريد إخباري به' },
    },
  };

  /** The same form, each question with its wording and each select option with its own. */
  describe(form: IntakeForm, purpose: FormPurpose): IntakeForm {
    const labels = DefaultFormLabelsPolicy.LABELS[purpose];
    return {
      ...form,
      questions: form.questions.map((question): IntakeQuestion => {
        const wording = labels[question.id];
        return {
          ...question,
          labelAr: wording?.label,
          ...(question.options && {
            choices: question.options.map((value) => ({
              value,
              labelAr: wording?.options?.[value] ?? value,
            })),
          }),
        };
      }),
    };
  }
}
