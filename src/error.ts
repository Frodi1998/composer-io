import type { UnknownObject } from './types';

/**
 * Represents an error that occurred within a certain boundary or context,
 * accompanied by additional contextual information.
 *
 * @typeparam C - The type of the context associated with the error.
 */
export class BoundaryError<C extends UnknownObject> extends Error {
  /**
   * Creates an instance of `BoundaryError`.
   *
   * @param error - The original error or the error message.
   * @param _ctx - The context associated with the error.
   */
  constructor(
    public readonly error: unknown,
    private _ctx: C,
  ) {
    super(generateBoundaryErrorMessage(error));

    this.name = this.constructor.name;

    if (error instanceof Error) this.stack = error.stack;
  }

  /**
   * Gets the context associated with the error.
   */
  get ctx() {
    return this._ctx;
  }

  /**
   * Alias for `ctx`.
   */
  get context() {
    return this._ctx;
  }
}

function generateBoundaryErrorMessage(error: unknown) {
  let msg: string;
  if (error instanceof Error) {
    msg = `${error.name} in middleware: ${error.message}`;
  } else {
    const type = typeof error;
    msg = `Non-error value of type ${type} thrown in middleware`;
    switch (type) {
      case 'bigint':
      case 'boolean':
      case 'number':
      case 'symbol':
        msg += `: ${error}`;
        break;
      case 'string':
        msg += `: ${String(error).substring(0, 50)}`;
        break;
      default:
        msg += '!';
        break;
    }
  }
  return msg;
}
