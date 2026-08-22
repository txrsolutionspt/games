The Last Little Farm

Product Requirements Document

Product: The Last Little Farm
Genre: 2D action-platformer / exploration / light farming
Target Platforms: Web, Android, iOS
Primary Input: Touch controls on mobile, keyboard/gamepad on desktop
Target Audience: Casual players, families, platformer fans, indie-game players
Business Model: Premium or free-to-play prototype; MVP should avoid monetisation complexity
Visual Style: Charming 2D pixel art / hand-drawn pixel-inspired art
Perspective: 2D side-scrolling

---

1. Product Vision

The Last Little Farm is a charming 2D adventure game where the player tries to keep a small family farm alive while the surrounding world is progressively affected by extreme environmental events.

The player starts with almost nothing:

- A small house
- A few crops
- A handful of chickens
- A well
- Basic tools
- A small patch of land

The world gradually becomes more hostile.

The player must:

«Explore → Collect → Farm → Protect → Upgrade → Restore»

The long-term objective is not simply to survive.

The player must gradually restore the surrounding ecosystem and transform the little farm from a fragile settlement into a thriving sanctuary.

---

2. Product Goals

Primary Goals

1. Deliver an immediately understandable and enjoyable 2D game.
2. Make movement and interaction feel excellent on smartphones.
3. Create a strong emotional connection between the player and the farm.
4. Combine platforming with light farming and exploration.
5. Introduce environmental challenges as gameplay mechanics rather than purely narrative elements.
6. Provide meaningful progression without excessive complexity.
7. Build the game so additional worlds, animals, crops and events can be added later.

Secondary Goals

- Support desktop/web play.
- Make the game visually recognisable from screenshots.
- Keep the first version achievable by a small development team.
- Build a technical foundation suitable for future content.

---

3. Product Principles

Simple to understand

A new player should understand the basic gameplay within the first few minutes.

Easy to control

The game must work particularly well on touchscreens.

Meaningful progression

The player should constantly feel that the farm and character are improving.

Charming rather than depressing

Although the game deals with environmental disasters, the tone should remain hopeful, funny and accessible.

Gameplay first

Environmental themes should create interesting gameplay rather than becoming lectures.

Small world, meaningful details

The game should initially focus on a small number of highly polished mechanics rather than a huge world.

---

4. Core Gameplay Loop

The primary gameplay loop is:

        ┌──────────────┐
        │    FARM      │
        └──────┬───────┘
               │
               ▼
        ┌──────────────┐
        │   EXPLORE    │
        └──────┬───────┘
               │
               ▼
        ┌──────────────┐
        │   COLLECT    │
        └──────┬───────┘
               │
               ▼
        ┌──────────────┐
        │    BUILD     │
        └──────┬───────┘
               │
               ▼
        ┌──────────────┐
        │   PROTECT    │
        └──────┬───────┘
               │
               ▼
        ┌──────────────┐
        │    RESTORE   │
        └──────┬───────┘
               │
               └──────────► Explore

---

5. Player Fantasy

The player should feel like:

«"This tiny farm is mine, and I'm going to keep it alive."»

The player should become emotionally attached to:

- The farm
- Their animals
- Crops
- The player character
- NPCs
- The surrounding environment

The world should visibly improve as the player progresses.

---

6. Target Player Experience

The game should provide the following emotional progression:

Beginning

"Oh no, this place is barely surviving."

Early game

"I need to gather resources and protect my farm."

Mid game

"I'm getting better at this. My farm is growing."

Later game

"I can actually change this environment."

End game

"I transformed this tiny farm into a thriving ecosystem."

---

7. Game Structure

The game is divided into regions.

Region 1 — The Little Farm

Tutorial and starting area.

Features:

- Farm
- House
- Well
- Chicken coop
- Small crop field
- Forest
- River
- Basic caves

Primary hazards:

- Heat
- Small storms
- Foxes
- Pests

Purpose:

