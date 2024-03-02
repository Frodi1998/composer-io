import { assertMiddlewares } from './helpers';
import type {
  NextMiddleware,
  MiddlewareReturn,
  NextMiddlewareReturn,
  MiddlewareFn,
} from './types';

/**
 * Compose an array of middleware handlers into a single handler
 *
 * @param middlewares - The array of middlewareFn
 *
 * @returns Composed middlewareFn
 */
export function compose<T>(...middlewares: MiddlewareFn<T>[]): MiddlewareFn<T> {
  assertMiddlewares<T>(middlewares);

  return (context: T, next?: NextMiddleware): Promise<MiddlewareReturn> => {
    let lastIndex = -1;

    const nextDispatch = (index: number): Promise<NextMiddlewareReturn> => {
      if (index <= lastIndex) {
        return Promise.reject(new Error('next() called multiple times'));
      }

      lastIndex = index;

      const middleware =
        middlewares.length !== index ? middlewares[index] : next;

      if (!middleware) {
        return Promise.resolve();
      }

      return Promise.resolve(
        middleware(
          context,
          (): Promise<NextMiddlewareReturn> => nextDispatch(index + 1),
        ),
      );
    };

    return nextDispatch(0);
  };
}
