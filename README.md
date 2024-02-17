<p align="center"><img src="https://raw.githubusercontent.com/Frodi1998/composer-io/master/logo.svg?sanitize=true"></p>
<p align="center">

<a href="https://www.npmjs.com/package/composer-io"><img src="https://img.shields.io/npm/v/composer-io.svg?style=flat-square" alt="NPM version"></a>
<a href="https://www.npmjs.com/package/composer-io"><img src="https://img.shields.io/npm/dt/composer-io.svg?style=flat-square" alt="NPM downloads"></a>

<p align="center">

</p>

Этот модуль разработан с использованием и вдохновением от [middleware-io](https://github.com/negezor/middleware-io)
и [grammyjs](https://github.com/grammyjs/grammy).
Огромная благодарность [negezor](https://github.com/negezor) и [KnorpelSenf](https://github.com/KnorpelSenf) за их труд и вклад в сообщество разработчиков!

> **COMPOSER-IO** - Modern middleware

| [API Reference][https://tsdocs.dev/docs/composer-io/1.0.3] |
| ---------------------------------------------------------- |

<!-- | 📖 [Documentation](docs/) |
|---------------------------| -->

## Features

1. **Self-Sufficient.** The library has zero dependencies.
2. **Reliable.** The library is written in **TypeScript** and covered by tests.
3. **Modern.** The library comes with native ESM support
4. **Powerful.** Supports following additional features:
   - The library has enough built-in snippets;
   - The middleware chain builder;

## Installation

> **[Node.js](https://nodejs.org/) 14.0.0 or newer is required**

- **Using `npm`** (recommended)
  ```shell
  npm i composer-io
  ```
- **Using `Yarn`**
  ```shell
  yarn add composer-io
  ```
- **Using `pnpm`**
  ```shell
  pnpm add composer-io
  ```

## Example usage

```js
import { compose } from 'composer-io';

const composedMiddleware = compose(
  ...[
    async (context, next) => {
      // Step 1

      await next();

      // Step 4

      // Print the current date from the next middleware
      console.log(context.now);
    },
    async (context, next) => {
      // Step 2

      context.now = Date.now();

      await next();

      // Step 3
    },
  ],
);

composedMiddleware({}, () => {
  /* Last handler (next) */
})
  .then(() => {
    console.log('Middleware finished work');
  })
  .catch(console.error);
```
