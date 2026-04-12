/**
 * Stellar Speller — Word Scramble Game
 * Unscramble words against a timer. Streaks earn bonus points.
 */

const WORDS = [
  // 4-letter
  "star", "moon", "beam", "glow", "dust", "void", "flux", "wave", "core", "nova",
  "atom", "fire", "dark", "wind", "dawn", "dusk", "ring", "orbs", "haze", "bolt",
  // 5-letter
  "orbit", "comet", "flare", "solar", "lunar", "quark", "nebula", "prism", "spark",
  "blaze", "storm", "light", "force", "pulse", "swift", "shine", "space", "phase",
  "power", "drift", "gleam", "surge", "chase", "burst", "crash", "flame", "frost",
  // 6-letter
  "galaxy", "planet", "meteor", "photon", "quasar", "cosmic", "plasma", "fusion",
  "zenith", "vortex", "astral", "cipher", "matrix", "vector", "energy", "pulsar",
  "radial", "binary", "charge", "shield", "frozen", "blazer", "ignite", "strive",
  // 7-letter
  "neutron", "eclipse", "stellar", "gravity", "horizon", "nucleus", "antimag",
  "quantum", "protons", "reactor", "thermal", "voltage", "radiant", "thunder",
  "crimson", "crystal", "phantom", "diamond", "cluster", "capture",
];

const HIGHSCORE_KEY = "word_scramble_highscores";
const TIME_PER_WORD_BASE = 15; // seconds
const TIME_PER_LETTER = 1.5;

class StellarSpeller {
  constructor() {
    this.score = 0;
    this.level = 1;
    this.streak = 0;
    this.bestStreak = 0;
    this.lives = 3;
    this.wordsSolved = 0;
    this.currentWord = "";
    this.scrambled = "";
    this.answer = [];
    this.usedIndices = new Set();
    this.usedWords = new Set();
    this.timeLeft = 0;
    this.maxTime = 0;
    this.timerInterval = null;
    this.playing = false;

    document.getElementById("playBtn").addEventListener("click", () => this.startGame());
    document.getElementById("retryBtn").addEventListener("click", () => this.startGame());
    document.getElementById("clearBtn").addEventListener("click", () => this.clearAnswer());
    document.getElementById("skipBtn").addEventListener("click", () => this.skipWord());

    document.addEventListener("keydown", (e) => {
      if (!this.playing) return;
      if (e.key === "Backspace") {
        this.removeLastLetter();
      } else if (e.key === "Enter") {
        this.submitAnswer();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        this.typeLetter(e.key.toLowerCase());
      }
    });
  }

  startGame() {
    this.score = 0;
    this.level = 1;
    this.streak = 0;
    this.bestStreak = 0;
    this.lives = 3;
    this.wordsSolved = 0;
    this.usedWords.clear();
    this.playing = true;

    document.getElementById("startScreen").style.display = "none";
    document.getElementById("gameOverScreen").style.display = "none";
    document.getElementById("gameUI").style.display = "flex";

    this.nextWord();
    this.updateHUD();
  }

  getWordPool() {
    const minLen = Math.min(4 + Math.floor(this.level / 3), 7);
    const maxLen = Math.min(minLen + 2, 8);
    return WORDS.filter(
      (w) => w.length >= minLen && w.length <= maxLen && !this.usedWords.has(w)
    );
  }

  nextWord() {
    let pool = this.getWordPool();
    if (pool.length === 0) {
      this.usedWords.clear();
      pool = this.getWordPool();
    }
    this.currentWord = pool[Math.floor(Math.random() * pool.length)];
    this.usedWords.add(this.currentWord);
    this.scrambled = this.scrambleWord(this.currentWord);
    this.answer = [];
    this.usedIndices.clear();

    this.maxTime = TIME_PER_WORD_BASE + this.currentWord.length * TIME_PER_LETTER - this.level * 0.5;
    this.maxTime = Math.max(this.maxTime, 5);
    this.timeLeft = this.maxTime;

    document.getElementById("scrambled").textContent = `${this.currentWord.length} letters`;
    this.renderTiles();
    this.renderAnswer();
    this.startTimer();
    this.showFeedback("");
  }

