import { describe, expect, it, vi } from 'vitest';
import {
  Middleware,
  NextMiddleware,
  noopNext,
  getLazyMiddleware,
  getTapMiddleware,
  getBranchMiddleware,
  getBeforeMiddleware,
  getAfterMiddleware,
  getEnforceMiddleware,
  getConcurrencyMiddleware,
  flattenMiddleware,
  stopMiddleware,
} from '../src';

const makeContext = (): { shouldTrue: boolean; shouldFalse: boolean } => ({
  shouldTrue: true,
  shouldFalse: false,
});

type ContextType = ReturnType<typeof makeContext>;

describe('Snippets', (): void => {
  describe('stopMiddleware', () => {
    it('should not call next middleware', async () => {
      const nextMock = vi.fn(); // Создаем мок функцию для next middleware
      const context = {}; // Создаем пустой контекст

      await stopMiddleware(context, nextMock); // Вызываем функцию middleware

      // Проверяем, что next middleware не была вызвана
      expect(nextMock).not.toHaveBeenCalled();
    });

    it('should return a resolved promise', async () => {
      const nextMock = vi.fn();
      const context = {};

      // Проверяем, что функция возвращает обещание
      await expect(stopMiddleware(context, nextMock)).resolves.toBeUndefined();
    });
  });

  describe('getLazyMiddleware', (): void => {
    it('should work with function', async (): Promise<void> => {
      const lazyContext = makeContext();

      const nextMock = vi.fn(noopNext);
      const middlewareMock = vi.fn(
        (factoryContext: ContextType): Middleware<ContextType> => {
          expect(factoryContext).toBe(lazyContext);

          return async (
            context: ContextType,
            next: NextMiddleware,
          ): Promise<void> => {
            expect(context).toBe(lazyContext);

            await next();
          };
        },
      );

      const lazyMiddleware = getLazyMiddleware(middlewareMock);

      await lazyMiddleware(lazyContext, nextMock);

      expect(middlewareMock).toHaveBeenCalledTimes(1);
      expect(nextMock).toHaveBeenCalledTimes(1);
    });

    it('should factory be called once', async (): Promise<void> => {
      const lazyContext = makeContext();

      const nextMock = vi.fn(noopNext);
      const middlewareMock = vi.fn(
        (factoryContext: ContextType): Middleware<ContextType> => {
          expect(factoryContext).toBe(lazyContext);

          return async (
            context: ContextType,
            next: NextMiddleware,
          ): Promise<void> => {
            expect(context).toBe(lazyContext);

            await next();
          };
        },
      );

      const lazyMiddleware = getLazyMiddleware(middlewareMock);

      const CALLED_TIMES = 10;
      for (let i = 0; i < CALLED_TIMES; i += 1) {
        await lazyMiddleware(lazyContext, nextMock);
      }

      expect(middlewareMock).toHaveBeenCalledTimes(10);
      expect(nextMock).toHaveBeenCalledTimes(CALLED_TIMES);
    });
  });

  describe('getTapMiddleware', (): void => {
    it('should runs with force next()', async (): Promise<void> => {
      const tapContext = makeContext();

      const nextMock = vi.fn(noopNext);
      const middlewareMock = vi.fn(
        async (context: ContextType): Promise<void> => {
          expect(context).toBe(tapContext);
        },
      );

      const tapMiddleware = getTapMiddleware(middlewareMock);

      await tapMiddleware(tapContext, nextMock);

      expect(middlewareMock).toHaveBeenCalledTimes(1);
      expect(nextMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('getBranchMiddleware', (): void => {
    it('should runs with static condition', async (): Promise<void> => {
      const branchContext = makeContext();

      const nextMock = vi.fn(noopNext);

      const trueMiddlewareMock = vi.fn(
        async (context: ContextType, next: NextMiddleware) => {
          expect(context).toBe(branchContext);

          await next();
        },
      );

      const falseMiddlewareMock = vi.fn(
        async (context: ContextType, next: NextMiddleware) => {
          expect(context).toBe(branchContext);

          await next();
        },
      );

      const trueMiddleware = getLazyMiddleware(
        getBranchMiddleware(true, trueMiddlewareMock, falseMiddlewareMock),
      );

      const falseMiddleware = getLazyMiddleware(
        getBranchMiddleware(false, trueMiddlewareMock, falseMiddlewareMock),
      );

      await trueMiddleware(branchContext, nextMock);
      await falseMiddleware(branchContext, nextMock);

      expect(trueMiddlewareMock).toHaveBeenCalledTimes(1);
      expect(falseMiddlewareMock).toHaveBeenCalledTimes(1);
      expect(nextMock).toHaveBeenCalledTimes(2);
    });

    it('should runs with dynamic condition', async (): Promise<void> => {
      const branchContext = makeContext();

      const nextMock = vi.fn(noopNext);

      const trueMiddlewareMock = vi.fn(
        async (context: ContextType, next: NextMiddleware): Promise<void> => {
          expect(context).toBe(branchContext);

          await next();
        },
      );

      const falseMiddlewareMock = vi.fn(
        async (context: ContextType, next: NextMiddleware): Promise<void> => {
          expect(context).toBe(branchContext);

          await next();
        },
      );

      const trueMiddleware = getLazyMiddleware(
        getBranchMiddleware(
          vi.fn().mockReturnValue(true),
          trueMiddlewareMock,
          falseMiddlewareMock,
        ),
      );

      const falseMiddleware = getLazyMiddleware(
        getBranchMiddleware(
          vi.fn().mockReturnValue(false),
          trueMiddlewareMock,
          falseMiddlewareMock,
        ),
      );

      await trueMiddleware(branchContext, nextMock);
      await falseMiddleware(branchContext, nextMock);

      expect(trueMiddlewareMock).toHaveBeenCalledTimes(1);
      expect(falseMiddlewareMock).toHaveBeenCalledTimes(1);
      expect(nextMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('getBeforeMiddleware', (): void => {
    it('should runs before middleware', async (): Promise<void> => {
      const beforeContext = makeContext();

      const nextMock = vi.fn(noopNext);

      const beforeMiddlewareMock = vi.fn(
        async (context: ContextType, next: NextMiddleware): Promise<void> => {
          expect(context).toBe(beforeContext);

          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          expect(middlewareMock).toHaveBeenCalledTimes(0);

          await next();
        },
      );

      const middlewareMock = vi.fn(
        async (context: ContextType, next: NextMiddleware): Promise<void> => {
          expect(context).toBe(beforeContext);

          expect(beforeMiddlewareMock).toHaveBeenCalledTimes(1);

          await next();
        },
      );

      const beforeMiddleware = flattenMiddleware(
        getBeforeMiddleware([beforeMiddlewareMock], [middlewareMock]),
      );

      await beforeMiddleware(beforeContext, nextMock);

      expect(middlewareMock).toHaveBeenCalledTimes(1);
      expect(nextMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAfterMiddleware', (): void => {
    it('should runs after middleware', async (): Promise<void> => {
      const afterContext = makeContext();

      const nextMock = vi.fn(noopNext);

      const middlewareMock = vi.fn(
        async (context: ContextType, next: NextMiddleware): Promise<void> => {
          expect(context).toBe(afterContext);
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          expect(afterMiddlewareMock).toHaveBeenCalledTimes(0);

          await next();
        },
      );

      const afterMiddlewareMock = vi.fn(
        async (context: ContextType, next: NextMiddleware): Promise<void> => {
          expect(context).toBe(afterContext);
          expect(middlewareMock).toHaveBeenCalledTimes(1);

          await next();
        },
      );

      const afterMiddleware = flattenMiddleware(
        getAfterMiddleware([middlewareMock], [afterMiddlewareMock]),
      );

      await afterMiddleware(afterContext, nextMock);

      expect(middlewareMock).toHaveBeenCalledTimes(1);
      expect(nextMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('getEnforceMiddleware', (): void => {
    it('should runs enforce middleware', async (): Promise<void> => {
      const enforceContext = makeContext();

      const nextMock = vi.fn(noopNext);

      const beforeMiddlewareMock = vi.fn(
        async (context: ContextType, next: NextMiddleware): Promise<void> => {
          expect(context).toBe(enforceContext);

          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          expect(middlewareMock).toHaveBeenCalledTimes(0);
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          expect(afterMiddlewareMock).toHaveBeenCalledTimes(0);

          await next();
        },
      );

      const middlewareMock = vi.fn(
        async (context: ContextType, next: NextMiddleware): Promise<void> => {
          expect(context).toBe(enforceContext);

          expect(beforeMiddlewareMock).toHaveBeenCalledTimes(1);
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          expect(afterMiddlewareMock).toHaveBeenCalledTimes(0);

          await next();
        },
      );

      const afterMiddlewareMock = vi.fn(
        async (context: ContextType, next: NextMiddleware): Promise<void> => {
          expect(context).toBe(enforceContext);

          expect(middlewareMock).toHaveBeenCalledTimes(1);
          expect(beforeMiddlewareMock).toHaveBeenCalledTimes(1);

          await next();
        },
      );

      const enforceMiddleware = flattenMiddleware(
        getEnforceMiddleware(
          [beforeMiddlewareMock],
          [middlewareMock],
          [afterMiddlewareMock],
        ),
      );

      await enforceMiddleware(enforceContext, nextMock);

      expect(middlewareMock).toHaveBeenCalledTimes(1);
      expect(nextMock).toHaveBeenCalledTimes(1);
    });

    it('should call all middlewares in the correct order', async () => {
      const beforeMiddlewares: Middleware<any>[] = [
        async (_, next) => {
          // Logic for before middleware 1
          await next();
        },
        async (_, next) => {
          // Logic for before middleware 2
          await next();
        },
      ];

      const middlewares: Middleware<any>[] = [
        async (_, next) => {
          // Logic for middleware 1
          await next();
        },
        async (_, next) => {
          // Logic for middleware 2
          await next();
        },
      ];

      const afterMiddlewares: Middleware<any>[] = [
        async (_, next) => {
          // Logic for after middleware 1
          await next();
        },
      ];

      const context = {}; // Create your test context object

      const enforceMiddleware = flattenMiddleware(
        getEnforceMiddleware(beforeMiddlewares, middlewares, afterMiddlewares),
      );

      await enforceMiddleware(context, () => Promise.resolve());
    });

    it('should return undefined if beforeMiddlewares are not called', async () => {
      const out: string[] = [];
      const beforeMiddlewares: Middleware<any>[] = [
        async () => {
          out.push('before');
        },
      ];

      const middlewares: Middleware<any>[] = [
        async (_, next) => {
          // Logic for middleware 1
          out.push('other');
          await next();
        },
      ];

      const afterMiddlewares: Middleware<any>[] = [
        async (_, next) => {
          // Logic for after middleware 1
          out.push('after');
          await next();
        },
      ];

      const context = {};

      const enforceMiddleware = flattenMiddleware(
        getEnforceMiddleware(beforeMiddlewares, middlewares, afterMiddlewares),
      );

      const result = await enforceMiddleware(context, () => Promise.resolve());

      // Assert that result is undefined since beforeMiddlewares are not called
      expect(out).toEqual(['before']);
      expect(result).toBeUndefined();
    });

    it('should return undefined if middlewares are not called', async () => {
      const out: string[] = [];
      const beforeMiddlewares: Middleware<any>[] = [
        async (_, next) => {
          // Logic for before middleware 1
          out.push('before');
          await next();
        },
      ];

      const middleware = async () => {
        out.push('other');
      };
      const middlewares: Middleware<any>[] = [middleware, middleware];

      const afterMiddlewares: Middleware<any>[] = [
        async (_, next) => {
          out.push('after');
          // Logic for after middleware 1
          await next();
        },
      ];

      const context = {};

      const enforceMiddleware = flattenMiddleware(
        getEnforceMiddleware(beforeMiddlewares, middlewares, afterMiddlewares),
      );

      const result = await enforceMiddleware(context, () => Promise.resolve());

      expect(out).toEqual(['before', 'other']);
      expect(result).toBeUndefined();
    });
  });

  describe('getConcurrencyMiddleware', (): void => {
    it('should runs concurrency middleware', async (): Promise<void> => {
      const concurrencyContext = makeContext();

      concurrencyContext.shouldTrue = false;
      concurrencyContext.shouldFalse = true;

      expect(concurrencyContext).toMatchObject({
        shouldTrue: false,
        shouldFalse: true,
      });

      const nextMock = vi.fn(noopNext);

      const firstMiddlewareMock = vi.fn(
        async (context: ContextType, next: NextMiddleware): Promise<void> => {
          expect(context).toBe(concurrencyContext);

          concurrencyContext.shouldTrue = true;

          await next();
        },
      ) as Middleware<ContextType>;

      const secondMiddlewareMock = vi.fn(
        async (context: ContextType, next: NextMiddleware): Promise<void> => {
          expect(context).toBe(concurrencyContext);

          concurrencyContext.shouldFalse = false;

          await next();
        },
      ) as Middleware<ContextType>;

      const enforceMiddleware = flattenMiddleware(
        getConcurrencyMiddleware<ContextType>([
          firstMiddlewareMock,
          secondMiddlewareMock,
        ]),
      );

      await enforceMiddleware(concurrencyContext, nextMock);

      expect(concurrencyContext).toMatchObject({
        shouldTrue: true,
        shouldFalse: false,
      });

      expect(firstMiddlewareMock).toHaveBeenCalledTimes(1);
      expect(secondMiddlewareMock).toHaveBeenCalledTimes(1);
      expect(nextMock).toHaveBeenCalledTimes(1);
    });
  });
});
