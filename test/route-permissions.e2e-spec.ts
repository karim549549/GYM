import 'reflect-metadata';
import { ModulesContainer } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../src/common/decorators/public.decorator';
import { REQUIRED_ACTION_KEY } from '../src/common/decorators/require-action.decorator';
import { HttpTestApp } from './support/http-test-app';

jest.setTimeout(30_000);

/**
 * The routes that are not about a workspace's data, and so name no action: signing in, a person's own
 * consents and invitations, becoming a coach, and the platform's own admin screens (behind their own guard).
 */
const NOT_ABOUT_A_WORKSPACE = [
  'AuthController',
  'AuthHooksController',
  'HealthController',
  'AdminBillingController',
  'OnboardingController.becomeCoach',
  'ConsentsController.texts',
  'ConsentsController.mine',
  'ConsentsController.changeMine',
  'InvitationsController.mine',
  'InvitationsController.accept',
  'InvitationsController.decline',
];

const isExempt = (controller: string, method: string) =>
  NOT_ABOUT_A_WORKSPACE.includes(controller) ||
  NOT_ABOUT_A_WORKSPACE.includes(`${controller}.${method}`);

describe('Who may call each route', () => {
  let harness: HttpTestApp;

  beforeAll(async () => {
    harness = await HttpTestApp.start();
  });

  afterAll(() => harness.stop(), 60_000);

  const routes = () => {
    const found: {
      controller: string;
      method: string;
      action: unknown;
      isPublic: boolean;
    }[] = [];
    const container = harness.app.get(ModulesContainer);
    for (const module of container.values()) {
      for (const wrapper of module.controllers.values()) {
        const type = wrapper.metatype as (new () => object) | null;
        if (!type) {
          continue;
        }
        for (const name of Object.getOwnPropertyNames(type.prototype)) {
          const handler = (type.prototype as Record<string, unknown>)[name];
          if (
            name === 'constructor' ||
            typeof handler !== 'function' ||
            Reflect.getMetadata('path', handler) === undefined
          ) {
            continue;
          }
          found.push({
            controller: type.name,
            method: name,
            action:
              Reflect.getMetadata(REQUIRED_ACTION_KEY, handler) ??
              Reflect.getMetadata(REQUIRED_ACTION_KEY, type),
            isPublic: Boolean(
              Reflect.getMetadata(IS_PUBLIC_KEY, handler) ??
              Reflect.getMetadata(IS_PUBLIC_KEY, type),
            ),
          });
        }
      }
    }
    return found;
  };

  it('finds the routes of the app, or this test would prove nothing', () => {
    expect(routes().length).toBeGreaterThan(80);
  });

  it('gives every route that works on a workspace an action, so a new route is closed to an assistant until someone decides', () => {
    const unguarded = routes()
      .filter((r) => !r.isPublic && !isExempt(r.controller, r.method))
      .filter((r) => !r.action)
      .map((r) => `${r.controller}.${r.method}`);

    expect(unguarded).toEqual([]);
  });

  it('does not name an action on a public route, where nobody is signed in to be judged', () => {
    const odd = routes()
      .filter((r) => r.isPublic && r.action)
      .map((r) => `${r.controller}.${r.method}`);

    expect(odd).toEqual([]);
  });
});