Teach the core mechanics.

---

8. Region 2 — The Dry Forest

The player discovers that the nearby forest is dying.

Features:

- Dry forest
- Abandoned ranger station
- Underground water source
- Wildlife
- Fire hazards

Gameplay:

- Find water
- Repair irrigation
- Rescue animals
- Prevent small fires
- Replant trees

Major event:

First major drought.

---

9. Region 3 — The Floodlands

Extreme rainfall causes the river to overflow.

Features:

- Flooded forest
- Broken bridges
- Floating platforms
- Underground areas
- New aquatic wildlife

Gameplay mechanics:

- Swimming
- Floating objects
- Water currents
- Building temporary bridges

Major event:

The Great Flood.

---

10. Region 4 — The Burnt Valley

A wildfire devastates the region.

Features:

- Burnt forest
- Smoke
- Fire
- Ash-covered land
- Wildlife rescue areas

Gameplay:

- Fire propagation
- Water management
- Firebreak construction
- Animal rescue
- Reforestation

Major event:

The Great Fire.

---

11. Region 5 — The Stormlands

The player faces increasingly powerful storms.

Features:

- Strong wind
- Lightning
- Rain
- Damaged infrastructure
- Dangerous cliffs

Gameplay:

- Wind affects movement
- Lightning hazards
- Build shelters
- Protect animals
- Repair electrical infrastructure

Major event:

The Great Storm.

---

12. Final Region — The Sanctuary

The player reaches the final stage of restoration.

The environment begins to recover.

Features:

- Green forests
- Wildlife
- Rivers
- Healthy crops
- New animals
- Rare plants

The final challenge is not defeating a traditional villain.

Instead, the player must survive one final extreme environmental event while protecting everything they have built.

The ending depends on how much of the ecosystem the player restored.

---

13. Player Character

The player controls a young farmer/adventurer.

The character should be intentionally generic enough for players to identify with them.

Possible customisation:

- Hair
- Skin/clothing colours
- Hat
- Boots
- Backpack
- Farm outfit

Customization is not required for MVP.

---

14. Core Movement

The player can:

- Walk
- Run
- Jump
- Double jump
- Climb
- Swim
- Crouch
- Push objects
- Pick up objects

Potential later abilities:

- Glide
- Grappling hook
- Water dash
- Vine swing

---

15. Combat

Combat should remain simple.

The player is not a warrior.

Possible tools:

- Wooden stick
- Hoe
- Water bucket
- Slingshot
- Egg launcher
- Seed bomb

Combat should feel playful rather than violent.

Enemies should generally be knocked away, scared off or otherwise neutralised rather than killed graphically.

---

16. Enemies

Fox

Threatens chickens.

Behaviour:

- Patrols
- Chases chickens
- Runs away when attacked

Rats

Attack crops.

Behaviour:

- Appear at night
- Eat crops
- Hide underground

Locusts

Attack fields.

Behaviour:

- Swarm
- Move horizontally
- Can be deterred using certain crops or structures

Wild Boar

Can destroy crops and structures.

Storm Creatures

Optional fantasy elements introduced later.

---

17. Animals

Animals are important emotionally and mechanically.

Initial animals:

- Chickens
- Cows
- Sheep
- Goats

Later:

- Ducks
- Bees
- Rabbits
- Birds
- Fish

Animals can provide:

- Eggs
- Milk
- Wool
- Fertiliser
- Honey

Animals should have simple personality traits.

Example:

Hen #17
Name: Daisy
Personality: Curious
Favourite food: Corn
Relationship: Happy

The player should be able to name important animals.

---

18. Farming

Farming should remain deliberately simple.

Basic cycle:

Prepare soil
    ↓
Plant seed
    ↓
Water
    ↓
Protect
    ↓
Grow
    ↓
Harvest

Crops:

MVP

- Wheat
- Corn
- Carrot
- Tomato
- Potato

Later

