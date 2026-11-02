import 'reflect-metadata';
import { RecipesController } from './recipes.controller';
import { REQUIRED_ACTION_KEY } from '../common/decorators/require-action.decorator';
import { WorkspaceAction } from '../members/enums/workspace-action.enum';
describe('Recipe route permissions', () => {
  it.each(['list', 'findOne'] as const)('%s requires coaching read', (method) =>
    expect(
      Reflect.getMetadata(
        REQUIRED_ACTION_KEY,
        RecipesController.prototype[method],
      ),
    ).toBe(WorkspaceAction.COACHING_READ),
  );
  it.each(['create', 'update', 'copy'] as const)(
    '%s requires coaching write',
    (method) =>
      expect(
        Reflect.getMetadata(
          REQUIRED_ACTION_KEY,
          RecipesController.prototype[method],
        ),
      ).toBe(WorkspaceAction.COACHING_WRITE),
  );
});
