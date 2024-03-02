import type {
  BranchMiddlewareCondition,
  LazyMiddlewareFactory,
  MaybeArray,
  Middleware,
  MiddlewareFn,
  MiddlewareReturn,
  NextMiddleware,
  UnknownObject,
} from './types';

import { compose } from './compose';
import { flattenMiddleware, noopNext, wrapMiddlewareNextCall } from './helpers';

/**
 * Call `next()` in middleware
 */
export const skipMiddleware = <T>(
  _ctx: T,
  next: NextMiddleware,
): Promise<MiddlewareReturn> => next();

/**
 * Does not call `next()` in middleware
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const stopMiddleware = <T>(_сtx: T, _next: NextMiddleware) =>
  Promise.resolve();

/**
 * Lazily asynchronously gets middleware
 *
 * Example:
 *
 * ```ts
 * getLazyMiddleware(async (context) => {
 *   const route = await getSomeRoute(context.path) // Promise<Function>;
 *
 *   return route;
 * });
 * ```
 */
export const getLazyMiddleware = <T extends UnknownObject>(
  factory: LazyMiddlewareFactory<T>,
): MiddlewareFn<T> => {
  return async (ctx, next) => {
    const middleware = await factory(ctx);
    const arr = Array.isArray(middleware) ? middleware : [middleware];
    await compose(...arr.map(flattenMiddleware))(ctx, next);
  };
};

/**
 *
 * @param middleware
 * @returns
 */
// export const getTapMiddleware =
//   <T extends UnknownObject>(middleware: Middleware<T>): Middleware<T> =>
//   async (context: T, next: NextMiddleware): Promise<NextMiddlewareReturn> => {
//     await flattenMiddleware(middleware)(context, noopNext);

//     return next();
//   };

export const getTapMiddleware =
  <C extends UnknownObject>(middleware: Middleware<C>) =>
  async (context: C, next: NextMiddleware) => {
    await flattenMiddleware(middleware)(context, noopNext);

    return next();
  };

/**
 * Runs the middleware at the next event loop and force call `next()`
 *
 * Example:
 *
 * ```ts
 * getForkMiddleware((context) => {
 *   statisticsMiddlewares(context).catch(console.error);
 * });
 * ```
 */
// export const getForkMiddleware =
//   <T>(middleware: MiddlewareFn<T>) =>
//   (ctx: T, next: NextMiddleware): Promise<NextMiddlewareReturn> => {
//     // setImmediate(middleware, ctx, noopNext);

//     return Promise.all([next(), middleware(ctx, noopNext)]);
//   };

/**
 *
 * @param condition
 * @param trueMiddleware
 * @param falseMiddleware
 * @returns
 */
export const getBranchMiddleware = <T extends UnknownObject>(
  condition: BranchMiddlewareCondition<T>,

  trueMiddleware: MaybeArray<Middleware<T>>,
  falseMiddleware: MaybeArray<Middleware<T>>,
) => {
  return async (ctx: T) => {
    if (typeof condition !== 'function') {
      return condition ? trueMiddleware : falseMiddleware;
    }

    return (await condition(ctx)) ? trueMiddleware : falseMiddleware;
  };
};

/**
 * Runs the second middleware before the main
 *
 * Example:
 *
 * ```ts
 * getBeforeMiddleware(
 *   myMockMiddleware,
 *   ouputUserData
 * );
 * ```
 */
export const getBeforeMiddleware =
  <T extends UnknownObject>(
    beforeMiddlewares: Middleware<T>[],
    middlewares: Middleware<T>[],
  ): Middleware<T> =>
  async (context: T, next: NextMiddleware) => {
    const called = beforeMiddlewares.every(async beforeMiddleware =>
      wrapMiddlewareNextCall(context, flattenMiddleware(beforeMiddleware)),
    );

    if (called) {
      const middleware = compose(...middlewares.map(flattenMiddleware));
      return middleware(context, next);
    }
  };

/**
 * Runs the second middleware after the main
 *
 * Example:
 *
 * ```ts
 * getAfterMiddleware(
 *   sendSecureData,
 *   clearSecurityData
 * );
 * ```
 */
export const getAfterMiddleware =
  <T extends UnknownObject>(
    middlewares: Middleware<T>[],
    afterMiddlewares: Middleware<T>[],
  ): Middleware<T> =>
  async (context: T, next: NextMiddleware): Promise<MiddlewareReturn> => {
    const called = middlewares.every(async middleware =>
      wrapMiddlewareNextCall(context, flattenMiddleware(middleware)),
    );

    if (called) {
      const afterMiddleware = compose(
        ...afterMiddlewares.map(flattenMiddleware),
      );
      return afterMiddleware(context, next);
    }
  };

/**
 * Runs middleware before and after the main
 *
 * Example:
 *
 * ```ts
 * getEnforceMiddleware(
 *   prepareData,
 *   sendData,
 *   clearData
 * );
 */
export const getEnforceMiddleware =
  <T extends UnknownObject>(
    beforeMiddlewares: Middleware<T>[],
    middlewares: Middleware<T>[],
    afterMiddlewares: Middleware<T>[],
  ): Middleware<T> =>
  async (context: T, next: NextMiddleware): Promise<MiddlewareReturn> => {
    const allMiddlewares = [
      ...beforeMiddlewares.map(flattenMiddleware),
      ...middlewares.map(flattenMiddleware),
      ...afterMiddlewares.map(flattenMiddleware),
    ];

    return compose(...allMiddlewares)(context, next);
  };

/**
 * Concurrently launches middleware,
 * the chain will continue if `next()` is called in all middlewares
 *
 * **Warning: Error interrupts all others**
 *
 * Example:
 *
 * ```ts
 * getConcurrencyMiddleware(
 *   initializeUser,
 *   initializeSession,
 *   initializeDatabase
 * );
 * ```
 */
export const getConcurrencyMiddleware =
  <T extends UnknownObject>(middlewares: Middleware<T>[]): Middleware<T> =>
  // eslint-disable-next-line consistent-return
  async (context: T, next: NextMiddleware): Promise<MiddlewareReturn> => {
    const concurrencies = await Promise.all(
      middlewares.map(
        (middleware): Promise<boolean> =>
          wrapMiddlewareNextCall(context, flattenMiddleware(middleware)),
      ),
    );

    if (concurrencies.every(Boolean)) {
      return next();
    }
  };
