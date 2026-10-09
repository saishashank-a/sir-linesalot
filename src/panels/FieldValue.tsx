import Markdown from 'react-markdown'
import { safeUrl } from '../edit/cards.ts'
import type { LalCardField } from '../model/schema.ts'

// Card content comes from untrusted documents: no raw HTML, no images (no remote
// fetches), and only http(s)/mailto links (safeUrl).

function ExternalLink({ href, children }: { href?: string; children?: React.ReactNode }) {
  return href ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>
}

export function FieldValue({ field }: { field: LalCardField }) {
  if (field.format === 'plain') return <p className="plain">{field.value}</p>
  if (field.format === 'url') {
    const href = safeUrl(field.value)
    return <ExternalLink href={href || undefined}>{field.value}</ExternalLink>
  }
  return (
    <Markdown urlTransform={safeUrl} disallowedElements={['img']} unwrapDisallowed components={{ a: ExternalLink }}>
      {field.value}
    </Markdown>
  )
}
