import { useMemo } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import katex from 'katex'
import { cn } from './ui'

marked.setOptions({ gfm: true, breaks: true })

/**
 * Renders Markdown with $inline$ and $$display$$ math. Math is rendered by KaTeX
 * (from escaped source, trust disabled); all Markdown HTML is sanitised with DOMPurify.
 */
export function renderMarkdown(src: string, inline = false): string {
  const math: string[] = []
  const stash = (tex: string, display: boolean) => {
    let html: string
    try {
      html = katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: 'ignore', trust: false, output: 'htmlAndMathml' })
    } catch {
      html = `<code>${tex.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)}</code>`
    }
    math.push(html)
    return `@@MATH${math.length - 1}@@`
  }
  let s = src.replace(/\$\$([\s\S]+?)\$\$/g, (_, t: string) => stash(t.trim(), true))
  s = s.replace(/\\\[([\s\S]+?)\\\]/g, (_, t: string) => stash(t.trim(), true))
  s = s.replace(/\\\((.+?)\\\)/g, (_, t: string) => stash(t.trim(), false))
  // $…$ but not currency like "5 $" – require non-space after the opening and before the closing $
  s = s.replace(/\$(?!\s)([^$\n]+?)(?<!\s)\$/g, (_, t: string) => stash(t, false))
  const html = inline ? (marked.parseInline(s) as string) : (marked.parse(s) as string)
  const clean = DOMPurify.sanitize(html, { ADD_ATTR: ['target'] })
  return clean.replace(/@@MATH(\d+)@@/g, (_, i: string) => math[Number(i)] ?? '')
}

export function Markdown({ children, className, inline }: { children: string; className?: string; inline?: boolean }) {
  const html = useMemo(() => renderMarkdown(children ?? '', inline), [children, inline])
  if (inline) return <span className={cn('md', className)} dangerouslySetInnerHTML={{ __html: html }} />
  return <div className={cn('md', className)} dangerouslySetInnerHTML={{ __html: html }} />
}
