// Markdown for agents, the app for everyone else. A request that prefers
// text/markdown gets llms.txt for the homepage and a Markdown 404 for a path
// that doesn't exist; browsers get the same files they always did. Responses
// that can come either way say so with Vary: Accept, so no cache hands a
// browser the Markdown or an agent the HTML. _routes.json keeps hashed assets
// and the plain-text files from running through here at all.

interface Context {
  request: Request
  next: () => Promise<Response>
  env: { ASSETS: { fetch: (input: URL) => Promise<Response> } }
}

// Quality of a media type in an Accept header, counting only an exact match
// or text/* — a browser's */* is not a request for Markdown.
function quality(accept: string, type: string): number {
  let best = 0
  for (const part of accept.split(',')) {
    const [range, ...params] = part.trim().toLowerCase().split(';')
    if (range.trim() !== type && range.trim() !== 'text/*') continue
    const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
    best = Math.max(best, q ? Number(q.slice(2)) || 0 : 1)
  }
  return best
}

export function prefersMarkdown(accept: string | null): boolean {
  if (!accept) return false
  const markdown = quality(accept, 'text/markdown')
  return markdown > 0 && markdown >= quality(accept, 'text/html')
}

export function notFoundMarkdown(path: string): string {
  return `# Page not found

There is no page at \`${path}\` on Category Colors, a browser-based optimizer for categorical color palettes.

- [Category Colors](https://categorycolors.com/): the palette optimizer
- [llms.txt](https://categorycolors.com/llms.txt): what the site does, when to use it, and how agents can call it
- [Sitemap](https://categorycolors.com/sitemap.xml)
`
}

const markdown = (body: string, status: number) =>
  new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      Vary: 'Accept',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  })

export const onRequest = async ({ request, next, env }: Context): Promise<Response> => {
  const url = new URL(request.url)
  if ((request.method !== 'GET' && request.method !== 'HEAD') || url.pathname.startsWith('/api/')) return next()
  const home = url.pathname === '/' || url.pathname === '/index.html'
  const wantsMarkdown = prefersMarkdown(request.headers.get('Accept'))
  if (home && wantsMarkdown) {
    const llms = await env.ASSETS.fetch(new URL('/llms.txt', url))
    if (llms.ok) return markdown(await llms.text(), 200)
  }
  const response = await next()
  if (response.status === 404 && wantsMarkdown) return markdown(notFoundMarkdown(url.pathname), 404)
  if (!home && response.status !== 404) return response
  const varied = new Response(response.body, response)
  varied.headers.append('Vary', 'Accept')
  return varied
}
