<!-- SPDX-FileCopyrightText: 2026 Tim Hegemann
     SPDX-FileCopyrightText: 2024 Mozilla Foundation
     SPDX-FileCopyrightText: 2024 Volodymyr Agafonkin
     SPDX-FileCopyrightText: 2024 Vladimir Agafonkin
     SPDX-FileCopyrightText: 2026 Vladimir Agafonkin
     SPDX-FileCopyrightText: 2013-2025 Denis Pushkarev (zloirock.ru)
     SPDX-FileCopyrightText: 2025-2026 CoreJS Company (core-js.io)
     SPDX-License-Identifier: Apache-2.0 AND ISC AND MIT -->

# Third-party notices

The production package includes or depends on the following third-party code.
These notices apply in addition to the MIT license for Graph Harvester's own
code. PDF.js and core-js are bundled; RBush, KDBush, and Quickselect are
installed dependencies rather than part of our bundle. The versions listed
are those in the repository's lockfile; a consumer may install other versions
within the declared ranges. Review the corresponding license files and update
these notices whenever dependencies change.

## PDF.js / pdfjs-dist 6.5.438

Copyright 2024 Mozilla Foundation. Licensed under Apache License 2.0.
The full license is included as `dist/PDFJS-LICENSE.txt` and
`LICENSES/Apache-2.0.txt`. Source: <https://github.com/mozilla/pdf.js>.

The legacy PDF.js main and worker builds include core-js, whose license is
reproduced below. PDF.js auxiliary resources such as CMaps, fonts, WASM, and
ICC profiles are **not included in this npm tarball**. If you distribute
those resources separately, retain and review their accompanying license files.

## core-js 3.51.0 — MIT

Source: <https://github.com/zloirock/core-js/tree/v3.51.0>

```text
Copyright (c) 2013–2025 Denis Pushkarev (zloirock.ru)
Copyright (c) 2025–2026 CoreJS Company (core-js.io)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## RBush 4.0.1 — MIT

Source: <https://github.com/mourner/rbush>

```text
MIT License

Copyright (c) 2024 Volodymyr Agafonkin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## KDBush 4.1.0 — ISC

Source: <https://github.com/mourner/kdbush>

```text
ISC License

Copyright (c) 2026, Vladimir Agafonkin

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.
```

## Quickselect 3.0.0 — ISC

Used by RBush. Source: <https://github.com/mourner/quickselect>

```text
ISC License

Copyright (c) 2024, Vladimir Agafonkin

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.
```
