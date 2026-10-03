import { expect, test } from 'bun:test'
import { resolveSourceUrl } from './paths'

test('source URLs encode reserved characters per path segment and normalize Windows paths', () => {
  expect(resolveSourceUrl('graphs\\Market research\\100% gain #1?\\01_html.html'))
    .toBe('/source-viewer/graphs/Market%20research/100%25%20gain%20%231%3F/01_html.html')
  expect(resolveSourceUrl('/data/sources/report/01_html.html'))
    .toBe('/source-viewer/data/sources/report/01_html.html')
  expect(resolveSourceUrl(undefined)).toBe('')
})
