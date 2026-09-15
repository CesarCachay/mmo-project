import { describe, expect, it } from 'vitest';

import { HealthController } from '../health.controller';

describe('HealthController', () => {
  it('returns healthy status', () => {
    const controller = new HealthController();

    expect(controller.getHealth()).toEqual({
      status: 'ok',
    });
  });
});
