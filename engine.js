const DIFFICULTY_POINTS = { 1: 50, 2: 75, 3: 100, 4: 150, 5: 200 };

// ===== GAMIFICATION =====
const LEVEL_THRESHOLDS = [0, 150, 400, 750, 1200, 1800, 2500, 3400, 4500, 5800, 7300, 9000, 10900, 13000, 15500];
const RANKS = [
  "Beginner", "Code Cadet", "Script Scribe", "Loop Learner", "String Spinner",
  "List Wrangler", "Function Forger", "Dict Detective", "Algorithm Ace", "Error Slayer",
  "Data Wizard", "Code Champion", "Python Pro", "Grand Master", "Ronny Legend"
];

const SENSEI_MESSAGES = {
  welcome: "Welcome! Choose a chapter to start!",
  correct: ["Brilliant!", "Perfect!", "Nailed it!", "You're on fire!", "Excellent work!", "Spot on!"],
  wrong: ["Not quite... Try again!", "Almost! Check your output.", "Keep at it!", "Close - look carefully!"],
  streak3: "3x COMBO! Unstoppable!",
  streak5: "5x COMBO! LEGENDARY!",
  boss: "Boss challenge! Give it everything!",
  allDone: "ALL CHALLENGES COMPLETE! You are a Ronny Legend!"
};

// ===== FIREBASE =====
const firebaseConfig = {
  apiKey: "AIzaSyCvgXey4g8ETtFcSLJDysHAPFLz4SqS6sk",
  authDomain: "goronny.firebaseapp.com",
  projectId: "goronny",
  storageBucket: "goronny.firebasestorage.app",
  messagingSenderId: "413524347267",
  appId: "1:413524347267:web:1fab7caa3917089ee90eb6",
  measurementId: "G-G1T0ZF2TJV"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
db.enablePersistence().catch(() => {});

let currentUser = null;
let authReady = false;
const codeCache = {};

function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch((err) => {
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
      auth.signInWithRedirect(provider);
    }
  });
}

function signOutUser() {
  auth.signOut().catch(err => {
    console.error('Sign-out error:', err);
  });
}

function updateAuthUI(user) {
  const btnSignIn = document.getElementById('btnSignIn');
  const userProfile = document.getElementById('userProfile');
  const heroCta = document.getElementById('heroCta');
  if (user) {
    btnSignIn.style.display = 'none';
    userProfile.classList.add('visible');
    document.getElementById('userAvatar').src = user.photoURL || '';
    const firstName = (user.displayName || 'User').split(' ')[0];
    document.getElementById('userName').textContent = firstName;
    if (heroCta) heroCta.textContent = 'Choose a Chapter to Begin \u2192';
  } else {
    btnSignIn.style.display = '';
    userProfile.classList.remove('visible');
    if (heroCta) heroCta.textContent = 'Start Coding \u2192';
  }
}

function saveStateToLocalStorage() {
  try {
    localStorage.setItem('ronnyState', JSON.stringify({
      xp: state.xp, level: state.level, streak: state.streak,
      dailyStreak: state.dailyStreak, lastActiveDate: state.lastActiveDate,
      completed: [...state.completed],
      achievements: [...state.achievements],
      hintUsed: [...state.hintUsed]
    }));
  } catch(e) {}
}

