import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';

const check = async (query: Record<string, unknown>) => {
  const instance = plainToInstance(PaginationQueryDto, query);
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { instance, fields: errors.map((error) => error.property) };
};

describe('PaginationQueryDto', () => {
  it('needs nothing: the defaults are the handler’s', async () => {
    const { instance, fields } = await check({});

    expect(fields).toEqual([]);
    expect(instance.page).toBeUndefined();
    expect(instance.limit).toBeUndefined();
  });

  it('reads the numbers a query string carries as text', async () => {
    const { instance, fields } = await check({ page: '3', limit: '50' });

    expect(fields).toEqual([]);
    expect(instance).toMatchObject({ page: 3, limit: 50 });
  });

  it.each(['1', '100'])('accepts a limit of %s', async (limit) => {
    expect((await check({ limit })).fields).toEqual([]);
  });

  it.each([
    ['page', '0'],
    ['page', '-1'],
    ['page', '1.5'],
    ['page', 'two'],
    ['limit', '0'],
    ['limit', '101'],
    ['limit', '2.5'],
    ['limit', 'many'],
  ])('refuses %s = %s', async (field, value) => {
    expect((await check({ [field]: value })).fields).toContain(field);
  });

  it('refuses a query it does not know', async () => {
    expect((await check({ offset: '10' })).fields).toContain('offset');
  });
});