- Sunflower
- Pumpkin
- Strawberry
- Rice
- Medicinal plants
- Rare restoration plants

---

19. Water System

Water is one of the central resources.

Sources:

- Well
- River
- Rain
- Underground water
- Water tanks

Uses:

- Crops
- Animals
- Fire prevention
- Construction
- Ecosystem restoration

Water availability changes depending on the current environmental conditions.

---

20. Environmental System

The world should have a simplified environmental state.

Example:

Environment Health: 42%

Water:       35%
Vegetation:  51%
Wildlife:    38%
Soil:        47%
Air Quality: 72%

As the player restores the environment, these values improve.

The exact numerical values do not necessarily need to be exposed to the player.

A visual representation may be preferable.

---

21. Dynamic Weather

Weather should directly affect gameplay.

Sunny

- Crops grow
- Water consumption increases

Rain

- Crops automatically receive water
- Rivers rise

Heatwave

- Water consumption increases
- Crops can die
- Animals need additional care

Storm

- Wind affects movement
- Structures can be damaged
- Lightning can start fires

Drought

- Water becomes scarce
- Wildlife migrates

Flood

- Water levels rise
- Certain areas become inaccessible
- New areas become accessible by boat/swimming

---

22. Fire System

Fire is an important gameplay mechanic.

Fire can spread between:

- Grass
- Trees
- Crops
- Wooden structures

Fire propagation should depend on:

- Wind
- Vegetation
- Moisture
- Firebreaks
- Player intervention

The player can fight fire using:

- Buckets
- Water pumps
- Irrigation
- Firebreaks

---

23. Restoration System

The most important long-term progression system is restoration.

The player can:

- Plant trees
- Restore rivers
- Clean polluted areas
- Rebuild habitats
- Introduce animals
- Restore soil
- Create wetlands
- Protect biodiversity

The environment visibly changes.

Example:

BEFORE

Dead trees
Dry ground
No animals
Brown river


AFTER

Green trees
Flowers
Birds
Fish
Healthy river

This visual transformation is one of the game's main rewards.

---

24. Building

The player can construct farm improvements.

MVP:

- Chicken coop
- Barn
- Water tank
- Storage shed
- Fence
- Irrigation
- Windmill
- Solar panel

Later:

- Greenhouse
- Workshop
- Beehive
- Water treatment plant
- Weather station
- Forest nursery

---

25. Resource System

Core resources:

- Wood
- Stone
- Water
- Seeds
- Food
- Metal
- Energy

Avoid creating dozens of resource types.

The MVP should focus on 5–7 resources maximum.

---

26. Exploration

The world contains:

- Caves
- Forests
- Rivers
- Ruins
- Abandoned buildings
- Hidden areas
- Collectibles
- NPC settlements

Exploration should reward curiosity.

Possible rewards:

- Seeds
- Tools
- Building materials
- Animal companions
- Story items
- Cosmetic items

---

27. NPCs

The player encounters people who stayed behind.

Example NPCs:

Maya — Engineer

Helps repair machinery.

Tom — Ranger

Teaches the player about wildlife.

Ana — Farmer

Provides farming knowledge.

Leo — Inventor

Creates new tools.

NPCs can unlock:

- New buildings
- New abilities
- New regions
- Side quests

---

28. Quest System

Keep quests simple.

Examples:

«"Bring 5 buckets of water."»

«"Rescue three chickens."»

«"Plant 10 trees."»

«"Repair the bridge."»

«"Find the missing ranger."»

«"Protect the farm during the storm."»

Quest types:

- Collection
- Exploration
- Repair
- Rescue
- Farming
- Protection
- Restoration

---

29. Story

The story should be environmental but optimistic.

The world is experiencing increasingly extreme weather.

Nobody knows exactly how bad it will become.

The player's family has left the farm.

The protagonist stays behind to protect it.

Over time, the player discovers that several communities are trying to survive independently.

The player gradually connects them.

The farm becomes a small centre of recovery.

