# AGENTS.md

Guidance for AI agents working on this grammar (a fork of
[`acrion/tree-sitter-raku`](https://github.com/acrion/tree-sitter-raku)).

## What this is

The tree-sitter grammar for Raku used by the Zed extension
[`justaperlhacker/zed-raku`](https://github.com/justaperlhacker/zed-raku)
(local: `~/Projects/zed-raku`). It is a **Perl grammar with Raku support added
by hand**. It is *not* a from-scratch Raku grammar, so many Raku-only
constructs had to be patched in (see "Raku additions" below).

## Critical facts

- `grammar.js` is the source (tree-sitter DSL, ~1,600 lines).
- `tree-sitter generate` produces `src/parser.c` (generated, **~55 MB**),
  `src/grammar.json`, `src/node-types.json`, and `src/tree_sitter/{parser,array}.h`.
- `src/scanner.c` is a hand-written external scanner and is **not** generated.
- The upstream `.gitignore` ignores `src/*`, so the generated files are **not**
  tracked by default — this fork **force-adds** them so Zed can build the
  grammar. Never rely on them being auto-added.
- Zed compiles `src/parser.c` + `src/scanner.c`; it does **not** run
  `tree-sitter generate`. So every change must be regenerated and committed.
- The extension pins this repo's rev in `extension.toml`. After pushing here,
  the extension's rev must be bumped (see "Cross-repo workflow").

## Commands

```sh
timeout 300 tree-sitter generate     # SLOW (~1-2 min; parser is huge)
timeout 280 tree-sitter test         # baseline: 199 parses, 172 pass, 27 fail
tree-sitter parse <file>             # probe specific syntax
```

Faster sanity checks while iterating:

```sh
printf 'sub f($a?) { }\n' > /tmp/one.raku && tree-sitter parse /tmp/one.raku
```

Validate the extension's smoke file (must be 0 parse errors):

```sh
tree-sitter parse ~/Projects/zed-raku/test/highlight.raku
raku -c ~/Projects/zed-raku/test/highlight.raku      # -> Syntax OK
```

Validate the extension's queries against this parser (run **from this dir**):

```sh
for q in highlights brackets indents outline textobjects injections overrides; do
  tree-sitter query ~/Projects/zed-raku/languages/raku/$q.scm \
    ~/Projects/zed-raku/test/highlight.raku >/dev/null && echo "$q OK" || echo "$q FAIL"
done
```

## Commit workflow

Generated files are gitignored, so force-add them:

```sh
git add grammar.js src/scanner.c
git add -f src/parser.c src/node-types.json src/tree_sitter/parser.h \
           src/tree_sitter/array.h src/grammar.json
git commit -m "..."
git push origin HEAD:main        # origin = fork (SSH alias github-justaperlhacker)
```

`parser.c` is >50 MB, so `git push` prints a GitHub "large file" warning — that
is expected (hard limit is 100 MB).

## Test baseline (do not regress)

`tree-sitter test` currently reports **27 pre-existing failures** in the
Perl-oriented corpus. Keep that set identical. Compare with:

```sh
tree-sitter test 2>&1 | grep '✗' | sed 's/\x1b\[[0-9;]*m//g' | sort
```

Only "Slow parse rate" warnings may legitimately differ. The corpus lives in
`test/corpus/` and `test/highlight/`.

## tree-sitter gotchas (learned the hard way)

- **Externals order matters**: the `externals: [...]` array in `grammar.js`
  must match the token enum order in `src/scanner.c`. If you add an external
  token, insert it in both, at the same position (e.g. `_regex_body` /
  `TOKEN_REGEX_BODY` sit just before `_ERROR` / `TOKEN_ERROR`).
- **Conflicts**: add a `conflicts` entry **only** when `tree-sitter generate`
  explicitly asks for one. After it generates, re-run and delete any
  "unnecessary conflicts" it reports.
- **`token.immediate(...)`** requires adjacency (no whitespace). Used for
  `%h{...}`, `.method`, `1..10` ranges, twigils, angle subscripts. Removing it
  re-introduces ambiguities.
- **Inlining internal rules makes the parser larger** here (measured: state
  count went 11,514 → 13,058). Avoid `inline: [...]` additions.
- **`prec.dynamic`** only helps once a conflict is declared; it does not create
  one.
- **Query string literals must be real tokens**: referencing a token that the
  grammar doesn't define (e.g. `"'"` when quotes are external) can silently
  match the wrong thing.
- **Parser size**: driven by `STATE_COUNT` / `SYMBOL_COUNT` / `TOKEN_COUNT`
  (~11.5k / 573 / 363). Prefer reusing existing tokens/rules over adding new
  ones; the size is dominated by the parse table, not by source duplication.

## `src/scanner.c` notes

- External tokens are declared in `enum TokenType` and dispatched near the top
  of `tree_sitter_raku_external_scanner_scan`.
- `ADVANCE_C` advances the lexer and refreshes `c`; `TOKEN(type)` sets the
  result symbol and returns; `MARK_END` marks the token end.
- `LexerState` (serialized between lex calls) holds the heredoc state
  (`HEREDOC_START`/`CONTINUE`/`END`), quote state, etc. `lexerstate_add_heredoc`
  sets a heredoc delimiter.
- `TOKEN_POD` scans POD line-by-line and stops at `=cut` or at the `=end` that
  closes a `=begin` block (nesting-aware).
- `TOKEN_REGEX_BODY` captures an opaque, brace-balanced `{ ... }` body for
  `token`/`rule`/`regex` declarations (handles `\}` escapes and nesting).
- Heredocs are wired to Perl's `<<DELIM` via `_PERLY_HEREDOC`; Raku `q:to/.../`
  is **not** supported yet.

## Raku additions (do not accidentally undo)

These were added on top of upstream. See `~/Projects/zed-raku/.plans/grammar-status.plan`
for the full rev-by-rev list. Key design decisions:

- **`.` is not concat**: removed from the additive binary operators; Raku method
  calls use `.`. Number literals require digits after `.` so `1..10` lexes as a
  range (upstream parsed `1.` as a number).
- **Subscript braces are `token.immediate('{')`** so a spaced `{` starts a block
  — needed to disambiguate `given $x { ... }` from `$x{...}`.
- **Twigils** are one immediate token
  `/[!.^?*:+=~][XID_Start][XID_Continue-]*/` (in `varname`/`_indirob`), so
  longest-match separates `$!foo` from the special var `$!` without breaking
  `.foo` method calls.
- **Return types**: `--> T` goes **inside** the signature (`sub f($x --> Int)`);
  the outside forms are `of T` / `returns T`. The outside `-->` is a Raku syntax
  error and must not parse.
- **Phasers**: the full Raku set is in `_PHASE_NAME`.
- **`has`**, **`constant`**, **`subset`**, **`grammar`/`token`/`rule`/`regex`**,
  **`multi`/`proto`/`only`**, **private/meta methods** (`method !x`, `method ^x`),
  **`submethod`**, **user-defined operators** (`sub infix:<+>`), **pointy blocks
  / pointy `for`**, **named args**, **safe/meta/hyper method calls**, **`?? !!`**,
  **`but`**, **reduction/zip/cross/hyper metaoperators**, **`Q` quote**, **chained
  subscripts**, **`is`/`does`/`handles` traits**, **signature modifiers**, **Raku
  compound assignment** (`~=`, `max=`, `min=`, `Z=`, `X=`), **number literals**
  (`0o`, `0d`, `:16<ff>`), and **POD `=end` termination**.
- **Supertypes**: `slices` was merged into `subscripted` to avoid duplicated
  chained-subscript alternatives. Prefer one supertype over duplicating rule
  bodies across `array_element_expression` / `hash_element_expression` /
  `slice_expression` / `keyval_expression`.

## Known gaps (with approaches)

- **`q:to/END/` heredocs** (hard, low priority): intercept `q:to`/`qq:to` in the
  scanner's quotelike handling, parse the delimiter, call
  `lexerstate_add_heredoc()`, and add a grammar rule. Regression risk for the
  Perl heredoc corpus.
- **Quote adverbs / unicode delimiters** (`q:!c{...}`, `Q:q{...}`, `q«...»`):
  parse adverbs after the quote operator; add delimiter handling.
- **Junction-specific highlighting** (cosmetic): `|`/`&` parse as bitwise; a real
  `junctive_expression` would change Perl bitwise parsing and likely break the
  corpus. Probably not worth it.
- **`token`/`rule`/`regex` bodies** are opaque (aliased to `regexp_content`), not
  highlighted as regexes.

## Cross-repo workflow (with the extension)

1. Make + test the grammar change here; commit + push (force-adding generated
   files).
2. In `~/Projects/zed-raku`:
   - set `[grammars.raku].rev` in `extension.toml` to the new commit;
   - update `languages/raku/highlights.scm` for any new tokens/nodes;
   - add examples to `test/highlight.raku`;
   - verify 0 parse errors + all queries compile; commit + push.
3. In Zed: Extensions → **Raku** → **Rebuild** (the installed dev extension is a
   symlink to the extension repo; grammar/query changes need a rebuild).

`~/Projects/zed-raku/scripts/build-grammar.sh` automates step 1's push and
step 2's rev bump.

## More detail

- `~/Projects/zed-raku/.plans/agent-notes.plan` — environment, paths, gotchas.
- `~/Projects/zed-raku/.plans/grammar-status.plan` — rev-by-rev fixes + gaps.
- `~/Projects/zed-raku/AGENTS.md` — extension-side agent guide.