function saveStateToFirestore(uid) {
  db.collection('users').doc(uid).set({
    xp: state.xp,
    level: state.level,
    streak: state.streak,
    dailyStreak: state.dailyStreak,
    lastActiveDate: state.lastActiveDate,
    completed: [...state.completed],
    achievements: [...state.achievements],
    hintUsed: [...state.hintUsed],
    displayName: currentUser.displayName || '',
    photoURL: currentUser.photoURL || '',
    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).catch(err => console.error('Firestore save error:', err));
}

async function loadStateFromFirestore(uid) {
  try {
    const doc = await db.collection('users').doc(uid).get();
    if (doc.exists) {
      const s = doc.data();
      state.xp = s.xp || 0;
      state.level = s.level || 1;
      state.streak = s.streak || 0;
      state.dailyStreak = s.dailyStreak || 0;
      state.lastActiveDate = s.lastActiveDate || '';
      state.completed = new Set(s.completed || []);
      state.achievements = new Set(s.achievements || []);
      state.hintUsed = new Set(s.hintUsed || []);
      saveStateToLocalStorage();
      return true;
    }
  } catch(e) { console.error('Firestore load error:', e); }
  return false;
}

async function hasCloudData(uid) {
  try {
    const doc = await db.collection('users').doc(uid).get();
    return doc.exists && (doc.data().completed || []).length > 0;
  } catch(e) { return false; }
}

// Code persistence
function saveCode(challengeId, code) {
  codeCache[challengeId] = code;
  try {
    const saved = JSON.parse(localStorage.getItem('ronnyCode') || '{}');
    saved[challengeId] = code;
    localStorage.setItem('ronnyCode', JSON.stringify(saved));
  } catch(e) {}
  if (currentUser) {
    db.collection('users').doc(currentUser.uid).collection('code').doc(String(challengeId)).set({
      content: code, updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(() => {});
  }
}

function loadCode(challengeId) {
  if (codeCache[challengeId] !== undefined) return codeCache[challengeId];
  try {
    const saved = JSON.parse(localStorage.getItem('ronnyCode') || '{}');
    if (saved[challengeId] !== undefined) {
      codeCache[challengeId] = saved[challengeId];
      return saved[challengeId];
    }
  } catch(e) {}
  return null;
}

async function loadCodeFromFirestore(uid, challengeId) {
  try {
    const doc = await db.collection('users').doc(uid).collection('code').doc(String(challengeId)).get();
    if (doc.exists) {
      const code = doc.data().content;
      codeCache[challengeId] = code;
      // Also save to localStorage for offline access
      try {
        const saved = JSON.parse(localStorage.getItem('ronnyCode') || '{}');
        saved[challengeId] = code;
        localStorage.setItem('ronnyCode', JSON.stringify(saved));
      } catch(e) {}
      return code;
    }
  } catch(e) {}
  return null;
}

async function saveAllCodeToFirestore(uid) {
  try {
    const saved = JSON.parse(localStorage.getItem('ronnyCode') || '{}');
    const batch = db.batch();
    for (const [id, code] of Object.entries(saved)) {
      const ref = db.collection('users').doc(uid).collection('code').doc(String(id));
      batch.set(ref, { content: code, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    }
    await batch.commit();
  } catch(e) { console.error('Code migration error:', e); }
}

function clearSavedCode(challengeId) {
  delete codeCache[challengeId];
  try {
    const saved = JSON.parse(localStorage.getItem('ronnyCode') || '{}');
    delete saved[challengeId];
    localStorage.setItem('ronnyCode', JSON.stringify(saved));
  } catch(e) {}
  if (currentUser) {
    db.collection('users').doc(currentUser.uid).collection('code').doc(String(challengeId)).delete().catch(() => {});
  }
}

auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  authReady = true;
  updateAuthUI(user);
  if (!user) {
    // Reset state on sign-out to prevent data leaking between users
    state.xp = 0; state.level = 1; state.streak = 0; state.dailyStreak = 0; state.lastActiveDate = '';
    state.completed = new Set(); state.achievements = new Set(); state.hintUsed = new Set();
    loadState(); // reload from localStorage
    updateStats();
    renderSidebar();
  }
  if (user) {
    const hasCloud = await hasCloudData(user.uid);
    if (hasCloud) {
      // Load from Firestore (cloud wins)
      await loadStateFromFirestore(user.uid);
    } else if (state.completed.size > 0) {
      // First sign-in with localStorage data — migrate to Firestore
      saveStateToFirestore(user.uid);
      saveAllCodeToFirestore(user.uid);
    }
    updateStats();
    renderSidebar();
    // Reload current challenge code from Firestore if viewing one
    if (state.currentChallenge >= 0) {
      const ch = challenges[state.currentChallenge];
      const cloudCode = await loadCodeFromFirestore(user.uid, ch.id);
      if (cloudCode !== null) {
        document.getElementById('codeEditor').value = cloudCode;
      }
    }
  }
});

// ===== GAME STATE =====
let state = {
  currentChallenge: -1,
  currentChapter: -1,
  viewMode: 'chapters',
  xp: 0,
  level: 1,
  streak: 0,
  dailyStreak: 0,
  lastActiveDate: '',
  completed: new Set(),
  achievements: new Set(),
  hintUsed: new Set()
};

// ===== INIT =====
function init() {
  loadState();
  renderSidebar();
  updateStats();

  document.getElementById('codeEditor').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runCode(); }
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.target;
      const start = ta.selectionStart, end = ta.selectionEnd;
      ta.value = ta.value.substring(0, start) + '    ' + ta.value.substring(end);
      ta.selectionStart = ta.selectionEnd = start + 4;
    }
  });

  // Auto-save code on typing (debounced)
  let saveTimer = null;
  document.getElementById('codeEditor').addEventListener('input', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (state.currentChallenge >= 0) {
        const ch = challenges[state.currentChallenge];
        const code = document.getElementById('codeEditor').value;
        if (code && code !== ch.starter) saveCode(ch.id, code);
      }
    }, 1000);
  });

  // Save code on page unload
  window.addEventListener('beforeunload', () => {
    if (state.currentChallenge >= 0) {
      const ch = challenges[state.currentChallenge];
      const code = document.getElementById('codeEditor').value;
      if (code && code !== ch.starter) saveCode(ch.id, code);
    }
  });

  document.getElementById('totalChallenges').textContent = '/' + challenges.length;

  if (state.completed.size > 0) {
    const first = challenges.findIndex(c => !state.completed.has(c.id));
    if (first >= 0) {
      const ch = challenges[first];
      showChapterChallenges(ch.chapter);
      selectChallenge(first);
    }
  } else {
    // New user: auto-expand first section so chapters are visible
    collapsedSections["Preparation Questions"] = false;
    showHero();
  }
}