The final message is:

«Small actions can create large changes.»

---

30. Progression

Progression has four dimensions.

Character

- Movement abilities
- Tools
- Equipment

Farm

- Buildings
- Animals
- Crops
- Production

World

- Restored areas
- Wildlife
- Water systems
- Forests

Story

- New regions
- NPCs
- Quests
- Events

---

31. Controls

Mobile

Controls must be designed specifically for touch.

Suggested layout:

                       [ACTION]
               [JUMP]     [USE]

 [LEFT] [RIGHT]      [TOOL]

Movement controls should use large touch targets.

Buttons should:

- Have generous hit areas
- Support holding
- Provide visual feedback
- Avoid covering important gameplay
- Adapt to different aspect ratios

The player should be able to reposition controls.

---

32. Desktop Controls

Default:

A / Left Arrow    Move left
D / Right Arrow   Move right
Space             Jump
E                 Interact
F                 Tool
ESC               Menu

Gamepad support should be considered from the beginning even if not included in MVP.

---

33. Mobile UX Requirements

The game must support:

- Portrait-independent landscape mode
- Multiple screen resolutions
- Safe areas/notches
- Touch feedback
- Pause when application loses focus
- Save/resume
- Adjustable UI size
- Adjustable UI opacity
- Left/right-handed control layouts

Target:

Playable comfortably using only two thumbs.

---

34. Save System

The game should automatically save.

Save triggers:

- Entering farm
- Completing quests
- Building structures
- Harvesting major resources
- Completing levels
- Before major environmental events

At least:

- One automatic save
- One manual save

Cloud saves can be added later.

---

35. Game Sessions

The game should support short sessions.

Target:

5–15 minutes

A player should be able to:

- Complete a small quest
- Harvest crops
- Explore a small area
- Upgrade something
- Make meaningful progress

without needing a 60-minute session.

---

36. Accessibility

MVP should include:

- Adjustable text size
- High-contrast UI option
- Remappable controls where practical
- Reduced screen shake
- Reduced flashing effects
- Adjustable audio
- Subtitles
- Simple control mode

---

37. Art Direction

Desired style:

Warm, colourful, charming 2D pixel art.

The contrast between environmental disaster and recovery should be visually strong.

Example:

Damaged environment

- Brown
- Grey
- Dust
- Sparse vegetation

Restored environment

- Green
- Bright flowers
- Wildlife
- Clean water
- Animated vegetation

The player's farm should always remain visually distinctive.

---

38. Audio

Music should evolve with the environment.

Early game:

- Simple acoustic instruments
- Calm atmosphere

Disaster:

- More dramatic percussion
- Wind
- Thunder
- Fire

Restoration:

- Birds
- Water
- Insects
- Richer music

The environment itself should create much of the soundscape.

---

39. MVP Definition

The first playable version should be deliberately small.

MVP World

One farm + one surrounding region.

MVP Character

- Walk
- Run
- Jump
- Interact
- Basic tool

MVP Farming

- 3 crops
- Plant
- Water
- Harvest

MVP Animals

- Chickens

MVP Resources

- Wood
- Stone
- Water
- Seeds

MVP Building

- Chicken coop
- Storage
- Water tank
- Fence

MVP Exploration

- Forest
- River
- Cave

MVP Hazards

- Heatwave
- Foxes
- Small fire

MVP Restoration

- Plant trees
- Restore water source
- Rescue animals

MVP Story

Approximately:

30–60 minutes of playable content.

---

40. MVP Success Criteria

The MVP is successful if a new player can:

1. Start the game without instructions.
2. Understand movement within 30 seconds.
3. Understand farming within 3 minutes.
4. Understand exploration within 5 minutes.
5. Experience the first environmental event.
6. Understand that their actions affect the environment.
7. Upgrade the farm.
8. Restore at least one part of the environment.
9. Finish a complete gameplay loop.
10. Want to continue playing.

---

41. Vertical Slice

