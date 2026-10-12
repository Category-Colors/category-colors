# Plan: a full MCP server for Category Colors

Written 2026-10-12. Targets the [2026-07-28 MCP specification](https://modelcontextprotocol.io/specification/2026-07-28)
(stateless core, Streamable HTTP) and v2 of the TypeScript SDK
(`@modelcontextprotocol/server` 2.3.1, which implements that revision).

## Where things stand

The app registers six WebMCP tools (`src/lib/webmcp.ts`): `generate_palette`,
`load_preset_palette`, `set_palette`, `check_palette`, `export_palette` and
`get_current_palette`. They only exist while the page is open in a browser that
exposes `document.modelContext`, and they act on the page's own state. That
suits an agent working beside a person in the app. It does nothing for an agent
in Claude Code, Cursor, a CI job or a chat client that has no page open, which
is most of them. A real MCP server closes that gap.

## Recommendation

One tool core, served remotely, in this order. A local stdio server
(`npx category-colors-mcp`) was considered and set aside: the remote server
reaches every client that a local one would, without asking anyone to install
anything.

1. **Tool core.** Pull the parts of `webmcp.ts` that don't need React state into
   a plain module: the input schemas, color validation (`readColors`), the
   report summary, export, and preset lookup. Make every tool stateless: it
   takes colors as input and returns colors, instead of reading or replacing
   "the current palette". The WebMCP adapter keeps its stateful extras
   (`get_current_palette`, `set_palette`) on top. The browser and the server
   then cannot drift apart, and one set of contract tests covers both.
2. **Remote server (Streamable HTTP)** at `https://categorycolors.com/mcp`.
   Claude Code, Cursor, claude.ai connectors, ChatGPT and hosted agents all
   connect to a URL. The 2026-07-28 spec dropped the session handshake, so each
   request stands alone, which is a natural fit for Cloudflare Workers.

### The cost: CPU

Generation is real computation: 60,000 annealing iterations by default. In
Chrome, a 4-color run with one fixed color took about 1.8 to 2.3 seconds
(measured while building WebMCP), and 8 to 12 colors take longer. On Cloudflare:

| Plan | CPU per request | Fits generation? |
|---|---|---|
| Workers Free | 10 ms | No |
| Workers Paid | 30 s default, up to 5 min (`limits.cpu_ms`) | Yes |

So the remote server needs Workers Paid. Checking, exporting and presets are
cheap enough for either plan. The remote server should also cap `colorCount`
and `maxIterations`, rate-limit per client (Cloudflare's rate-limiting binding),
and limit request size.

## Tools (stateless)

All return `structuredContent` with an `outputSchema`, plus a short text
summary for clients that only show text.

| Tool | Input | Output |
|---|---|---|
| `generate_palette` | `colorCount`, `fixedColors?`, `style?` (vivid, dusky, pastel), `jnd?`, `colorSpace?` and ranges, `background?` (adds a contrast evaluator), `avoidColors?`, `seedColors?` | colors (hex and OKLCH), cost, iterations, report |
| `check_palette` | `colors`, `jnd?`, `cvd?` (which simulations), `includeMatrix?` | issues per vision test; full ΔE matrix if asked |
| `simulate_cvd` | `colors`, `type`, `severity?` | the colors as seen under that deficiency |
| `export_palette` | `colors`, `format` (raw, css, json/DTCG) | text |
| `list_presets` / `get_preset` | `name?` | the presets' names and colors |

The same presets should also be exposed as MCP resources
(`palette://presets/okabe-ito`), and the essay and package README as reference
resources, so clients can attach them as context.

## Where the code lives (decision needed)

- **Option A (recommended now that there's no stdio package): this app repo.**
  The server is a Worker or a Pages Function next to `functions/`, deployed with
  the site, and the tool core sits in `src/lib/` where both the page and the
  server import it.
- **Option B: the `category-colors` repo**, as a `category-colors/mcp` subpath.
  It would release with the algorithm, but the core library would take on
  the MCP SDK as a dependency, and nothing outside this site would use it.

## Phases

1. **Core and contract tests.** Extract the stateless tools. Have `webmcp.ts`
   wrap them. Write tests that run every tool through both adapters with the
   same inputs. Small, and possible right away.
2. **Remote server.** A Worker (or a Pages Function under `/mcp`) using the
   SDK's Streamable HTTP handler, statelessly. Add caps, rate limiting, an
   in-memory client/server test of every tool, and an end-to-end test with a
   real MCP client against `wrangler dev`. Measure the CPU of a worst-case
   generation before setting `limits.cpu_ms`. Write setup snippets for Claude
   Code, Claude Desktop and Cursor.
3. **Discovery.** Name the server in `llms.txt`, list them in the official MCP
   Registry, and check the 2026-07-28 spec's discovery guidance for a
   well-known endpoint to publish.

## Also worth deciding

- **A shareable palette URL.** The app has no URL state today. If it could open
  `https://categorycolors.com/?colors=…`, every server response could include a
  link that opens the palette in the app, with its charts and report. This is
  the most useful addition for people working alongside an agent, and it needs a
  product decision on the URL format.
- **Determinism.** Annealing is random, so identical requests give different
  palettes. A `seed` input (if the package can take one) would make results
  reproducible and the remote server cacheable.
- **WebMCP in production.** Chrome exposes `document.modelContext` to ordinary
  visitors only through an origin trial (Chrome 149 to 156). Registering
  categorycolors.com for the trial and adding its token (an `Origin-Trial`
  header in `public/_headers`) turns the browser tools on for real users until
  the trial ends.
