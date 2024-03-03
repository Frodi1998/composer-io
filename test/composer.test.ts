import { Mock, beforeEach, describe, expect, it, vi } from 'vitest';
import { Composer, Middleware, NextMiddleware, UnknownObject } from '../src';
import { BoundaryError } from '../src/error';
import { Context } from './types';

/**
 * Delay N-ms
 *
 * @param {Number} delayed
 *
 * @return {Promise}
 */
const delay = (delayed: number): Promise<void> =>
  new Promise((resolve): void => {
    setTimeout(resolve, delayed);
  });

describe('Composer', () => {
  const ctx: Context = { message: { text: 'test' } };
  let composer: Composer<Context>;

  const next = () => Promise.resolve();
  let middleware: Mock<[_ctx: UnknownObject], void>;
  const exec = (c = ctx) => composer.middleware(c, next);

  beforeEach(() => {
    composer = new Composer();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    middleware = vi.fn(_ctx => {});
  });

  it('should call handlers', async () => {
    composer.use(middleware);
    await exec();
    // composer.run(ctx);
    expect(middleware.mock.calls[0][0]).toMatchObject(ctx);
  });

  it('should work with 0 middleware', async (): Promise<void> => {
    const composer = new Composer();

    await composer.run({});
  });

  it('should call constructor handlers', async () => {
    composer = new Composer<Context>(middleware);
    await exec();
    expect(middleware.mock.calls[0][0]).toMatchObject(ctx);
  });

  it('should create new instance of the Composer class', (): void => {
    const composer = Composer.builder<{ test: 'test' }>();

    composer.use(context => {
      if (context.test === 'test') {
        // ...
      }
    });

    expect(composer).toBeInstanceOf(Composer);
  });

  it('should throw if next() is called multiple times', async (): Promise<void> => {
    composer.use(async (_ctx, next): Promise<void> => {
      await next();
    });

    composer.use(async (_ctx, next): Promise<void> => {
      await next();
      await next();
    });

    composer.use(async (_ctx, next): Promise<void> => {
      await next();
    });

    try {
      await exec();
    } catch (e) {
      expect((e as Error).message).toEqual(
        expect.stringMatching('multiple times'),
      );

      return;
    }

    throw new Error('next() called multiple times');
  });

  it('should prevent next from being called more than once', async () => {
    let first = true;
    const com = new Composer();
    com.use(
      async (_, next) => {
        await next();
        await expect(next()).rejects.toThrow('next() called multiple times');
      },
      () => {
        if (first) first = false;
        else throw new Error('failed!');
      },
    );
    composer.use(com);
    await exec();
  });

  describe('.clone', () => {
    it('composer should be cloned', async (): Promise<void> => {
      type CloneContext = {
        baseValue?: boolean;
        value: 'first' | 'second' | 'default';
      };

      const baseComposer = new Composer<CloneContext>();

      baseComposer.use((context, next) => {
        context.baseValue = true;

        return next();
      });

      const firstComposer = baseComposer.clone();
      const secondComposer = baseComposer.clone();

      firstComposer.use((context, next) => {
        context.value = 'first';

        return next();
      });

      secondComposer.use((context, next) => {
        context.value = 'second';

        return next();
      });

      const baseContext = { value: 'default' } as CloneContext;
      const firstContext = { value: 'default' } as CloneContext;
      const secondContext = { value: 'default' } as CloneContext;

      await baseComposer.run(baseContext);
      await firstComposer.run(firstContext);
      await secondComposer.run(secondContext);

      expect(baseContext).toMatchObject({
        baseValue: true,
        value: 'default',
      });

      expect(firstContext).toMatchObject({
        baseValue: true,
        value: 'first',
      });

      expect(secondContext).toMatchObject({
        baseValue: true,
        value: 'second',
      });
    });
  });

  describe('.use', () => {
    it('should work', async (): Promise<void> => {
      const out: number[] = [];

      composer.use(async (_ctx, next): Promise<void> => {
        out.push(1);

        await delay(1);
        await next();
        await delay(1);

        out.push(6);
      });

      composer.use(async (_ctx, next): Promise<void> => {
        out.push(2);

        await delay(1);
        await next();
        await delay(1);

        out.push(5);
      });

      composer.use(async (_ctx, next): Promise<void> => {
        out.push(3);

        await delay(1);
        await next();
        await delay(1);

        out.push(4);
      });

      await exec();

      expect(out).toEqual(expect.arrayContaining([1, 2, 3, 4, 5, 6]));
    });

    it('should keep the context', async (): Promise<void> => {
      const context = {};

      const composer = new Composer();

      composer.use(async (ctx, next): Promise<void> => {
        await next();

        expect(ctx).toBe(context);
      });

      composer.use(async (ctx, next): Promise<void> => {
        await next();

        expect(ctx).toBe(context);
      });

      composer.use(async (ctx, next): Promise<void> => {
        await next();

        expect(ctx).toBe(context);
      });

      await composer.run(context);
    });

    it('should work with multiple handlers', async () => {
      composer.use(
        (_, next) => next(),
        (_, next) => next(),
        middleware,
      );
      await exec();
      expect(middleware.mock.calls[0][0]).toMatchObject(ctx);
    });

    it('should with multiple handlers in different calls', async () => {
      composer.use(
        (_, next) => next(),
        (_, next) => next(),
      );
      composer.use(
        (_, next) => next(),
        (_, next) => next(),
      );
      composer.use(
        (_, next) => next(),
        (_, next) => next(),
        middleware,
      );
      await exec();
      expect(middleware.mock.calls[0][0]).toMatchObject(ctx);
    });

    it('should call sub-trees', async () => {
      const sub = composer.use((_, next) => next());

      expect(sub).toBeInstanceOf(Composer);
      sub.use((_, next) => next());
      sub.use((_, next) => next(), middleware);
      await exec();
      expect(middleware.mock.calls[0][0]).toMatchObject(ctx);
    });

    it('should allow errors to bubble up', async () => {
      try {
        composer
          .use((_, next) => {
            next();
          })
          .use(
            (_, next) => next(),
            () => {
              throw Error('evil');
            },
          );

        await composer.middleware(ctx, next);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('evil');
      }
    });
  });

  describe('.tap', () => {
    it('should tap into middleware execution', async () => {
      // Создаем композер
      const composer = new Composer();

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const middleware1 = vi.fn().mockImplementation(_ctx => {});
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const middleware2 = vi.fn().mockImplementation(_ctx => {});

      // Используем метод tap с фиктивными middleware
      composer.tap(middleware1, middleware2);

      // Создаем фиктивный контекст
      const ctx = {};

      // Запускаем композер
      await composer.run(ctx);

      // Проверяем, что middleware были вызваны
      expect(middleware1.mock.calls[0][0]).toMatchObject(ctx);
      expect(middleware2.mock.calls[0][0]).toMatchObject(ctx);
    });

    it('should return a new composer instance', () => {
      // Создаем композер
      const composer = new Composer();

      // Фиктивные middleware для тестирования
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const middleware1 = vi.fn().mockImplementation(_ctx => {});

      // Используем метод tap с фиктивным middleware
      const newComposer = composer.tap(middleware1);

      // Проверяем, что вернулся новый экземпляр композера
      expect(newComposer).toBeInstanceOf(Composer);
      // Проверяем, что метод tap не изменил исходный композер
      expect(newComposer).not.toBe(composer);
    });
  });

  describe('.fork', () => {
    it('should call downstream and passed middleware', async () => {
      composer.fork(middleware);
      composer.use(middleware);
      await exec();
      expect(middleware.mock.calls.length).toBe(2);
    });
    it('should call middleware concurrently', async () => {
      let seq = '';
      // eslint-disable-next-line no-promise-executor-return
      const tick = () => new Promise(r => setTimeout(r));
      composer
        .fork(async (_ctx, next) => {
          seq += '0'; // 2
          await tick();
          seq += '1'; // 4
          await next();
        })
        .use(async () => {
          seq += '2'; // 5
          await tick();
          seq += '3'; // 7
        });
      composer.use(async () => {
        seq += 'a'; // 1
        await tick();
        seq += 'b'; // 3
        await tick();
        seq += 'c'; // 6
        await tick();
        seq += 'd'; // 8
      });
      await exec();
      expect(seq).toBe('a0b12c3d');
    });
  });

  describe('.lazy', () => {
    it('should run lazily created middleware', async () => {
      composer.lazy(c => {
        expect(c).toBe(ctx);
        return middleware;
      });
      await exec();
      expect(middleware.mock.calls.length).toBe(1);
    });
    it('should run lazily created middleware arrays', async () => {
      composer.lazy(() => [
        new Composer(),
        new Composer().middleware,
        middleware,
      ]);
      await exec();
      expect(middleware.mock.calls.length).toBe(1);
    });
  });

  describe('.route', () => {
    const nope = () => {
      throw new Error('nope');
    };
    const base = { a: nope, b: nope };
    it('should route context objects', async () => {
      composer.route(
        c => {
          expect(c).toBe(ctx);
          return 'key';
        },
        { ...base, key: middleware },
      );
      await exec();
      expect(middleware.mock.calls.length).toBe(1);
    });
    it('should support a fallback route', async () => {
      composer.route(() => 'nope' as 'a', base, middleware);
      await exec();
      expect(middleware.mock.calls.length).toBe(1);
    });
  });

  describe('.branch', () => {
    it('should branch based on a predicate', async () => {
      let count = 0;
      let l = 0;
      let r = 0;
      composer.branch(
        c => {
          expect(c).toBe(ctx);
          return count++ % 2 === 0;
        },
        () => l++,
        () => r++,
      );
      for (let i = 0; i < 9; i++) await exec();
      expect(l).toBe(5);
      expect(r).toBe(4);
    });
  });

  describe('.filter', () => {
    const t = () => true;
    const f = () => false;
    it('should check filters', async () => {
      composer.filter(f, middleware);
      composer.filter(t, middleware);
      await exec();
      expect(middleware.mock.calls.length).toBe(1);
      expect(middleware.mock.calls[0][0]).toMatchObject(ctx);
    });

    it('should allow chaining filters', async () => {
      composer.filter(t).filter(f, middleware); // nope
      composer.filter(f).filter(t, middleware); // nope
      composer.filter(t).filter(t, middleware);
      await exec();
      expect(middleware.mock.calls.length).toBe(1);
      expect(middleware.mock.calls[0][0]).toMatchObject(ctx);
    });
  });

  describe('.drop', () => {
    const t = () => true;
    const f = () => false;
    it('should allow to drop', async () => {
      composer.drop(t, middleware);
      composer.drop(f, middleware);
      await exec();
      expect(middleware.mock.calls.length).toBe(1);
      expect(middleware.mock.calls[0][0]).toMatchObject(ctx);
    });
    it('should allow chaining drop calls', async () => {
      composer.drop(t).drop(t, middleware);
      composer.drop(t).drop(f, middleware); // nope
      composer.drop(f).drop(t, middleware); // nope
      await exec();
      expect(middleware.mock.calls.length).toBe(1);
      expect(middleware.mock.calls[0][0]).toMatchObject(ctx);
    });
  });

  describe('.before', () => {
    it('should add middleware to execute before other middleware', async () => {
      const out: string[] = [];
      const beforeMiddleware = vi.fn((ctx: Context, next: NextMiddleware) => {
        out.push('before');
        return next();
      });
      const otherMiddleware = vi.fn((ctx: Context, next: NextMiddleware) => {
        out.push('other');
        return next();
      });

      composer.before(beforeMiddleware, otherMiddleware);

      await exec();
      expect(out).toEqual(expect.arrayContaining(['before', 'other']));
      expect(beforeMiddleware).toHaveBeenCalled();
      expect(otherMiddleware).toHaveBeenCalled();
    });
  });

  describe('.after', () => {
    it('should add middleware to execute after other middleware', async () => {
      const out: string[] = [];
      const afterMiddleware = vi.fn((ctx: Context, next: NextMiddleware) => {
        out.push('after');
        return next();
      });
      const otherMiddleware = vi.fn((ctx: Context, next: NextMiddleware) => {
        out.push('other');
        return next();
      });

      composer.after(afterMiddleware, otherMiddleware);

      await exec();
      expect(out).toEqual(expect.arrayContaining(['other', 'after']));
      expect(afterMiddleware).toHaveBeenCalled();
      expect(otherMiddleware).toHaveBeenCalled();
    });
  });

  describe('.enforce', () => {
    it('should add middleware to all middleware types', async () => {
      const out: string[] = [];
      const beforeMiddleware = vi.fn((ctx: Context, next: NextMiddleware) => {
        out.push('before');
        return next();
      });
      const otherMiddleware = vi.fn((ctx: Context, next: NextMiddleware) => {
        out.push('other');
        return next();
      });

      const afterMiddleware = vi.fn((ctx: Context, next: NextMiddleware) => {
        out.push('after');
        return next();
      });

      composer.enforce(
        [beforeMiddleware],
        [otherMiddleware],
        [afterMiddleware],
      );

      await exec();
      expect(out).toEqual(expect.arrayContaining(['before', 'other', 'after']));
      expect(beforeMiddleware).toHaveBeenCalled();
      expect(afterMiddleware).toHaveBeenCalled();
      expect(otherMiddleware).toHaveBeenCalled();
    });

    it('should add middleware arrays to all middleware types', () => {
      const out: number[] = [];
      const beforeMiddlewares: Middleware<Context>[] = [
        async (_, next) => {
          out.push(1); // Добавляем число 1, так как это первый middleware в массиве beforeMiddlewares
          await next();
        },
        async (_, next) => {
          out.push(2); // Добавляем число 2, так как это второй middleware в массиве beforeMiddlewares
          await next();
        },
      ];
      const otherMiddlewares: Middleware<Context>[] = [
        async (_, next) => {
          out.push(3); // Добавляем число 3, так как это первый middleware в массиве otherMiddlewares
          await next();
        },
        async (_, next) => {
          out.push(4); // Добавляем число 4, так как это второй middleware в массиве otherMiddlewares
          await next();
        },
      ];
      const afterMiddlewares: Middleware<Context>[] = [
        async (_, next) => {
          out.push(5); // Добавляем число 5, так как это первый middleware в массиве afterMiddlewares
          await next();
        },
        async (_, next) => {
          out.push(6); // Добавляем число 6, так как это второй middleware в массиве afterMiddlewares
          await next();
        },
      ];

      composer.enforce(beforeMiddlewares, otherMiddlewares, afterMiddlewares);

      exec();
      expect(out).toEqual([1, 2, 3, 4, 5, 6]);
    });
  });

  describe('.caught', () => {
    it('should catch errors from passed middleware', async () => {
      const err = new Error('damn');
      const handler = vi.fn((_ctx: Context, error: Error) => {
        expect(error).toBeInstanceOf(Error);
        expect(error).equal(err);
        expect(error.message).toBe('damn');
      });

      composer.caught(handler);
      composer.use(() => {
        throw err;
      });
      await exec();
      expect(handler.mock.calls.length).toBe(1);
    });
    it('should catch errors from child middleware', async () => {
      const err = new Error('damn');
      const handler = vi.fn((_ctx: Context, error: Error) => {
        expect(error).toBeInstanceOf(Error);
        expect(error).equal(err);
        expect(error.message).toBe('damn');
      });
      composer.caught(handler).use(() => {
        throw err;
      });
      await exec();
      expect(handler.mock.calls.length).toBe(1);
    });
    it('should not touch downstream errors', async () => {
      const err = new Error('yay');
      const handler = vi.fn(() => {});
      composer.caught(handler);
      composer.use(() => {
        throw err;
      });

      (exec() as Promise<unknown>).catch(error => {
        expect(error).toBeInstanceOf(Error);
        expect(error).equal(err);
        expect(error.message).toBe('yay');
      });

      expect(handler.mock.calls.length).toBe(1);
    });
  });

  describe('.errorBoundary', () => {
    it('should catch errors from passed middleware', async () => {
      const err = new Error('damn');
      const handler = vi.fn((e: BoundaryError<Context>) => {
        expect(e).toBeInstanceOf(BoundaryError);
        expect(e.error).equal(err);
        expect(e.message).toMatchSnapshot(err.message);
        expect(e.ctx).toMatchObject(ctx);
      });
      composer.errorBoundary(handler, () => {
        throw err;
      });
      await exec();
      expect(handler.mock.calls.length).toBe(1);
    });
    it('should catch errors from child middleware', async () => {
      const err = new Error('damn');
      const handler = vi.fn(
        (e: BoundaryError<Context>, next: NextMiddleware) => {
          expect(e).toBeInstanceOf(BoundaryError);
          expect(e.error).equal(err);
          expect(e.message).toMatchSnapshot(err.message);
          expect(e.context).toMatchObject(ctx);
          return next();
        },
      );

      composer.errorBoundary(handler).use(() => {
        throw err;
      });

      await exec();
      expect(handler.mock.calls.length).toBe(1);
    });
    it('should not touch downstream errors', async () => {
      const err = new Error('yay');
      const handler = vi.fn(() => {});
      composer.errorBoundary(handler);
      composer.use(() => {
        throw err;
      });

      (exec() as Promise<unknown>).catch(error => {
        expect(error).toBeInstanceOf(Error);
        expect(error).equal(err);
        expect(error.message).toBe('yay');
      });

      expect(handler.mock.calls.length).toBe(0);
    });
    it('should support passing on the control flow via next', async () => {
      const err = new Error('damn');
      composer
        .errorBoundary((_e, next) => next())
        .use(() => {
          throw err;
        });
      composer.use(middleware);
      await exec();
      expect(middleware.mock.calls.length).toBe(1);
      expect(middleware.mock.calls[0][0]).toMatchObject(ctx);
    });
  });

  describe('.concurrency', () => {
    it('should add concurrency middleware to the chain', async () => {
      const composer = new Composer();
      const middleware1 = vi.fn().mockResolvedValue(undefined);
      const middleware2 = vi.fn().mockResolvedValue(undefined);
      const middleware3 = vi.fn().mockResolvedValue(undefined);

      composer.concurrency([middleware1, middleware2, middleware3]);

      await composer.run({});

      expect(middleware1).toHaveBeenCalled();
      expect(middleware2).toHaveBeenCalled();
      expect(middleware3).toHaveBeenCalled();
    });
  });

  describe('.enter', () => {
    it('should enter another composer and use its middleware', async () => {
      // Создаем родительский и дочерний композеры
      const parentComposer = new Composer();
      const childComposer = new Composer();

      const middleware = vi.fn().mockResolvedValue(undefined);
      childComposer.use(middleware);

      childComposer.enter(parentComposer);

      // Запускаем родительский композер
      const ctx = {};
      await parentComposer.run(ctx);

      expect(middleware).toHaveBeenCalled();
      expect(middleware.mock.calls[0][0]).toMatchObject(ctx);
    });
  });

  describe('.run', () => {
    it('should run middleware', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const middleware = vi.fn(_ctx => {});
      composer.use(middleware);
      await composer.run(ctx);

      expect(middleware).toHaveBeenCalled();
      expect(middleware.mock.calls[0][0]).toMatchObject(ctx);
    });
  });
});