Before building the complete game, create one polished vertical slice.

The vertical slice should contain:

- Farm
- Forest
- River
- Cave
- Player movement
- Farming
- Chicken
- Fox
- Water
- One environmental event
- One restoration mechanic
- One NPC
- One quest
- One farm upgrade
- Mobile controls
- Save/load

The vertical slice should feel like a small but complete game.

---

42. Non-Goals for MVP

Do not initially implement:

- Multiplayer
- Online economy
- Complex crafting
- Procedural worlds
- Character classes
- Skill trees
- Large inventory systems
- Complex NPC schedules
- Hundreds of crops
- Dozens of animals
- In-game purchases
- PvP
- Complex combat

These can distract from the core experience.

---

43. Technical Product Requirements

The game architecture should support:

- Deterministic gameplay where practical
- Data-driven game objects
- Separate gameplay and rendering systems
- Configurable levels
- Save-game versioning
- Resolution-independent UI
- Controller abstraction
- Touch input abstraction
- Audio abstraction
- Event-driven environmental systems

Game systems should avoid hard-coding content wherever possible.

Example:

Crop Definition
    name
    growth_time
    water_requirement
    seed_cost
    harvest_item

This allows new crops to be added without rewriting farming logic.

---

44. Platform Strategy

Phase 1

Desktop/Web development.

Purpose:

- Faster iteration
- Easier debugging
- Easier automated testing

Phase 2

Android.

Focus on:

- Touch controls
- Performance
- Screen sizes
- Save/resume

Phase 3

iOS.

Validate:

- Performance
- Touch interaction
- App lifecycle
- Save behaviour

---

45. Performance Targets

Target hardware should include mid-range smartphones.

Goals:

- Stable 60 FPS where hardware permits
- Fast initial loading
- Minimal memory usage
- No noticeable frame drops during normal gameplay
- Efficient particle/weather effects

The game should degrade gracefully on lower-end devices.

---

46. Analytics

If analytics are eventually added, track gameplay rather than invasive personal information.

Useful events:

- Tutorial completion
- First crop planted
- First crop harvested
- First animal acquired
- First environmental event
- First restoration
- Region completion
- Session length
- Player deaths/failures
- Abandoned sessions

The purpose is to identify gameplay friction.

---

47. Key Product Metrics

For an early prototype:

Engagement

- Time to first meaningful action
- Session duration
- Return sessions

Gameplay

- Tutorial completion
- Farming completion
- First restoration completion

Retention

- Day 1
- Day 7
- Day 30

Quality

- Crash rate
- Frame-rate problems
- Save failures
- Input failures

---

48. Risks

Risk: Too many systems

Mitigation: Keep MVP focused on farming + exploration + restoration.

Risk: Game becomes a farming simulator

Mitigation: Keep platforming/exploration central.

Risk: Game becomes too serious

Mitigation: Use humour, animals and charming characters.

Risk: Mobile controls feel bad

Mitigation: Prototype touch controls very early.

Risk: Environmental mechanics become repetitive

Mitigation: Each region introduces a different gameplay mechanic.

Risk: Content requirements become too large

Mitigation: Build reusable systems and data-driven content.

---

49. Future Features

Potential post-MVP features:

- More regions
- More animals
- Fishing
- Vehicles
- Weather station
- Greenhouse
- Bees
- Renewable energy
- Water purification
- Community building
- NPC relationships
- Seasonal events
- Procedural side areas
- Cosmetic customisation
- New game+
- Photo mode

---

50. Potential Game Modes

Story Mode

Main campaign.

Sandbox Farm

Free farming and restoration.

Challenge Mode

Specific environmental challenges.

Example:

«"Survive 10 days with only one water source."»

Daily Challenge

Optional future feature.

---

51. Example First 15 Minutes

Minute 0–2

Player arrives at the farm.

Learns:

- Move
- Jump
- Interact

Discovers:

- Broken fence
- Dry crops
- Chicken coop

