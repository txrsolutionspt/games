To consolidate your repository's organization and documentation into a single, cohesive file, you can use the template below. You can save this as REPO_STRUCTURE.md in your root folder to serve as the master reference for your development.
# Repository Master Guide: Game Hub
This file serves as the architectural reference for the Game Hub repository. All browser-based games developed here follow a modular structure to ensure maintainability and scalability on GitHub Pages.
## 1. Directory Structure
```text
/game-hub
├── /assets          # Shared resources (audio, sprites, fonts)
├── /games           # Individual game directories
│   ├── /game_name_1
│   │   ├── index.html
│   │   ├── style.css
│   │   └── game.js
│   └── /game_name_2
│       ├── index.html
│       ├── style.css
│       └── game.js
├── /lib             # Shared JavaScript classes/utils (e.g., collision.js)
├── README.md        # Project landing page documentation
└── REPO_STRUCTURE.md# This master architectural guide

```
## 2. Technical Standards
 * **Hosting:** GitHub Pages (Public).
 * **Deployment Path:** [https://txrsolutionspt.github.io/games/](https://txrsolutionspt.github.io/games/)
 * **Rendering Engine:** HTML5 Canvas API.
 * **Responsiveness:** All style.css files must utilize CSS Media Queries to adapt to mobile/desktop screens.
 * **Asset Loading:** Prefer WebP format for images and MP3 for audio to minimize load times.
## 3. Development Workflow
 1. **Initialize Game:** Create a new folder under /games.
 2. **Boilerplate:** Copy the standard index.html structure to ensure the <canvas> element and script links are consistent.
 3. **Local Testing:** Use a local server (like VS Code's "Live Server" extension) to test responsiveness before pushing.
 4. **Version Control:** Commit changes to the main branch. GitHub Pages will trigger an automatic redeploy.
## 4. Maintenance
 * **Shared Assets:** Use the /assets directory for items reused across multiple games.
 * **Shared Logic:** If you find yourself writing the same code (e.g., a "Game Loop" or "Input Listener"), move that code to the /lib folder and import it into your individual game scripts.
*This document is managed by the owner of the repository.*
