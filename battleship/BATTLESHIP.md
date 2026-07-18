# ⚓ Battleship Game

A two-player turn-based naval battle game for playing on the same phone or computer screen.

## How to Play

### 1. Game Setup

Open `battleship.html` in your web browser. No installation or internet connection needed!

### 2. Placement Phase

Each player takes turns placing their fleet of 5 ships on a 10×10 grid:

- **Battleship** (4 cells)
- **Cruiser 1** (3 cells)
- **Cruiser 2** (3 cells)
- **Destroyer 1** (2 cells)
- **Destroyer 2** (2 cells)

**How to place ships:**
- Click on any cell to start placing a ship
- The game automatically tries horizontal placement first, then vertical
- A progress tracker shows how many ships you've placed
- Use **🎲 Random Placement** to auto-place all remaining ships
- Use **🗑️ Clear Board** to reset and try again
- Click **✓ Ready** when all ships are placed

After Player 1 finishes placement, Player 2 places their ships. The game will prompt you to pass the phone/device to the next player.

### 3. Battle Phase

Now the fun begins! Both players see:
- **Player 1's Board** (left side) - ships hidden
- **Player 2's Board** (right side) - ships hidden

**Game Rules:**
- **Player 1** attacks Player 2's board (right)
- **Player 2** attacks Player 1's board (left)
- Players take turns guessing coordinates on the opponent's board
- Only the current player can click to make shots
- After each shot, pass the phone to the opponent

**Shot Results:**
- **✕ (Hit)** - Red cell, you hit an opponent's ship!
- **○ (Miss)** - Blue cell, the shot missed

**Winning:**
- Sink all opponent ships to win
- When a ship is completely hit, you'll see "🎯 Ship Sunk!" message
- First player to sink all opponent ships wins!

### 4. Game Statistics

During battle, track your performance:
- **Hits** - Number of successful shots
- **Misses** - Number of failed shots
- **Your Ships Hit** - How many opponent ships you've damaged
- **Ships Remaining** - How many opponent ships are still afloat

## Features

✅ **Hidden Information** - Ships stay hidden until hit  
✅ **Turn-Based Gameplay** - Take turns on the same screen  
✅ **Player Switching** - Modal prompts guide you to pass the phone  
✅ **Ship Management** - Track ship health and remaining vessels  
✅ **Responsive Design** - Works on mobile, tablet, and desktop  
✅ **Visual Feedback** - Color-coded hits, misses, and ship states  
✅ **Auto Ship Placement** - Random placement option for quick setup  

## Game Elements

### Ships
- Each ship occupies consecutive cells horizontally or vertically
- Ships cannot overlap
- Ships cannot touch each other (diagonal is allowed during placement)

### Board Grid
- 10×10 grid with columns labeled A-J and rows labeled 1-10
- Total 100 cells per player board
- Coordinates range from A1 to J10

### Colors
- 🔵 **Blue** - Empty water, undiscovered cells
- 🟢 **Green** - Your ship (placement phase only)
- 🔴 **Red** - Hit ship
- 🔵 **Light Blue** - Missed shot
- ⚫ **Dark Red** - Sunk ship

## Tips for Winning

1. **Strategic Placement** - Place ships far apart so opponent can't predict your positions
2. **Pattern Hunting** - Once you hit a ship, concentrate shots around the hit area
3. **Spread Your Shots** - Early on, spread shots across the board to find ships
4. **Track Shots** - Remember where you've already guessed to avoid wasting shots
5. **Listen for Patterns** - Your opponent's reactions might give hints (just kidding!)

## Technical Details

- **File:** `battleship.html`
- **Browser:** Works in any modern web browser (Chrome, Firefox, Safari, Edge)
- **Size:** 5 ships total per player
- **Board:** 10×10 grid (100 cells)
- **Players:** 2 (local, same screen)
- **Offline:** Fully playable without internet connection

## Starting a New Game

Click the **🔄 Play Again** button after someone wins, or refresh your browser page to reset the game state.

Enjoy! ⚓🎮