Minute 2–5

Player:

- Repairs fence
- Finds water
- Waters crops
- Feeds chicken

Minute 5–8

Player explores the forest.

Discovers:

- Fallen tree
- Small cave
- Fox

Player collects wood.

Minute 8–11

Player returns to farm.

Builds:

Water tank

Minute 11–13

Weather changes.

Heatwave begins.

Water becomes scarce.

Minute 13–15

Player discovers a dried river.

Quest begins:

«"Find a way to bring water back."»

The player now understands the central game loop.

---

52. Example Long-Term Progression

Tiny Farm
    ↓
Stable Farm
    ↓
Self-Sufficient Farm
    ↓
Community Farm
    ↓
Ecological Sanctuary

The player's visual environment should evolve alongside this progression.

---

53. Definition of Done — Feature

A feature is considered complete when:

- Gameplay behaviour is implemented.
- Mobile controls work.
- Desktop controls work.
- Save/load behaviour is implemented where required.
- Audio feedback exists where appropriate.
- UI feedback exists where appropriate.
- Failure/recovery cases are handled.
- Automated tests exist for important game logic.
- Performance is acceptable.
- No known critical bugs remain.
- The feature has been tested on target platforms.

---

54. Initial Product Backlog

Epic 1 — Core Player

- Player movement
- Jumping
- Collision
- Interaction
- Camera
- Player animation

Epic 2 — Mobile Controls

- Touch joystick/buttons
- Touch interaction
- Button feedback
- Control configuration
- Safe-area handling

Epic 3 — Farm

- Farm map
- Soil
- Planting
- Watering
- Growth
- Harvesting

Epic 4 — Animals

- Chicken
- Chicken movement
- Feeding
- Coop
- Eggs

Epic 5 — Resources

- Wood
- Stone
- Water
- Seeds
- Inventory

Epic 6 — Exploration

- Forest
- River
- Cave
- Collectibles
- Environmental interactions

Epic 7 — Hazards

- Fox
- Heatwave
- Fire
- Damage/recovery

Epic 8 — Restoration

- Tree planting
- Water restoration
- Wildlife recovery
- Environment state

Epic 9 — Building

- Coop
- Storage
- Water tank
- Fence

Epic 10 — Story

- NPC
- Dialogue
- Quest system
- First story arc

Epic 11 — Persistence

- Save
- Load
- Auto-save
- Save versioning

Epic 12 — Polish

- Music
- Sound effects
- Particles
- Animation
- UI
- Tutorial
- Performance

---

55. Product Roadmap

Phase 0 — Prototype

Goal:

Prove that the core game is fun.

Implement:

- Movement
- Jumping
- One farm
- One forest
- One crop
- One chicken
- Basic exploration

---

Phase 1 — Vertical Slice

Goal:

Prove the complete gameplay loop.

Implement:

- Farming
- Exploration
- Environmental event
- Restoration
- NPC
- Quest
- Building
- Mobile controls
- Save/load

---

Phase 2 — MVP

Goal:

Create a small complete game.

Implement:

- First region
- Multiple crops
- Multiple animals
- Several quests
- Multiple upgrades
- Several environmental events
- Complete beginning/end

---

Phase 3 — Full Game

Goal:

Build the complete five-region adventure.

Implement:

- All regions
- Full story
- Advanced restoration
- Multiple environmental events
- Expanded NPCs
- Final sanctuary

---

56. Product North Star

The game should always answer one question:

«"What can I do right now to make my little farm and the world around it better?"»

If a feature doesn't contribute to:

- exploration,
- farming,
- protection,
- restoration,
- progression,
- or emotional attachment,

it should be questioned before being added.

---

57. Final Product Statement

The Last Little Farm is a hopeful 2D adventure about protecting something small while the world around you changes.

The player doesn't save the world by defeating a giant boss.

They save it one:

seed,

tree,

animal,

drop of water,

and little farm

at a time.
