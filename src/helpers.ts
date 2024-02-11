import {
  NextMiddleware,
  MiddlewareFn,
  Middleware,
  UnknownObject,
} from './types';

export function assertMiddleware<T>(
  middleware: unknown,
): asserts middleware is MiddlewareFn<T> {
  if (typeof middleware !== 'function') {
    throw new TypeError('Middleware must be composed of function!');
  }
}

export function assertMiddlewares<T>(
  middlewares: unknown[],
): asserts middlewares is MiddlewareFn<T>[] {
  middlewares.forEach(assertMiddleware);
}

export const wrapMiddlewareNextCall = async <T>(
  context: T,
  middleware: MiddlewareFn<T>,
): Promise<boolean> => {
  let called = false;

  await middleware(context, async (): Promise<void> => {
    if (called) {
      throw new Error('next() called multiple times');
    }

    called = true;
  });

  return called;
};

// === Middleware base functions
export function flattenMiddleware<C extends UnknownObject>(
  mw: Middleware<C>,
): MiddlewareFn<C> {
  return typeof mw === 'function' ? mw : mw.middleware;
}

/**
 * Noop for call `next()` in middleware
 */
// eslint-disable-next-line @typescript-eslint/no-empty-function
export const noopNext: NextMiddleware = (): Promise<void> => Promise.resolve();
