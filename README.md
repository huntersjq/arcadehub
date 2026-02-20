# Arcade Hub: HTML5 Mini Games

A premium collection of high-quality, lightning-fast HTML5 mini-games.

## Project Structure

- `index.html`: The central hub and game launcher.
- `style.css`: Global styles and design system.
- `main.js`: Hub logic and game management.
- `games/`: A directory containing individual mini-game projects.
- `games/shared/`: Core engine components (Vector, Input, Game base class) shared across all games.
- `.gemini/`: Storage for AI-assisted development context and conversation history.

## Games Framework

The project uses a unified ES6-based game engine located in `games/shared/engine.js`. This ensures:

- **Consistent Controls**: Unified Input handling for Keyboard/Mouse/Touch.
- **Optimized Loop**: Standardized `requestAnimationFrame` lifecycle.
- **Modular Development**: Each game is a standalone ES module that extends the core `Game` class.

## Development Goals

1.  **Aesthetics First**: Every game must feel premium, with modern UI/UX, smooth animations, and curated color palettes.
2.  **Performance**: Games should load instantly and run at a stable 60 FPS on both mobile and desktop.
3.  **Engagement**: Focused on "micro-gaming" experiences that are easy to pick up but hard to put down.

## Adding New Games

1.  Create a new folder under `games/`.
2.  Implement the game using standard web technologies (HTML/JS/CSS).
3.  Register the game in the root `main.js` to appear on the Arcade Hub launcher.