  scrambleWord(word) {
    const arr = word.split("");
    // Fisher-Yates, ensure it's different from original
    for (let attempt = 0; attempt < 20; attempt++) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      if (arr.join("") !== word) break;
    }
    return arr.join("");
  }

  renderTiles() {
    const container = document.getElementById("tiles");
    container.textContent = "";
    const letters = this.scrambled.split("");
    letters.forEach((letter, i) => {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.textContent = letter.toUpperCase();
      tile.dataset.index = i;
      tile.addEventListener("click", () => this.selectTile(i));
      container.appendChild(tile);
    });
  }

  renderAnswer() {
    const container = document.getElementById("answerArea");
    container.textContent = "";
    for (let i = 0; i < this.currentWord.length; i++) {
      const slot = document.createElement("div");
      slot.className = "answer-slot" + (i < this.answer.length ? " filled" : "");
      slot.textContent = i < this.answer.length ? this.answer[i].toUpperCase() : "";
      container.appendChild(slot);
    }
  }

  selectTile(index) {
    if (!this.playing || this.usedIndices.has(index)) return;
    this.usedIndices.add(index);
    this.answer.push(this.scrambled[index]);
    this.renderAnswer();

    // Mark tile as used
    const tiles = document.querySelectorAll("#tiles .tile");
    tiles[index].classList.add("used");

    // Auto-submit when all letters placed
    if (this.answer.length === this.currentWord.length) {
      setTimeout(() => this.submitAnswer(), 200);
    }
  }

  typeLetter(letter) {
    // Find first unused tile with this letter
    const letters = this.scrambled.split("");
    for (let i = 0; i < letters.length; i++) {
      if (!this.usedIndices.has(i) && letters[i] === letter) {
        this.selectTile(i);
        return;
      }
    }
  }

  removeLastLetter() {
    if (this.answer.length === 0) return;
    this.answer.pop();
    // Find the last used index and un-use it
    const lastUsed = Array.from(this.usedIndices).pop();
    if (lastUsed !== undefined) {
      this.usedIndices.delete(lastUsed);
      const tiles = document.querySelectorAll("#tiles .tile");
      tiles[lastUsed].classList.remove("used");
    }
    this.renderAnswer();
  }

  clearAnswer() {
    this.answer = [];
    this.usedIndices.clear();
    const tiles = document.querySelectorAll("#tiles .tile");
    tiles.forEach((t) => t.classList.remove("used"));
    this.renderAnswer();
  }

  submitAnswer() {
    if (this.answer.length !== this.currentWord.length) return;
    const guess = this.answer.join("");

    if (guess === this.currentWord) {
      this.handleCorrect();
    } else {
      this.handleWrong();
    }
  }

  handleCorrect() {
    this.stopTimer();
    this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    this.wordsSolved++;

    // Score: base + length bonus + streak bonus + time bonus
    const basePoints = 10;
    const lengthBonus = this.currentWord.length * 5;
    const streakBonus = Math.min(this.streak, 10) * 5;
    const timeBonus = Math.floor(this.timeLeft * 2);
    const points = basePoints + lengthBonus + streakBonus + timeBonus;
    this.score += points;

    // Level up every 5 words
    if (this.wordsSolved % 5 === 0) {
      this.level++;
    }

    this.showFeedback(`+${points} pts`, "correct");
    this.flashAnswer("correct");
    this.updateHUD();

    setTimeout(() => this.nextWord(), 800);
  }

  handleWrong() {
    this.streak = 0;
    this.showFeedback(`Nope! It was "${this.currentWord.toUpperCase()}"`, "wrong");
    this.flashAnswer("wrong");
    this.updateHUD();

    this.clearAnswer();
  }

  skipWord() {
    if (!this.playing) return;
    this.stopTimer();
    this.streak = 0;
    this.lives--;
    this.showFeedback(`Skipped! "${this.currentWord.toUpperCase()}"`, "wrong");
    this.updateHUD();

    if (this.lives <= 0) {
      setTimeout(() => this.gameOver(), 600);
    } else {
      setTimeout(() => this.nextWord(), 800);
    }
  }

  flashAnswer(type) {
    const slots = document.querySelectorAll("#answerArea .answer-slot");
    slots.forEach((s) => s.classList.add(type));
  }

  showFeedback(text, type) {
    const el = document.getElementById("feedback");
    el.textContent = text || "\u00A0";
    el.className = "feedback" + (type ? ` ${type}` : "");
  }

  startTimer() {
    this.stopTimer();
    const tick = () => {
      this.timeLeft -= 0.1;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.onTimeUp();
      }
      this.updateTimerBar();
    };
    this.timerInterval = setInterval(tick, 100);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  onTimeUp() {
    this.stopTimer();
    this.streak = 0;
    this.lives--;
    this.showFeedback(`Time's up! "${this.currentWord.toUpperCase()}"`, "wrong");
    this.updateHUD();

    if (this.lives <= 0) {
      setTimeout(() => this.gameOver(), 600);
    } else {
      setTimeout(() => this.nextWord(), 1000);
    }
  }

  updateTimerBar() {
    const pct = Math.max(0, (this.timeLeft / this.maxTime) * 100);
    document.getElementById("timerFill").style.width = pct + "%";
  }

  updateHUD() {
    document.getElementById("score").textContent = this.score;
    document.getElementById("level").textContent = this.level;
    document.getElementById("streak").textContent = this.streak;
    document.getElementById("lives").textContent = "\u2764\uFE0F".repeat(Math.max(0, this.lives));
  }

  gameOver() {
    this.playing = false;
    this.stopTimer();

    const coinsEarned = Math.floor(this.score / 50);
    if (window.ArcadeHub) window.ArcadeHub.addCoins(coinsEarned);
    this.saveHighScore();

    document.getElementById("gameUI").style.display = "none";
    document.getElementById("gameOverScreen").style.display = "flex";
    document.getElementById("finalScore").textContent = this.score;
    document.getElementById("wordsSolved").textContent = this.wordsSolved;
    document.getElementById("bestStreak").textContent = this.bestStreak;
  }

  saveHighScore() {
    let scores = [];
    try {
      scores = JSON.parse(localStorage.getItem(HIGHSCORE_KEY) || "[]");
    } catch (_) {
      scores = [];
    }
    scores.push({
      score: this.score,
      words: this.wordsSolved,
      date: new Date().toLocaleDateString(),
    });
    scores.sort((a, b) => b.score - a.score);
    localStorage.setItem(HIGHSCORE_KEY, JSON.stringify(scores.slice(0, 5)));
  }
}

new StellarSpeller();
