import { compose } from './compose';
import { BoundaryError } from './error';
import { flattenMiddleware, noopNext } from './helpers';
import {
  getAfterMiddleware,
  getBeforeMiddleware,
  getBranchMiddleware,
  getConcurrencyMiddleware,
  getEnforceMiddleware,
  getLazyMiddleware,
  getTapMiddleware,
  skipMiddleware,
  stopMiddleware,
} from './snippets';
import {
  BranchMiddlewareCondition,
  CaughtMiddlewareHandler,
  ErrorBoundaryMiddlewareHandler,
  LazyMiddlewareFactory,
  MaybeArray,
  MaybePromise,
  Middleware,
  MiddlewareFn,
  MiddlewareObj,
  NextMiddleware,
  UnknownObject,
} from './types';

/**
 * A flexible middleware composer that allows composing, routing, and managing middleware chains.
 */
export class Composer<C extends UnknownObject> implements MiddlewareObj<C> {
  static builder<Context extends UnknownObject>(...mw: Middleware[]) {
    return new Composer<Context>(...mw);
  }

  protected handler: MiddlewareFn<C>;

  /**
   * Creates an instance of Composer.
   */
  constructor(...middleware: Middleware<C>[]) {
    this.handler =
      middleware.length === 0
        ? skipMiddleware
        : compose(...middleware.map(flattenMiddleware));
  }

  /**
   * Gets the composed middleware function.
   */
  get middleware() {
    return this.handler;
  }

  /**
   * Clones the current composer instance.
   */
  clone(): Composer<C> {
    const composer = new Composer<C>(this.handler);

    // composer.handler = compose(this.handler);

    return composer;
  }

  /**
   * Adds middleware to the chain.
   */
  use(...middleware: Middleware<C>[]): Composer<C> {
    const composer = new Composer(...middleware);
    this.handler = compose(this.handler, composer.middleware);

    return this;
  }

  /**
   * Lazily asynchronously gets middleware.
   */
  lazy(factory: LazyMiddlewareFactory<C>): Composer<C> {
    return this.use(getLazyMiddleware(factory));
  }

  /**
   * Runs the middleware and force call `next()`.
   */
  tap(...middleware: Middleware<C>[]): Composer<C> {
    const composer = new Composer(...middleware.map(getTapMiddleware));
    this.use(composer);

    return composer;
  }

  /**
   * Forks the middleware chain, allowing it to run in parallel with the main chain.
   */
  fork(...middleware: Middleware<C>[]): Composer<C> {
    const composer = new Composer(...middleware);
    this.use((ctx, next) =>
      Promise.all([next(), composer.handler(ctx, noopNext)]),
    );

    return composer;
  }

  /**
   * By condition splits the middleware
   */
  public branch(
    condition: BranchMiddlewareCondition<C>,

    trueMiddleware: MaybeArray<Middleware<C>>,
    falseMiddleware: MaybeArray<Middleware<C>>,
  ): Composer<C> {
    return this.lazy(
      getBranchMiddleware(condition, trueMiddleware, falseMiddleware),
    );
  }

  /**
   * Conditionally runs optional middleware or skips middleware
   */
  filter(
    condition: BranchMiddlewareCondition<C>,
    ...middleware: Middleware<C>[]
  ): Composer<C> {
    const composer = new Composer(...middleware);
    this.branch(condition, composer, skipMiddleware);

    return composer;
  }

  /**
   * Conditionally runs middleware or stops the chain
   */
  drop(
    condition: BranchMiddlewareCondition<C>,
    ...middleware: Middleware<C>[]
  ): Composer<C> {
    const composer = new Composer(...middleware);
    this.branch(condition, composer, stopMiddleware);

    return composer;
  }

  /**
   * ``` ts
   * const composer = new Composer()
   *  const routeHandlers = {
   *      evenUpdates: (ctx: Context) => { ... }
   *      oddUpdates: (ctx: Context) => { ... }
   *    }
   *    // Decide for a context object which one to pick
   *    const router = (ctx: Context) => ctx.update.update_id % 2 === 0
   *      ? 'evenUpdates'
   *      : 'oddUpdates'
   *    // Route it!
   *    composer.route(router, routeHandlers)
   * ```
   */
  route<R extends Record<PropertyKey, Middleware<C>>>(
    router: (ctx: C) => MaybePromise<undefined | keyof R>,
    routeHandlers: R,
    fallback: Middleware<C> = skipMiddleware,
  ): Composer<C> {
    return this.lazy(async ctx => {
      const route = await router(ctx);
      return (
        (route === undefined || !routeHandlers[route]
          ? fallback
          : routeHandlers[route]) ?? []
      );
    });
  }

