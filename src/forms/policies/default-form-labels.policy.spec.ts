import { CheckinFormPolicy } from '../../checkins/policies/checkin-form.policy';
import { IntakeFormPolicy } from '../../intake/policies/intake-form.policy';
import { UnitSystem } from '../../workspaces/enums/unit-system.enum';
import { FormPurpose } from '../enums/form-purpose.enum';
import { DefaultFormLabelsPolicy } from './default-form-labels.policy';

const policy = new DefaultFormLabelsPolicy();
const arabic = /[؀-ۿ]/;

describe('DefaultFormLabelsPolicy', () => {
  it.each([UnitSystem.METRIC, UnitSystem.IMPERIAL])(
    'words every question of the built-in intake form in Arabic (%s)',
    (units) => {
      const form = policy.describe(
        new IntakeFormPolicy().formFor(units),
        FormPurpose.INTAKE,
      );

      for (const question of form.questions) {
        expect([question.id, arabic.test(question.labelAr ?? '')]).toEqual([
          question.id,
          true,
        ]);
      }
    },
  );

  it('words every question of the built-in check-in in Arabic', () => {
    const form = policy.describe(
      new CheckinFormPolicy().formFor(UnitSystem.METRIC),
      FormPurpose.CHECKIN,
    );

    for (const question of form.questions) {
      expect([question.id, arabic.test(question.labelAr ?? '')]).toEqual([
        question.id,
        true,
      ]);
    }
  });

  it('words every option of every select, keeping the value that is stored', () => {
    for (const [purpose, form] of [
      [FormPurpose.INTAKE, new IntakeFormPolicy().formFor(UnitSystem.METRIC)],
      [FormPurpose.CHECKIN, new CheckinFormPolicy().formFor(UnitSystem.METRIC)],
    ] as const) {
      for (const question of policy.describe(form, purpose).questions) {
        if (!question.options) {
          continue;
        }
        expect(question.choices?.map((c) => c.value)).toEqual(question.options);
        for (const choice of question.choices ?? []) {
          expect([
            question.id,
            choice.value,
            arabic.test(choice.labelAr),
          ]).toEqual([question.id, choice.value, true]);
        }
      }
    }
  });

  it('changes nothing else about the form', () => {
    const plain = new IntakeFormPolicy().formFor(UnitSystem.METRIC);

    const described = policy.describe(plain, FormPurpose.INTAKE);

    expect(described.version).toBe(plain.version);
    expect(described.units).toEqual(plain.units);
    expect(
      described.questions.map(
        ({ labelAr: _l, helpText: _h, choices: _c, ...rest }) => rest,
      ),
    ).toEqual(plain.questions);
  });

  it('does not change the form it is given', () => {
    const plain = new IntakeFormPolicy().formFor(UnitSystem.METRIC);
    const copy = structuredClone(plain);

    policy.describe(plain, FormPurpose.INTAKE);

    expect(plain).toEqual(copy);
  });
});