function loadState() {
  try {
    const saved = localStorage.getItem('ronnyState');
    if (saved) {
      const s = JSON.parse(saved);
      state.xp = s.xp || 0;
      state.level = s.level || 1;
      state.streak = s.streak || 0;
      state.dailyStreak = s.dailyStreak || 0;
      state.lastActiveDate = s.lastActiveDate || '';
      state.completed = new Set(s.completed || []);
      state.achievements = new Set(s.achievements || []);
      state.hintUsed = new Set(s.hintUsed || []);
    }
  } catch(e) {}
}

function saveState() {
  saveStateToLocalStorage();
  if (currentUser) saveStateToFirestore(currentUser.uid);
}

// ===== SIDEBAR RENDERING =====
function getChapterChallenges(chapterId) {
  return challenges.filter(c => c.chapter === chapterId);
}

function getChapterProgress(chapterId) {
  const chs = getChapterChallenges(chapterId);
  const done = chs.filter(c => state.completed.has(c.id)).length;
  return { done, total: chs.length };
}

function getChapterPoints(chapterId) {
  const chs = getChapterChallenges(chapterId);
  return chs.filter(c => state.completed.has(c.id)).reduce((sum, c) => sum + DIFFICULTY_POINTS[c.difficulty], 0);
}

function renderSidebar() {
  if (state.viewMode === 'chapters') {
    renderChapterList();
  } else {
    renderChallengeList(state.currentChapter);
  }
}

// Track which sections are collapsed — default all to collapsed
const collapsedSections = { "Preparation Questions": true, "LC Exam Questions": true, "Mock Questions": true };

function toggleSection(section) {
  collapsedSections[section] = !collapsedSections[section];
  const header = document.querySelector(`.sidebar-section-header[data-section="${section}"]`);
  const body = document.querySelector(`.sidebar-section-body[data-section="${section}"]`);
  if (header && body) {
    header.classList.toggle('collapsed', collapsedSections[section]);
    body.classList.toggle('collapsed', collapsedSections[section]);
  }
}