  /**
   * Adds middleware to be executed before the existing middleware.
   */
  before(
    beforeMiddleware: MaybeArray<Middleware<C>>,
    middleware: MaybeArray<Middleware<C>>,
  ): Composer<C> {
    const beforeMiddlewares = Array.isArray(beforeMiddleware)
      ? beforeMiddleware
      : [beforeMiddleware];
    const middlewares = Array.isArray(middleware) ? middleware : [middleware];

    return this.use(getBeforeMiddleware(beforeMiddlewares, middlewares));
  }

  /**
   * Adds middleware to be executed after the existing middleware.
   */
  after(
    middleware: MaybeArray<Middleware<C>>,
    afterMiddleware: MaybeArray<Middleware<C>>,
  ): Composer<C> {
    const middlewares = Array.isArray(middleware) ? middleware : [middleware];
    const afterMiddlewares = Array.isArray(afterMiddleware)
      ? afterMiddleware
      : [afterMiddleware];

    return this.use(getAfterMiddleware(middlewares, afterMiddlewares));
  }

  /**
   * Enforces the order of middleware execution by interleaving them with before and after middleware.
   */
  enforce(
    beforeMiddleware: Middleware<C>[],
    middleware: Middleware<C>[],
    afterMiddleware: Middleware<C>[],
  ): Composer<C> {
    return this.use(
      getEnforceMiddleware(beforeMiddleware, middleware, afterMiddleware),
    );
  }

  /**
   * Concurrently launches middleware,
   * the chain will continue if `next()` is called in all middlewares
   */
  concurrency(middlewares: Middleware<C>[]): Composer<C> {
    return this.use(getConcurrencyMiddleware(middlewares));
  }

  /**
   * Catches errors in the middleware chain
   */
  caught(errorHandler: CaughtMiddlewareHandler<C>): Composer<C> {
    return this.use(async (ctx, next) => {
      try {
        await next();
      } catch (error) {
        return errorHandler(ctx, error as Error);
      }
    });
  }

  /**
   * > This is an advanced function.
   *
   * Installs an error boundary that catches errors that happen only inside
   * the given middleware. This allows you to install custom error handlers
   * that protect some parts of your system. Errors will not be able to bubble
   * out of this part of your middleware system, unless the supplied error
   * handler rethrows them, in which case the next surrounding error boundary
   * will catch the error.
   */
  errorBoundary(
    errorHandler: ErrorBoundaryMiddlewareHandler<C>,
    ...middleware: Middleware<C>[]
  ) {
    const composer = new Composer<C>(...middleware);
    this.use(async (ctx: C, next: NextMiddleware) => {
      let nextCalled = false;
      const cont = async () => {
        nextCalled = true;
        return Promise.resolve();
      };

      try {
        await composer.middleware(ctx, cont);
      } catch (err) {
        nextCalled = false;
        await errorHandler(new BoundaryError<C>(err, ctx), cont);
      }
      if (nextCalled) await next();
    });

    return composer;
  }

  /**
   * Enters another composer, extending its functionality and running its handlers along with its own.
   *
   * @usage
   * ``` ts
   * const parentComposer = new Composer<Record<string, unknown>>();
   * const childComposer = new Composer<Record<string, unknown>>();
   *
   * parentComposer.tap((ctx) => console.log('1'));
   * childComposer.tap((ctx) => console.log('2'));
   * childComposer.tap((ctx) => console.log('3'));
   *
   * parentComposer.run({}); // Output: 1
   *
   * childComposer.enter(parentComposer);
   *
   * parentComposer.run({}); // Output: 1 2 3
   * ```
   */
  enter<T extends UnknownObject & C>(parent: Composer<T>) {
    parent.use(this.handler);
    return parent;
  }

  run(ctx: C) {
    return this.middleware(ctx, noopNext);
  }
}
