// SPDX-FileCopyrightText: 2026 Tim Hegemann
// SPDX-License-Identifier: MIT

import { afterEach, beforeEach, vi } from 'vitest'

// Extraction tests must never depend on a live House of Graphs service.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => {
    throw new Error('Unexpected network request in test; mock fetch explicitly')
  }))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