// Ordered sections with icons
const ALL_SECTIONS = [
  { name: "Preparation Questions", icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#e75e8d" stroke-width="2"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  { name: "LC Exam Questions", icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#e75e8d" stroke-width="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  { name: "Mock Questions", icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#e75e8d" stroke-width="2"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" stroke-linecap="round" stroke-linejoin="round"/></svg>' }
];

function renderChapterList() {
  state.viewMode = 'chapters';
  const container = document.getElementById('sidebarContent');

  // Group chapters by section
  const grouped = {};
  ALL_SECTIONS.forEach(s => grouped[s.name] = []);
  CHAPTERS.forEach(ch => {
    const s = ch.section || 'Other';
    if (!grouped[s]) grouped[s] = [];
    grouped[s].push(ch);
  });

  let html = '';
  ALL_SECTIONS.forEach(({ name: section, icon }) => {
    const chapters = grouped[section];
    const isCollapsed = collapsedSections[section];
    const chCount = chapters.length;
    html += `<div class="sidebar-section-header ${isCollapsed ? 'collapsed' : ''}" data-section="${section}" onclick="toggleSection('${section}')">
      <span class="section-chevron">&#x25BE;</span>
      ${icon}
      <span class="section-label">${section}</span>
      <span class="section-count">${chCount > 0 ? chCount + ' ch' : ''}</span>
    </div>`;
    html += `<div class="sidebar-section-body ${isCollapsed ? 'collapsed' : ''}" data-section="${section}">`;
    if (chapters.length === 0) {
      html += `<div class="sidebar-section-empty">Coming soon...</div>`;
    } else {
      chapters.forEach(ch => {
        const prog = getChapterProgress(ch.id);
        const pts = getChapterPoints(ch.id);
        const pct = prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0;
        const allDone = prog.done === prog.total && prog.total > 0;
        html += `
          <div class="chapter-item ${allDone ? 'all-done' : ''}" onclick="showChapterChallenges(${ch.id})">
            <span class="ch-icon">${ch.icon}</span>
            <div class="ch-info">
              <div class="ch-title">${ch.section === 'Preparation Questions' ? 'Ch ' + ch.id + ': ' : ''}${ch.name}</div>
              <div class="ch-progress-row">
                <div class="ch-progress-bar"><div class="ch-progress-fill" style="width:${pct}%"></div></div>
                <span class="ch-progress-text">${prog.done}/${prog.total}</span>
              </div>
            </div>
            <span class="ch-points-earned">${pts > 0 ? pts + 'pt' : ''}</span>
          </div>`;
      });
    }
    html += `</div>`;
  });

  container.innerHTML = html;
}

function showChapterChallenges(chapterId) {
  state.currentChapter = chapterId;
  state.viewMode = 'challenges';
  renderChallengeList(chapterId);
}

function renderChallengeList(chapterId) {
  const container = document.getElementById('sidebarContent');
  const chapter = CHAPTERS.find(c => c.id === chapterId);
  const chs = getChapterChallenges(chapterId);
  const prog = getChapterProgress(chapterId);
  const pct = prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0;

  let html = `
    <button class="back-btn" onclick="renderChapterList()">&#x2190; Back to Chapters</button>
    <div class="ch-header-info">
      <div class="ch-header-title"><span class="ch-header-icon">${chapter.icon}</span>${chapter.section === 'Preparation Questions' ? 'Ch ' + chapter.id + ': ' : ''}${chapter.name}</div>
      <div class="ch-header-progress">
        <div class="ch-header-bar"><div class="ch-header-fill" style="width:${pct}%"></div></div>
        <span class="ch-header-text">${prog.done}/${prog.total}</span>
      </div>
    </div>
  `;

  html += chs.map(ch => {
    const globalIdx = challenges.indexOf(ch);
    const done = state.completed.has(ch.id);
    const hinted = state.hintUsed.has(ch.id);
    const active = globalIdx === state.currentChallenge;
    const stars = '\u2605'.repeat(ch.difficulty);
    const isBoss = ch.chapter === 15;
    const localNum = chs.indexOf(ch) + 1;
    const statusIcon = done ? (hinted ? '\u2714\uFE0F' : '\u2705') : (isBoss ? '\u{1F47E}' : '\u26AA');
    const statusStyle = done && hinted ? ' style="opacity:0.6"' : '';
    return `
      <div class="challenge-item ${active ? 'active' : ''} ${done ? 'completed' : ''}"
           onclick="selectChallenge(${globalIdx})">
        <span class="ci-num">#${localNum}</span>
        <span class="ci-status"${statusStyle}>${statusIcon}</span>
        <div class="ci-info">
          <div class="ci-name">${ch.name}</div>
          <div class="ci-diff"><span class="diff-star">${stars}</span></div>
        </div>
        <span class="ci-points">${done ? '\u2713' : DIFFICULTY_POINTS[ch.difficulty] + 'pt'}</span>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

function selectChallenge(index) {
  if (index < 0 || index >= challenges.length) return;

  // Save code from previous challenge before switching
  if (state.currentChallenge >= 0) {
    const prevCh = challenges[state.currentChallenge];
    const prevCode = document.getElementById('codeEditor').value;
    if (prevCode && prevCode !== prevCh.starter) {
      saveCode(prevCh.id, prevCode);
    }
  }

  hideHero();
  // Mobile view-switching: hide sidebar, show editor
  if (window.innerWidth <= 900) {
    document.querySelector('.sidebar').classList.add('mobile-hidden');
  }
  state.currentChallenge = index;
  const ch = challenges[index];

  if (state.currentChapter !== ch.chapter) {
    state.currentChapter = ch.chapter;
    state.viewMode = 'challenges';
  }
  renderChallengeList(ch.chapter);

  const isBoss = ch.chapter === 15;
  document.getElementById('challengeTitle').innerHTML =
    `${isBoss ? '\u{1F47E} ' : ''}${ch.name}`;
  const chapter = CHAPTERS.find(c => c.id === ch.chapter);
  const examBanner = chapter && chapter.examContext
    ? `<div class="exam-context"><span class="exam-tag">${chapter.name}</span><br>${chapter.examContext}</div>`
    : '';
  document.getElementById('challengeDesc').innerHTML = examBanner + ch.desc;
  document.getElementById('challengeHint').textContent = '';
  document.getElementById('challengePoints').textContent =
    state.completed.has(ch.id) ? '\u2705 COMPLETED' : '\u2B50 ' + DIFFICULTY_POINTS[ch.difficulty] + ' XP';

  // Load saved code or use starter
  const savedCode = loadCode(ch.id);
  document.getElementById('codeEditor').value = savedCode || ch.starter;
  clearConsole();

  // Async: try loading from Firestore if signed in
  if (currentUser) {
    loadCodeFromFirestore(currentUser.uid, ch.id).then(cloudCode => {
      if (cloudCode !== null && state.currentChallenge === index) {
        document.getElementById('codeEditor').value = cloudCode;
      }
    });
  }

  if (isBoss) {
    setSenseiMessage(SENSEI_MESSAGES.boss);
    setSenseiAvatar('\u{1F47E}');
  } else if (state.completed.has(ch.id)) {
    setSenseiMessage("Already completed! Try another!");
    setSenseiAvatar('\u{1F60E}');
  } else {
    setSenseiMessage(`${ch.name} - Give it a go!`);
    setSenseiAvatar('\u{1F40D}');
  }
}

function setSenseiMessage(msg) { document.getElementById('senseiSpeech').textContent = msg; }

const SENSEI_SVG = '<svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg"><polygon points="30,18 34,8 38,16 40,6 42,16 46,8 50,18" fill="#ffd700" stroke="#e6a800" stroke-width="1"/><ellipse cx="40" cy="26" rx="12" ry="10" fill="#2d2d2d" stroke="#e75e8d" stroke-width="2"/><circle cx="36" cy="24" r="2.5" fill="#e75e8d"/><circle cx="36" cy="23.5" r="1" fill="white"/><circle cx="44" cy="24" r="2.5" fill="#e75e8d"/><circle cx="44" cy="23.5" r="1" fill="white"/><path d="M40 32 L39 36 M40 32 L41 36" stroke="#e75e8d" stroke-width="1" stroke-linecap="round"/><rect x="30" y="35" width="20" height="9" rx="4.5" fill="#2d2d2d" stroke="#e75e8d" stroke-width="2"/><rect x="26" y="43" width="22" height="9" rx="4.5" fill="#2d2d2d" stroke="#e75e8d" stroke-width="2"/><rect x="30" y="51" width="24" height="9" rx="4.5" fill="#2d2d2d" stroke="#e75e8d" stroke-width="2"/><path d="M54 55 Q60 52 62 46" stroke="#e75e8d" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';

function setSenseiAvatar(emoji) {
  const el = document.getElementById('senseiAvatar');
  if (emoji === '\u{1F40D}') {
    el.innerHTML = SENSEI_SVG;
  } else {
    el.textContent = emoji;
  }
}

function showHero() {
  document.getElementById('heroSplash').style.display = 'flex';
  document.getElementById('challengeHeader').style.display = 'none';
  document.getElementById('editorConsoleSplit').style.display = 'none';
  document.getElementById('heroTotalChallenges').textContent = challenges.length;
  document.getElementById('heroXP').textContent = state.xp;
}

function hideHero() {
  document.getElementById('heroSplash').style.display = 'none';
  document.getElementById('challengeHeader').style.display = '';
  document.getElementById('editorConsoleSplit').style.display = '';
}

function saveCurrentCode() {
  if (state.currentChallenge >= 0) {
    const ch = challenges[state.currentChallenge];
    const code = document.getElementById('codeEditor').value;
    if (code && code !== ch.starter) saveCode(ch.id, code);
  }
}

function goHome() {
  saveCurrentCode();
  state.currentChallenge = -1;
  state.currentChapter = -1;
  state.viewMode = 'chapters';
  document.querySelector('.sidebar').classList.remove('mobile-hidden');
  showHero();
  renderChapterList();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function mobileBack() {
  saveCurrentCode();
  state.currentChallenge = -1;
  state.currentChapter = -1;
  state.viewMode = 'chapters';
  // Mobile view-switching: show sidebar again
  document.querySelector('.sidebar').classList.remove('mobile-hidden');
  renderChapterList();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function heroChooseChapter() {
  showChapterChallenges(1);
  selectChallenge(0);
}

function updateStats() {
  document.getElementById('totalXP').textContent = state.xp;
  document.getElementById('streakCount').textContent = state.dailyStreak;
  document.getElementById('completedCount').textContent = state.completed.size;
  document.getElementById('levelBadge').textContent = 'LV ' + state.level;

  const currentLevelXP = LEVEL_THRESHOLDS[state.level - 1] || 0;
  const nextLevelXP = LEVEL_THRESHOLDS[state.level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + 2000;
  const progress = ((state.xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;
  document.getElementById('xpBarFill').style.width = Math.min(100, Math.max(0, progress)) + '%';

  const rankIdx = Math.min(state.level - 1, RANKS.length - 1);
  document.getElementById('rankDisplay').textContent = 'Rank: ' + RANKS[rankIdx];

  const pct = challenges.length > 0 ? Math.round((state.completed.size / challenges.length) * 100) : 0;
  document.getElementById('progressPercent').textContent = pct + '%';
  document.getElementById('progressFill').style.width = pct + '%';

  saveState();
}

// ===== RUN CODE =====
function runCode() {
  if (state.currentChallenge < 0) return;
  const code = document.getElementById('codeEditor').value;
  const ch = challenges[state.currentChallenge];
  if (code && code !== ch.starter) saveCode(ch.id, code);
  clearConsole();
  let outputLines = [];

  // Show running state
  const runBtn = document.querySelector('.btn-run');
  const origText = runBtn.innerHTML;
  runBtn.innerHTML = '\u23F3 RUNNING...';
  runBtn.disabled = true;

  Sk.configure({
    output: (text) => { outputLines.push(text); },
    read: (x) => {
      if (Sk.builtinFiles === undefined || Sk.builtinFiles["files"][x] === undefined)
        throw "File not found: '" + x + "'";
      return Sk.builtinFiles["files"][x];
    },
    __future__: Sk.python3,
    execLimit: 5000
  });

  Sk.misceval.asyncToPromise(() => Sk.importMainWithBody("<stdin>", false, code, true))
    .then(() => {
      const output = outputLines.join('');
      addConsoleLine(output || '(no output)', 'output');
      checkAnswer(output);
    })
    .catch((err) => {
      const msg = err.toString();
      if (msg.includes('TimeLimitError') || msg.includes('time limit')) {
        addConsoleLine('Error: Program took too long (possible infinite loop). Limit: 5 seconds.', 'error');
      } else {
        addConsoleLine('Error: ' + msg, 'error');
      }
      setSenseiMessage(SENSEI_MESSAGES.wrong[Math.floor(Math.random() * SENSEI_MESSAGES.wrong.length)]);
      setSenseiAvatar('\u{1F630}');
      state.streak = 0;
      updateStats();
    })
    .finally(() => {
      runBtn.innerHTML = origText;
      runBtn.disabled = false;
    });
}

function updateDailyStreak() {
  const today = new Date().toISOString().slice(0, 10);
  if (state.lastActiveDate === today) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (state.lastActiveDate === yesterday) {
    state.dailyStreak++;
  } else {
    state.dailyStreak = 1;
  }
  state.lastActiveDate = today;
}

function checkAnswer(output) {
  const ch = challenges[state.currentChallenge];
  if (ch.check(output)) {
    if (!state.completed.has(ch.id)) {
      let bonus = state.hintUsed.has(ch.id) ? 0.5 : 1;
      let streakBonus = 1 + (state.streak * 0.1);
      let earned = Math.round(DIFFICULTY_POINTS[ch.difficulty] * bonus * streakBonus);

      state.xp += earned;
      state.streak++;
      state.completed.add(ch.id);
      updateDailyStreak();

      let newLevel = state.level;
      for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
        if (state.xp >= LEVEL_THRESHOLDS[i]) { newLevel = i + 1; break; }
      }
      if (newLevel > state.level) { state.level = newLevel; triggerLevelUp(); }

      updateStats();
      renderSidebar();

      addConsoleLine('\n\u2705 CORRECT! +' + earned + ' XP', 'success');
      showSuccessPopup(ch, earned);
      triggerSpeedLines();
      spawnParticles();

      setSenseiAvatar('\u{1F929}');
      document.getElementById('senseiAvatar').classList.add('celebrate');
      setTimeout(() => document.getElementById('senseiAvatar').classList.remove('celebrate'), 700);

      const msgs = SENSEI_MESSAGES.correct;
      setSenseiMessage(msgs[Math.floor(Math.random() * msgs.length)]);

      if (state.streak >= 5) { showCombo(state.streak); setSenseiMessage(SENSEI_MESSAGES.streak5); }
      else if (state.streak >= 3) { showCombo(state.streak); setSenseiMessage(SENSEI_MESSAGES.streak3); }

      checkAchievements();

      if (state.completed.size === challenges.length) {
        setTimeout(() => {
          setSenseiMessage(SENSEI_MESSAGES.allDone);
          setSenseiAvatar('\u{1F31F}');
          showAchievement('\u{1F31F}', 'Ronny Legend - All Challenges Complete!');
        }, 2000);
      }
    } else {
      addConsoleLine('\n\u2705 Correct! (already completed)', 'success');
      setSenseiMessage("Still got it!");
      setSenseiAvatar('\u{1F60E}');
    }
  } else {
    addConsoleLine('\n\u274C Output doesn\'t match expected result. Keep trying!', 'error');
    setSenseiMessage(SENSEI_MESSAGES.wrong[Math.floor(Math.random() * SENSEI_MESSAGES.wrong.length)]);
    setSenseiAvatar('\u{1F914}');
    state.streak = 0;
    updateStats();
  }
}

// ===== UI HELPERS =====
function addConsoleLine(text, cls) {
  const el = document.getElementById('consoleOutput');
  const line = document.createElement('div');
  line.className = 'console-line ' + (cls || '');
  line.textContent = text;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

function clearConsole() { document.getElementById('consoleOutput').innerHTML = ''; }

function resetCode() {
  if (state.currentChallenge < 0) return;
  if (!confirm('Reset code to starter? Your changes will be lost.')) return;
  const ch = challenges[state.currentChallenge];
  clearSavedCode(ch.id);
  document.getElementById('codeEditor').value = ch.starter;
  clearConsole();
}

function showHint() {
  if (state.currentChallenge < 0) return;
  const ch = challenges[state.currentChallenge];
  document.getElementById('challengeHint').textContent = '\u{1F4A1} Hint: ' + ch.hint;
  state.hintUsed.add(ch.id);
  setSenseiMessage("A hint costs half your XP for this challenge...");
  setSenseiAvatar('\u{1F9D0}');
  saveState();
}

function showSuccessPopup(ch, earned) {
  const overlay = document.getElementById('successOverlay');
  document.getElementById('successEmoji').textContent =
    ch.chapter === 15 ? '\u{1F3C6}' : ['\u{1F389}', '\u{1F38A}', '\u2728', '\u{1F4AB}', '\u{1F31F}'][Math.floor(Math.random()*5)];
  document.getElementById('successTitle').textContent =
    ch.chapter === 15 ? 'BOSS DEFEATED!' : 'CHALLENGE CLEAR!';
  document.getElementById('successPoints').textContent = '+' + earned + ' XP';
  document.getElementById('successMsg').textContent = ch.successMsg || 'Great work!';

  const chapterChallenges = getChapterChallenges(ch.chapter);
  const currentIdxInChapter = chapterChallenges.indexOf(ch);
  let nextCh = null;

  // Try next in same chapter
  for (let i = currentIdxInChapter + 1; i < chapterChallenges.length; i++) {
    if (!state.completed.has(chapterChallenges[i].id)) { nextCh = chapterChallenges[i]; break; }
  }
  // Try next chapter
  if (!nextCh) {
    for (let i = challenges.indexOf(ch) + 1; i < challenges.length; i++) {
      if (!state.completed.has(challenges[i].id)) { nextCh = challenges[i]; break; }
    }
  }
  // Try any incomplete
  if (!nextCh) { nextCh = challenges.find(c => !state.completed.has(c.id)); }

  const btnNext = document.getElementById('btnNext');
  if (nextCh) {
    btnNext.textContent = 'NEXT CHALLENGE \u27A1';
    btnNext.onclick = () => { hideOverlay(); selectChallenge(challenges.indexOf(nextCh)); };
  } else {
    btnNext.textContent = 'CELEBRATE! \u{1F389}';
    btnNext.onclick = () => { hideOverlay(); };
  }
  overlay.classList.add('active');
}

function hideOverlay() { document.getElementById('successOverlay').classList.remove('active'); }

function nextChallenge() {
  hideOverlay();
  const nextIdx = challenges.findIndex((c, i) => i > state.currentChallenge && !state.completed.has(c.id));
  if (nextIdx >= 0) selectChallenge(nextIdx);
}

function triggerSpeedLines() {
  // Speed lines removed in Cyborg restyling
}

function triggerLevelUp() {
  const flash = document.getElementById('levelUpFlash');
  flash.classList.add('active');
  setTimeout(() => flash.classList.remove('active'), 1000);
  showAchievement('\u2B50', 'LEVEL UP! Now Level ' + state.level + ' - ' + RANKS[Math.min(state.level-1, RANKS.length-1)]);
}

function showCombo(count) {
  const el = document.getElementById('comboDisplay');
  el.textContent = count + 'x COMBO! \u{1F525}';
  el.classList.add('active');
  setTimeout(() => el.classList.remove('active'), 2000);
}

function spawnParticles() {
  const emojis = ['\u2B50', '\u2728', '\u{1F31F}', '\u{1F4AB}', '\u{1F389}'];
  for (let i = 0; i < 8; i++) {
    setTimeout(() => {
      const p = document.createElement('div');
      p.className = 'particle';
      p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      p.style.left = (20 + Math.random() * 60) + '%';
      p.style.top = (30 + Math.random() * 40) + '%';
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1500);
    }, i * 100);
  }
}

function showAchievement(icon, name) {
  const toast = document.getElementById('achievementToast');
  document.getElementById('achIcon').textContent = icon;
  document.getElementById('achName').textContent = name;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function checkAchievements() {
  const checks = [
    { key: 'first', cond: state.completed.size >= 1, icon: '\u{1F331}', name: 'First Steps - Complete 1 challenge!' },
    { key: 'five', cond: state.completed.size >= 5, icon: '\u{1F3C5}', name: 'High Five - Complete 5 challenges!' },
    { key: 'ten', cond: state.completed.size >= 10, icon: '\u{1F396}\uFE0F', name: 'Double Digits - 10 challenges!' },
    { key: 'quarter', cond: state.completed.size >= Math.floor(challenges.length * 0.25), icon: '\u{1F4AA}', name: 'Quarter Way - 25% complete!' },
    { key: 'half', cond: state.completed.size >= Math.floor(challenges.length * 0.5), icon: '\u{1F947}', name: 'Halfway Hero - 50% complete!' },
    { key: 'century', cond: state.completed.size >= 100, icon: '\u{1F4AF}', name: 'Century Club - 100 challenges!' },
    { key: 'streak5', cond: state.streak >= 5, icon: '\u{1F525}', name: 'On Fire - 5 combo streak!' },
    { key: 'streak10', cond: state.streak >= 10, icon: '\u{1F30B}', name: 'Inferno - 10 combo streak!' },
    { key: 'daily3', cond: state.dailyStreak >= 3, icon: '\u{1F4C5}', name: '3 Day Streak!' },
    { key: 'daily7', cond: state.dailyStreak >= 7, icon: '\u{1F5D3}\uFE0F', name: 'Week Warrior - 7 day streak!' },
    { key: 'daily30', cond: state.dailyStreak >= 30, icon: '\u{1F3C6}', name: 'Monthly Master - 30 day streak!' },
    { key: 'boss1', cond: challenges.filter(c => c.chapter === 15 && state.completed.has(c.id)).length >= 1, icon: '\u{1F409}', name: 'Boss Slayer - Beat a boss!' },
    { key: 'bossAll', cond: challenges.filter(c => c.chapter === 15).every(c => state.completed.has(c.id)), icon: '\u{1F451}', name: 'Boss Master - All bosses beaten!' },
  ];

  // Check for perfect chapter (all done in any chapter)
  for (const chapter of CHAPTERS) {
    const key = 'perfect_ch_' + chapter.id;
    const chs = getChapterChallenges(chapter.id);
    if (chs.length > 0 && chs.every(c => state.completed.has(c.id)) && !state.achievements.has(key)) {
      state.achievements.add(key);
      setTimeout(() => showAchievement('\u{1F48E}', 'Perfect Chapter - ' + chapter.name + '!'), 1500);
    }
  }

  for (const check of checks) {
    if (check.cond && !state.achievements.has(check.key)) {
      state.achievements.add(check.key);
      setTimeout(() => showAchievement(check.icon, check.name), 1500);
    }
  }
  saveState();
}

// Start!
init();
