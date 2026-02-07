# Ronny - Python Challenges for Leaving Cert CS

Browser app for Irish Leaving Cert Computer Science Python practice.

**Live site**: https://goronny.codes (GitHub Pages from `main` branch)

## Architecture

Three files, no build step, no server, no npm. GitHub Pages serves directly.

| File | Lines | Contents |
|------|-------|----------|
| `index.html` | ~850 | HTML + CSS + two `<script src>` tags |
| `challenges.js` | ~3,555 | `challenges` array (296 objects) + `CHAPTERS` array (41 objects) |
| `engine.js` | ~900 | Constants, Firebase config/auth, game state, all functions, `init()` |

### External CDN dependencies
- **Skulpt** - Python interpreter in browser
- **Firebase Auth** - Google Sign-In
- **Firebase Firestore** - Cloud sync with offline localStorage fallback
- **Google Fonts** - Poppins + Fira Code

## Content Structure

### Sections (3)
| Section | Chapters | Description |
|---------|----------|-------------|
| Preparation Questions | Ch 1-17 | Core Python concepts |
| LC Exam Questions | Ch 18-23 | Real Leaving Cert exam questions (2020-2025) |
| Mock Questions | Ch 24-41 | 18 mock exams at LC difficulty, different topics |

### Challenge format
```js
{
  id: 1,
  chapter: 1,
  name: "Hello World",
  difficulty: 1,          // 1-5, XP: 50/75/100/150/200
  desc: "<p>...</p>",     // HTML description
  hint: "...",            // Halves XP if used
  starter: "# ...\n",    // Initial code (single-quoted, \n for newlines)
  check: (output) => output.trim() === "Hello, World!",
  successMsg: "..."
}
```

### Chapter format
```js
{ id: 1, name: "Print & Output", section: "Preparation Questions", icon: '<svg ...>' }
// LC/Mock chapters also have:
{ ..., examContext: "LC 2020 Section C - ..." }
```

## Key Constraints

- **No `input()`** - Skulpt doesn't support it. All challenges use hardcoded values.
- **Incremental starters** - Each challenge's starter code includes the solution from the previous challenge in the same chapter.
- **Check functions are JS** - Arrow functions `(o) => ...` where `o` is the program's stdout output.
- **Single quotes for starter** - Starter code strings use `'...\n...'` with `\n` for newlines. Inner Python strings use double quotes.
- **IDs must be sequential** - Challenge ids 1-296, chapter ids 1-41. No gaps.

## Development

```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

Google Sign-In requires `http://localhost` or an authorized domain (not `file://`).

## Deployment

GitHub Pages from `main` branch. Push to deploy:
```bash
git add index.html challenges.js engine.js && git commit -m "message" && git push origin main
```

Custom domain `goronny.codes` configured via CNAME file + DNS.

## Firebase

Project: `goronny`. Config is in `engine.js` (public API key - this is normal for Firebase client SDK).

Firestore rules restrict users to their own data only.
