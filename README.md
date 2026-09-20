# tree-sitter-raku

A [Tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for the
[Raku](https://raku.org/) programming language.

> **This is a fork** of [`acrion/tree-sitter-raku`](https://github.com/acrion/tree-sitter-raku),
> which is itself a fork of [`tree-sitter-perl`](https://github.com/tree-sitter-perl/tree-sitter-perl).
> This fork adds substantial Raku syntax support and **commits the generated
> `src/parser.c`** so that editors which compile (rather than generate) the
> parser — notably [Zed](https://zed.dev) — can build it directly.

It is **experimental**: the grammar is a Perl grammar with Raku support added by
hand, so some Raku-only syntax still mis-highlights or errors. See
[Changes from upstream](#changes-from-upstream) and
[Known gaps](#known-gaps).

## Where this is used

The primary consumer is the Zed extension
[`justaperlhacker/zed-raku`](https://github.com/justaperlhacker/zed-raku)
(local: `~/Projects/zed-raku`), which pins a revision of this repository in its
`extension.toml`.

It also still works with Helix (the `queries/` and `helix/languages.toml` from
upstream are retained); for Helix setup, see the upstream README, substituting
this repository for the grammar source.

### Why the generated parser is committed

Zed compiles the grammar's generated `src/parser.c` + `src/scanner.c` into wasm;
it does **not** run `tree-sitter generate`. Upstream gitignores `src/*` and
therefore ships no `parser.c`, so it cannot be built by Zed as-is. This fork
force-commits the generated files (`src/parser.c`, `src/grammar.json`,
`src/node-types.json`, `src/tree_sitter/{parser,array}.h`) for that reason.

## Changes from upstream

Upstream made only minor Raku adjustments (most notably hyphens in identifiers).
This fork adds:

- **Variables**: twigils (`$!x`, `$.x`, `$?x`, `$^x`, `$*x`, `@.list`, `%!map`),
  sigilless variables (`my \x`), chained subscripts (`@a[0][1]`, `%h<a><b>`),
  angle subscripts (`%h<key>`).
- **Declarators**: `has` attributes (types, `is`/`does`/`handles` traits,
  defaults), `constant`, `subset`, parameterised roles/classes (`role R[::T]`),
  and inheritance traits (`class C is B does R`).
- **Subs & methods**: typed signatures (`Int $x`, `:$named`, slurpy `*@a`,
  `$x?`/`$x!`, `where`, `is rw`), return types (`--> T` inside the signature,
  `of`/`returns T` outside), `multi`/`proto`/`only`, private/meta methods
  (`method !x`, `method ^x`), `submethod`, user-defined operators
  (`sub infix:<+>`, `prefix:`, `postfix:`, `circumfix:`, `term:`).
- **Expressions**: `.method(...)` / `.method: args` calls, safe/meta calls
  (`.?`, `.^`, `.&`, `.!`), named arguments (`:name`, `:name(...)`,
  `:name<...>`, `:$var`, `:!name`), the Whatever star (`*`), pointy blocks and
  pointy `for`, `?? !!` ternary, `but` (with anonymous roles), reduction/zip/
  cross/hyper metaoperators (`[+]`, `Z`, `X`, `>>+<<`, `@a>>.uc`).
- **Control flow**: paren-less `if`/`elsif`/`unless`/`while`/`until`/`for` and
  `given`/`when`/`default`.
- **Literals**: the `Q` quote, `0o`/`0d`/`:16<ff>` number literals, correct
  `1..10` ranges.
- **Phasers**: the full Raku set (`ENTER`, `LEAVE`, `FIRST`, `LAST`, `NEXT`,
  `CATCH`, …).
- **Grammars**: `grammar`/`token`/`rule`/`regex` declarations (bodies parsed
  opaquely).
- **POD**: `=begin pod`/`=end pod` is nesting-aware (stops at `=end`).
- **Assignments**: Raku compound operators (`~=`, `max=`, `min=`, `Z=`, `X=`).

Each change was verified against the grammar's own test suite without adding new
failures. See `~/Projects/zed-raku/.plans/grammar-status.plan` for a rev-by-rev
history.

## Known gaps

- `q:to/END/` heredocs (only Perl's `<<DELIM` form is supported).
- Quote adverbs / unicode quotelike delimiters (`q:!c{...}`, `Q:q{...}`,
  `q«...»`).
- Junctions (`|`/`&`/`^`) parse as bitwise operators.
- `token`/`rule`/`regex` bodies are opaque (not highlighted as regexes).

## Development

`grammar.js` is the source; `src/scanner.c` is a hand-written external scanner;
everything else under `src/` is generated.

```sh
timeout 300 tree-sitter generate     # regenerate (slow: parser is ~55 MB)
timeout 280 tree-sitter test         # baseline: 199 parses, 27 pre-existing failures
tree-sitter parse <file>             # probe syntax
```

Generated files are gitignored by upstream, so force-add them when committing:

```sh
git add grammar.js src/scanner.c
git add -f src/parser.c src/node-types.json src/tree_sitter/parser.h \
           src/tree_sitter/array.h src/grammar.json
```

See [AGENTS.md](AGENTS.md) for the full workflow, tree-sitter/scanner gotchas,
and the design decisions behind the Raku additions.

## Credits

- [`tree-sitter-perl`](https://github.com/tree-sitter-perl/tree-sitter-perl) —
  the vast majority of the parsing logic.
- [`acrion/tree-sitter-raku`](https://github.com/acrion/tree-sitter-raku) — the
  Raku adaptation this fork is based on.
- [Helix](https://github.com/helix-editor/helix) — the query files are based on
  Helix's Perl queries.

## License

MIT. See [LICENSE](LICENSE).
