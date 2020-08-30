# ts-transform-fix-esm

# Disclaimer

This transformer is experimental; use it at your own risk.

# Description

Adds file extension and/or index to module specifiers and correctly requires commonjs modules in an ESM environment.

For example:

```javascript
import { thing } from "commonjs/file";
import { anotherThing } from "esm/folder"
```

becomes

```javascript
import { anotherThing } from "esm/folder/index.js";
import { createRequire as __createRequire } from "module";
const __require = __createRequire(import.meta.url);
const { thing } = require(commonjs/file);
```
