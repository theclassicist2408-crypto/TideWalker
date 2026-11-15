# Fonts

Tidewalker ships no font files. Text uses system font stacks defined in `src/game/ui/ui.css`:

- Display / poetic text: `'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif`
- Interface text: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`

This keeps the download small, works offline from the first frame, and avoids font licensing.
If a custom typeface is ever added it must be openly licensed (for example SIL OFL), self-hosted in
this folder with its licence file, and loaded with `font-display: swap`.
