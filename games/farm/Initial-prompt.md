Create a kid-friendly farming education game for smartphones, inspired by the casual/isometric farming-game style of FarmVille.

The goal is not simply to build a virtual farm, but to teach children how farming works through engaging gameplay. The player should learn where food comes from, what resources are required, how crops and animals are cared for, how weather and seasons affect production, and how raw agricultural products are transformed into finished products.

Use the attached image as visual inspiration for the overall feel: colorful, friendly, isometric/2D farm, crops, animals, buildings, paths, fences, and small interactive objects. Do not copy the image directly or reproduce its assets.

Target platform

Smartphone-first web game.

Runs entirely in a modern web browser.

Responsive design for mobile portrait and landscape where practical.

Touch-first interaction with large, easy-to-use controls.

Should also work on desktop browsers with mouse interaction.

No native mobile application is required.


No backend

The initial version must be completely client-side.

No server.

No user accounts.

No login.

No cloud save.

No social features.

No chat or communication with other players.

All game state, configuration, progress, inventory, achievements, and settings must be stored locally using LocalStorage or IndexedDB where appropriate.

The game must remain playable without an internet connection after the initial page/assets have been loaded, where technically practical.


This is intentionally a safe, self-contained game for children.

Core gameplay concept

The player starts with a small farm and gradually develops it.

The basic gameplay loop should be:

Prepare → Plant/Raise → Care → Harvest → Process → Sell/Use → Improve the Farm → Learn

Every gameplay action should have an educational purpose.

For example:

1. Prepare soil.


2. Choose an appropriate crop.


3. Plant seeds.


4. Water the crop.


5. Wait for growth.


6. Deal with weather or other farming conditions.


7. Harvest the crop.


8. Store the produce.


9. Process it into another product.


10. Sell or use the product.


11. Reinvest resources into the farm.



The player should gradually discover why each step is necessary, rather than simply clicking buttons to generate coins.

Educational objectives

The game should teach concepts such as:

Crops

Seeds → plant → growing crop → mature crop → harvest.

Different crops have different growing times.

Different crops require different amounts of water and space.

Soil quality affects production.

Some crops are seasonal.

Weather can influence crops.

Harvesting too early or too late can affect the result.


Animals

Introduce farm animals such as:

Chickens

Cows

Sheep

Goats

Pigs


Teach that animals require:

Food

Water

Shelter

Space

Care


Animals should produce resources such as eggs, milk or wool.

From farm to food

A major educational mechanic should be showing how agricultural products become things children recognize.

Examples:

Wheat → flour → bread

Milk → cheese

Milk → butter

Tomatoes → tomato sauce

Apples → juice

Strawberries → jam

Corn → corn products

Wool → yarn → clothing


Products should have simple visual production chains so children can understand the relationship between raw materials and finished products.

Resources

Teach basic resource management:

Seeds

Water

Feed

Land

Time

Energy/work

Harvested goods

Money


Avoid making the economy unnecessarily complicated.

The objective is educational understanding rather than creating a sophisticated economic simulation.

Progression

Start with a very small farm and gradually unlock:

1. Basic crops


2. More crops


3. Animals


4. Storage


5. Processing buildings


6. More land


7. Advanced production chains


8. Seasonal challenges


9. Educational challenges



Each new feature should introduce a new farming concept.

Avoid aggressive progression mechanics, gambling mechanics, loot boxes, paid currency, advertisements, or manipulative engagement mechanics.

Educational missions

Add simple missions/challenges such as:

"Grow your first wheat crop."

"Harvest 10 carrots."

"Give the chickens food and water."

"Collect three eggs."

"Turn wheat into flour."

"Make bread using flour."

"Plant a crop that grows well in this season."

"Use less water while still producing a good harvest."


After completing certain activities, provide a short, child-friendly explanation of what the player just learned.

Visual design

Use a colorful, friendly, playful farming aesthetic:

Isometric or pseudo-isometric farm.

Bright but comfortable colors.

Cute animals.

Clearly recognizable crops.

Small animated interactions.

Friendly characters.

Simple buildings.

Large touch targets.

Minimal text.

Icons and visual feedback wherever possible.


The visual style should feel similar to the attached reference in terms of farm layout, colorful crops, animals, buildings and casual-game presentation, while using completely original assets and UI.

Child-friendly UX

The game should be understandable by a child without requiring extensive reading.

Prefer:

Icons

Animations

Visual indicators

Simple language

Short explanations

Positive feedback

Guided tutorials


Avoid:

Complex menus

Long text

Aggressive timers

Punishment-heavy mechanics

Gambling

Ads

Chat

Social interaction

User-generated content

External links from gameplay


Game simulation

The game should have a simple simulation of:

Crop growth

Animal production

Water consumption

Feed consumption

Inventory

Weather

Seasons

Production recipes

Farm expansion


The simulation does not need to be scientifically perfect, but the underlying concepts should be agriculturally reasonable and educationally correct.

Where simplifications are made for gameplay, prefer explanations that do not teach incorrect farming practices.

Local persistence

Store all relevant game state locally, including:

Farm layout

Crops

Animals

Inventory

Currency

Buildings

Unlocked features

Completed missions

Educational progress

Settings


The game should automatically save progress.

Include a mechanism to reset the local game data for development/testing.

Architecture

Build the game with a clean separation between:

Game state

Game simulation

Farming rules

Production recipes

Educational content

Rendering/UI

Input handling

Persistence

Configuration


Farming rules and educational content should be data-driven, rather than hard-coded throughout the UI.

For example, crops should be defined through data containing properties such as:

Name

Seed cost

Growth time

Water requirements

Season

Harvest product

Yield

Educational description


Production recipes should similarly define:

inputs → processing time → output

This should make it easy to add new crops, animals and production chains later.

MVP

Start with a small but complete playable MVP rather than trying to implement everything at once.

The MVP should contain:

One farm

4–6 crops

2–3 animal types

Planting

Watering

Growing

Harvesting

Animal care

Inventory

At least 3 processing chains

Simple currency

Farm expansion

5–10 educational missions

Basic tutorial

Local save/load

Responsive smartphone UI


The MVP should already provide a complete gameplay loop from planting a crop to producing a finished product.

Important product principle

Education must be integrated into the gameplay rather than presented as a separate school lesson.

A child should learn naturally by playing:

"What do I need?" → "What should I do?" → "What happened?" → "Why?"

The game should make children curious about where their food comes from and how much work, resources and knowledge are involved in producing it.

Deliverable

Build a working browser-based MVP with:

Complete playable game loop.

Mobile-first responsive UI.

Touch controls.

Local persistence.

Data-driven farming and production systems.

Educational missions.

No backend dependencies.

No social functionality.

No external services.


Prioritize fun, clarity, educational value and simplicity over graphical complexity. The architecture should, however, make it straightforward to expand the game later with additional crops, animals, machines, seasons, educational content and farm areas.
