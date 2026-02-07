# Ronny

Python coding challenges for Leaving Cert Computer Science.

**https://goronny.codes**

## What is Ronny?

Ronny is a browser-based Python learning platform designed for Irish Leaving Cert CS students. It runs entirely in a single HTML file with no build step or server required. Students write and execute Python code directly in the browser using [Skulpt](https://skulpt.org/), with instant feedback on correctness.

## Features

- **150 challenges** across 15 chapters (Print & Output, Variables, Operators, Strings, Conditionals, For Loops, While Loops, Lists, Functions, Dictionaries, 2D Lists, Error Handling, Searching & Sorting, Data Processing, Boss Challenges)
- **Gamification** - XP, levels, ranks, streaks, combo multipliers, achievements, and a sensei mascot that reacts to your progress
- **Google Sign-In** - authenticate with Google to sync progress across devices
- **Cloud persistence** - progress and code saved to Firestore; works offline with localStorage fallback
- **Code persistence** - editor content saved per challenge, restored when switching back
- **Mobile responsive** - works on phones and tablets

## Architecture

### Single-file design

Everything lives in `index.html` (~2,600 lines):

| Section | Description |
|---------|-------------|
| **CSS** (~480 lines) | Dark theme with pink/blue accents, responsive layout, animations |
| **HTML** (~140 lines) | Header with stats/auth, sidebar with chapter navigation, editor + console, overlays |
| **Challenge data** (~1,300 lines) | 150 challenge objects with descriptions, starter code, and validation functions |
| **Game engine** (~680 lines) | State management, Firebase auth/Firestore, code execution, UI rendering |

### External dependencies

All loaded via CDN, no npm/bundler needed:

- **Skulpt** - Python-in-browser interpreter
- **Firebase Auth** - Google Sign-In
- **Firebase Firestore** - Cloud persistence with offline support
- **Google Fonts** - Poppins (UI) + Fira Code (editor)

### Data model

```
localStorage:
  ronnyState    -> { xp, level, streak, completed[], achievements[], hintUsed[] }
  ronnyCode     -> { [challengeId]: code }

Firestore (when signed in):
  users/{uid}                    -> xp, level, streak, completed[], achievements[], hintUsed[]
  users/{uid}/code/{challengeId} -> { content, updatedAt }
```

State is always saved to localStorage. When signed in, it's also synced to Firestore. On first sign-in, existing localStorage data migrates to Firestore. On subsequent sign-ins, Firestore data takes priority.

### Challenge structure

Each challenge is a JavaScript object:

```js
{
  id: 1,
  chapter: 1,
  name: "Hello World",
  difficulty: 1,          // 1-5, determines XP: 50/75/100/150/200
  desc: "<p>...</p>",     // HTML description
  hint: "...",            // Shown on request (halves XP)
  starter: "# ...\n",    // Initial editor content
  check: (output) => output.trim() === "Hello, World!",
  successMsg: "..."       // Shown on completion
}
```

## Development

No build step. Just serve the file:

```bash
python3 -m http.server 8000
# Open http://localhost:8000
```

Google Sign-In requires `http://localhost` or an authorized domain (not `file://`).

## Firebase setup

The app uses Firebase project `goronny`. To set up your own:

1. Create a Firebase project
2. Enable Google Auth (Authentication > Sign-in method)
3. Create a Firestore database
4. Deploy security rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      match /code/{challengeId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

5. Update `firebaseConfig` in `index.html` with your project's config
