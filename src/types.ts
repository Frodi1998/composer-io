import { BoundaryError } from './error';

export type MaybePromise<T> = Promise<T> | T;
export type MaybeArray<T> = T[] | T;

/**
 * Returns the type of response middleware
 */
export type NextMiddlewareReturn = unknown;

/**
 * Call the next middleware from the chain
 */
export type NextMiddleware = () => Promise<NextMiddlewareReturn>;

/**
 * Returns the type of response middleware
 */
export type MiddlewareReturn = MaybePromise<unknown>;

/**
 * Instead of object
 */
export type UnknownObject = Record<string, unknown>;

/**
 * Basic middleware
 */
export type MiddlewareFn<T> = (
  context: T,
  next: NextMiddleware,
) => MiddlewareReturn;

/**
 * Middleware in the form of a container for a function.
 */
export type MiddlewareObj<T> = {
  /**
   * Returns the contained middleware.
   */
  middleware: MiddlewareFn<T>;
};

export type Middleware<C extends UnknownObject = UnknownObject> =
  | MiddlewareFn<C>
  | MiddlewareObj<C>;

/**
 * Asynchronous function for branch condition
 */
export type BranchMiddlewareConditionFunction<T> = (
  context: T,
) => MaybePromise<boolean>;

/**
 * Possible types for branch condition
 */
export type BranchMiddlewareCondition<T> =
  | BranchMiddlewareConditionFunction<T>
  | boolean;

/**
 * Asynchronous factory to create middleware
 */
export type LazyMiddlewareFactory<T extends UnknownObject> = (
  context: T,
) => MaybePromise<MaybeArray<Middleware<T>>>;

/**
 * Handler for catching errors in middleware chains
 */
export type CaughtMiddlewareHandler<T> = (
  context: T,
  error: Error,
) => MiddlewareReturn;

export type ErrorBoundaryMiddlewareHandler<T extends UnknownObject> = (
  error: BoundaryError<T>,
  next: NextMiddleware,
) => MiddlewareReturn;
