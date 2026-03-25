Below is a review of the earlier PRD, followed by a revised full implementation-ready PRD with appendix.

⸻

Review of the earlier PRD

The earlier PRD was strong as a product brief but not strict enough as an implementation contract for an autonomous coding agent.

The main weaknesses were:
	•	the interaction model was too loose
	•	the simulation rules were conceptually good but mechanically underspecified
	•	the MVP scope was too broad for reliable autonomous execution
	•	save/load behavior was vague
	•	browser/device support was vague
	•	visual quality goals were aspirational but not operational
	•	the agent still had too much freedom to invent architecture, formulas, and tool behavior

The revised version below fixes that by freezing:
	•	the world representation
	•	the placement model
	•	the simulation tick/update order
	•	the P0/P1/P2 scope split
	•	the buildable set
	•	the event system
	•	the persistence model
	•	the target platform
	•	the repo structure
	•	the definitions of done

This version is designed so that a strong agent such as Codex CLI can implement the intended MVP with much less drift.

⸻

Product Requirements Document

Project: Living Island

A browser-native cinematic miniature civilization simulator

1. Summary

Living Island is a browser-native, single-player world simulation where the user watches and shapes a stylized island civilization in real time.

The product should feel like a living diorama:
	•	a stylized island or small archipelago
	•	districts growing and declining
	•	cars, trams, ferries, and ambient motion moving through the world
	•	changing weather
	•	day/night transitions
	•	city lights at night
	•	traffic stress, outages, and recovery
	•	visible long-term change under timelapse

The product is designed for:
	•	visual impact
	•	coherent simulation
	•	fast comprehension
	•	shareable clips/screenshots
	•	self-contained browser execution

This is not a full-scale city builder.
It is a polished vertical slice of a living civilization simulator.

It must be:
	•	visually impressive
	•	mechanically legible
	•	self-contained
	•	implementable without third-party integrations
	•	achievable by an autonomous implementation agent from this PRD

⸻

2. Product vision

A user opens the app and immediately sees an island world already alive with:
	•	water
	•	clouds
	•	terrain
	•	roads
	•	movement
	•	weather
	•	lights
	•	districts

They can:
	•	generate a new island from a seed
	•	place zones and infrastructure
	•	add transit
	•	improve growth
	•	watch the world evolve
	•	deal with storms, blackouts, fires, and congestion
	•	switch into timelapse and cinematic modes
	•	save, reload, and compare outcomes across seeds

The emotional target is:

“This feels like a real world, and I want to keep watching it.”

⸻

3. Product goals

Primary goals

Goal 1: Immediate visual payoff

Within 10 seconds of opening the app, the user should see:
	•	a beautiful island scene
	•	moving entities
	•	atmospheric effects
	•	a readable city structure
	•	clear signs of simulation and life

Goal 2: Coherent cause and effect

The user should be able to understand:
	•	why a district grows
	•	why congestion worsens
	•	why a blackout happened
	•	why a storm caused damage
	•	why a place recovered

Goal 3: Shareability

The app should produce strong content for:
	•	short screen recordings
	•	screenshots
	•	timelapse clips

Goal 4: Reachable implementation

The MVP must be a vertical slice that is hard to dismiss, but small enough to implement well.

Goal 5: No third-party integrations

The product must run fully locally in the browser:
	•	no backend required for MVP
	•	no auth
	•	no external APIs
	•	no map APIs
	•	no live weather feeds
	•	no flight/traffic APIs
	•	no multiplayer

⸻

4. Non-goals

The MVP is not trying to be:
	•	a full SimCity/Cities: Skylines competitor
	•	a realistic economy simulator
	•	a global strategy game
	•	a real-world geospatial product
	•	a multiplayer sandbox
	•	a mod platform
	•	a procedural storytelling system
	•	an MMO or live-service game

The MVP also does not need:
	•	individual citizen schedules
	•	combat
	•	diplomacy
	•	construction timers
	•	unlock trees
	•	resource inventory
	•	currency/budget system
	•	online save sync
	•	mobile editing parity
	•	procedural dialogue
	•	LLM features inside the product

⸻

5. Design principles

5.1 Show, don’t explain

The product must communicate through visuals and consequences first.

5.2 Small world, high density

The world should feel rich and alive rather than large and empty.

5.3 Stylized over realistic

A consistent stylized look is preferred over half-realistic rendering.

5.4 Simulation only where it matters

Visible coherence matters more than maximum realism.

5.5 Every system must have a visible effect

If a system has no visible outcome, it likely does not belong in MVP.

5.6 Sandbox, not progression grind

The MVP is a sandbox. There is no currency, tech tree, unlock ladder, or build timer.

⸻

6. Target user

The target user is someone who enjoys:
	•	simulation games
	•	interactive system demos
	•	procedural worlds
	•	beautiful browser experiences
	•	dynamic environments
	•	watching systems evolve over time

The product should be understandable even to someone who is not a heavy gamer.

⸻

7. Platform and technical constraints

Platform
	•	browser-native web application
	•	desktop-first
	•	no backend required for MVP
	•	local saves only

Supported use
	•	desktop/laptop primary
	•	mobile may view but is not required to support full editing in MVP

Supported browsers
	•	Chrome latest: primary target
	•	Safari latest: secondary target
	•	Firefox latest: secondary target
	•	no support guarantee for older browsers

Minimum supported viewport
	•	1280×800 desktop viewport

Performance target hardware
	•	modern mid-range desktop/laptop
	•	Apple Silicon laptop class or comparable desktop GPU/CPU

Performance targets
	•	preferred: 60 FPS in normal play
	•	minimum acceptable: 30 FPS during heavier scenes
	•	timelapse mode may reduce visual density, but must remain smooth

Recommended stack

Use this stack unless there is a compelling reason not to:
	•	TypeScript
	•	React
	•	Vite
	•	Three.js
	•	Zustand
	•	IndexedDB for saves
	•	plain CSS or CSS modules for UI styling

No backend services are required.

⸻

8. MVP scope (P0)

The MVP is P0 only.
P1 and P2 are listed later and are not required for first implementation.

P0 includes

World
	•	seeded procedural island generation
	•	one main island plus optional one or two smaller satellite landmasses
	•	water, coastline, terrain elevation
	•	stylized sky and atmosphere
	•	day/night cycle
	•	global weather states
	•	world lighting and emissive night lighting

Buildable systems
	•	residential zone
	•	commercial zone
	•	industrial zone
	•	leisure zone
	•	roads
	•	tram line with stops
	•	ferry docks and ferry routes
	•	power plant
	•	water tower
	•	waste center
	•	park
	•	fire station

Simulation systems
	•	district growth/decline
	•	utility demand/supply
	•	traffic and congestion
	•	district satisfaction
	•	service coverage
	•	event effects and recovery

Events
	•	storm
	•	blackout
	•	traffic collapse
	•	fire

Presentation
	•	free orbit camera
	•	cinematic mode
	•	timelapse mode
	•	HUD hide / photo mode
	•	event timeline
	•	overlays

Persistence
	•	seeded new world generation
	•	autosave
	•	named local saves

⸻

9. Out of scope for P0

These are not part of the MVP:
	•	pedestrians
	•	aircraft / drones
	•	spatial weather fronts moving across the world
	•	full flood simulation
	•	rail outages
	•	harbor disruption event
	•	replay mode
	•	custom map import
	•	export/import save files
	•	multiplayer
	•	economy/currency
	•	achievements
	•	combat
	•	narrative quests

These may be P1/P2.

⸻

10. User stories

New user
	•	As a user, I want to open the app and immediately see a beautiful active world.
	•	As a user, I want the world to already contain a viable starting settlement area.
	•	As a user, I want simple tools that let me shape the island quickly.

Builder
	•	As a user, I want to place districts and infrastructure so I can grow the island.
	•	As a user, I want better transport and utilities to produce visible improvement.
	•	As a user, I want bad infrastructure choices to visibly hurt the world.

Observer
	•	As a user, I want to watch the world evolve over time.
	•	As a user, I want to switch into timelapse or cinematic view.
	•	As a user, I want weather and lighting to make the world interesting even when I am not editing.

Problem solver
	•	As a user, I want storms, blackouts, traffic collapse, and fires to create problems worth solving.
	•	As a user, I want to understand what caused those problems.
	•	As a user, I want my interventions to produce visible recovery.

Replay user
	•	As a user, I want to generate a new seed.
	•	As a user, I want to save and reload worlds.
	•	As a user, I want different runs to feel meaningfully different.

⸻

11. Core loop

The core loop is:
	1.	Generate or load an island
	2.	Observe the initial state
	3.	Place or modify zones and infrastructure
	4.	Watch growth and movement emerge
	5.	Respond to system stress or disasters
	6.	Improve transport, utilities, and services
	7.	Enter timelapse or cinematic mode to observe consequences
	8.	Save, continue, or restart from a new seed

The world should stay visually rewarding even when the user is just observing.

⸻

12. World model

12.1 Logical world size

The simulation uses a logical 128 × 128 tile grid.

This grid is used for:
	•	terrain/buildability
	•	zone placement
	•	service coverage
	•	district footprints
	•	simulation indexing

Rendering may smooth and stylize the terrain, but the simulation uses this grid.

12.2 Buildable tiles

A tile is buildable if:
	•	it is land
	•	its slope is below the build threshold
	•	it is not water
	•	it is not a cliff tile
	•	it is not already occupied by incompatible infrastructure

12.3 Terrain classes

Tiles may be:
	•	water
	•	beach/coast
	•	plains
	•	hills
	•	forest
	•	cliff/rock

These affect:
	•	visuals
	•	buildability
	•	attractiveness
	•	disaster susceptibility

12.4 Seeded generation

The same seed must generate the same terrain and initial world layout.

Seed controls:
	•	island shape
	•	terrain variation
	•	coastline shape
	•	biome distribution
	•	initial weather tendency profile

⸻

13. Interaction model

This is now fixed for MVP.

13.1 Camera controls

The world view uses a 3D orbit camera.

Controls:
	•	left drag: orbit
	•	right drag or Shift + drag: pan
	•	wheel/pinch: zoom
	•	double-click district/infrastructure: focus camera
	•	C: toggle cinematic mode
	•	T: toggle timelapse
	•	H: hide HUD / photo mode

13.2 World editing mode

The app has these user modes:
	•	inspect
	•	build zone
	•	build road
	•	build tram
	•	build ferry
	•	place utility/service
	•	demolish

No freeform drawing tools outside these modes.

13.3 Placement model

Zones

Zones are placed as axis-aligned rectangles snapped to the tile grid.

Rules:
	•	minimum footprint: 4 × 4 tiles
	•	maximum footprint: 20 × 20 tiles
	•	the user clicks and drags to define the rectangle
	•	the preview shows:
	•	zone color
	•	invalid tiles if present
	•	zone placement fails if any tile in the rectangle is invalid

Roads

Roads are drawn as node-to-node polylines on a road graph over tile intersections.

Rules:
	•	intersections snap to grid intersection points
	•	click to start, click to add bends, Enter or double-click to finish
	•	roads can connect to existing roads
	•	roads cannot cross water unless a bridge segment is automatically allowed by the implementation
	•	if bridges are implemented in P0, they must be simple stylized road bridges only

Tram

Tram lines are drawn on road-aligned path nodes.

Rules:
	•	tram lines must follow valid road edges
	•	tram stops are placed on selected road nodes
	•	at least 2 stops required for a valid line

Ferry

Ferry routes are dock-to-dock only.

Rules:
	•	docks must be placed on valid coastline road nodes
	•	route is defined by selecting dock A and dock B
	•	no arbitrary freeform ferry path drawing

Utilities/services

Utility/service buildings are placed as single-site structures snapped to tiles:
	•	power plant
	•	water tower
	•	waste center
	•	park
	•	fire station

Each structure has:
	•	fixed footprint
	•	valid placement rules

Demolish

Demolish mode removes:
	•	one selected zone
	•	one selected road segment
	•	one selected tram line segment
	•	one selected ferry dock/route
	•	one selected utility/service building

No undo/redo required for MVP.

13.4 Selection model

Clicking an entity selects it and opens an inspector panel.

Selectable objects:
	•	district
	•	road segment
	•	tram stop/line
	•	ferry dock/route
	•	utility/service building
	•	active event hotspot

⸻

14. Visual style

14.1 Style target

Stylized, clean, and cinematic.

The world should look like a polished simulation diorama, not a debug prototype.

14.2 Required visual qualities

The MVP must visibly include:
	•	animated water
	•	animated cloud/sky motion
	•	directional sunlight
	•	strong dawn/dusk/night transitions
	•	emissive city lights at night
	•	visible district density differences by level
	•	readable traffic/transit motion
	•	visible storm/rain/fire effects

14.3 Visual acceptance rule

A viewer should be able to understand the app as:
	•	a living island city
	•	with weather
	•	with transit
	•	with visible growth and failure

within 10 seconds of seeing a clip.

⸻

15. District model

15.1 District types

P0 district types:
	•	residential
	•	commercial
	•	industrial
	•	leisure

15.2 District state

Each district stores:
	•	id
	•	type
	•	footprint
	•	level (1–5)
	•	population
	•	jobs
	•	satisfaction (0–100)
	•	attractiveness (0–100)
	•	power_demand
	•	water_demand
	•	waste_demand
	•	transport_demand
	•	service_score (0–100)
	•	growth_progress (integer from -4 to +4)
	•	active_event_ids

15.3 Level effects

District level affects:
	•	building density/appearance
	•	population/jobs
	•	utility demand
	•	traffic demand
	•	night lighting intensity

15.4 Base coefficients

Use these base coefficients:

Residential
	•	base population: 70
	•	base jobs: 10
	•	base power: 8
	•	base water: 10
	•	base waste: 7
	•	base attractiveness bias: +10

Commercial
	•	base population: 0
	•	base jobs: 60
	•	base power: 12
	•	base water: 5
	•	base waste: 8
	•	base attractiveness bias: +4

Industrial
	•	base population: 0
	•	base jobs: 80
	•	base power: 18
	•	base water: 8
	•	base waste: 14
	•	base attractiveness bias: -8

Leisure
	•	base population: 0
	•	base jobs: 40
	•	base power: 10
	•	base water: 6
	•	base waste: 6
	•	base attractiveness bias: +18

15.5 Per-level formulas

For district level L:
	•	population = base_population * L^1.5
	•	jobs = base_jobs * L^1.4
	•	power_demand = base_power * L^1.4
	•	water_demand = base_water * L^1.3
	•	waste_demand = base_waste * L^1.3
	•	transport_demand = (population + jobs) * 0.12

Round all values to integers.

⸻

16. Utility and service model

16.1 Power plant
	•	footprint: 4 × 4 tiles
	•	supply capacity: 220
	•	global supply for MVP
	•	if total power demand > supply, districts begin to incur deficits

16.2 Water tower
	•	footprint: 3 × 3 tiles
	•	supply capacity: 220
	•	global supply for MVP

16.3 Waste center
	•	footprint: 3 × 3 tiles
	•	supply capacity: 220
	•	global supply for MVP

16.4 Park
	•	footprint: 3 × 3 tiles
	•	service radius: 12 tiles
	•	effect:
	•	attractiveness +12
	•	satisfaction +6 within radius

16.5 Fire station
	•	footprint: 4 × 4 tiles
	•	service radius: 16 tiles
	•	effect:
	•	reduces fire event duration by 50% in covered districts
	•	reduces fire chance modestly in covered districts

⸻

17. Transit and traffic model

17.1 Road graph

Roads form a graph of nodes and edges.

Each road edge has:
	•	length
	•	capacity
	•	current load
	•	congestion ratio

Road edge capacity

Use default road edge capacity:
	•	capacity = 100

17.2 Tram

Tram lines follow road edges.

Each tram line has:
	•	stops
	•	route edges
	•	line frequency (fixed in MVP)
	•	capacity contribution

Tram effect

Connected districts gain:
	•	transport bonus +18
	•	congestion relief on major road paths

17.3 Ferry

Ferries connect docks across water.

Each ferry route has:
	•	dock A
	•	dock B
	•	route length
	•	fixed frequency
	•	capacity contribution

Ferry effect

Connected districts gain:
	•	transport bonus +14
	•	island connectivity bonus +10 attractiveness if otherwise isolated

17.4 Traffic/load model

Traffic is not individual-citizen simulation.

MVP uses:
	•	aggregate flow simulation
	•	representative rendered actors

This is mandatory.

Load update

For each district:
	•	estimate work/leisure/service travel demand
	•	route that demand through available network
	•	accumulate edge load
	•	compute congestion ratio = load / capacity

Congestion thresholds
	•	under 0.6: low
	•	0.6 to 0.85: moderate
	•	over 0.85: severe

Congestion penalty

District congestion penalty is derived from mean congestion on paths serving it:
	•	low: 0
	•	moderate: -8 satisfaction, -6 growth score
	•	severe: -18 satisfaction, -16 growth score

17.5 Representative actors

Render representative movers based on network activity:
	•	cars on busy roads
	•	tram vehicles on active lines
	•	ferries on routes

No aircraft/drones/pedestrians in P0.

⸻

18. Time model

18.1 Tick

Simulation tick:
	•	every 0.5 seconds real time

18.2 In-game time

Each tick = 15 in-game minutes.

Therefore:
	•	4 ticks = 1 hour
	•	96 ticks = 1 day

18.3 Speeds

User controls:
	•	pause
	•	1x
	•	4x
	•	16x
	•	timelapse

Timelapse may reduce actor density if needed for performance.

⸻

19. Simulation update order

This order is fixed.

For every simulation tick, update in this order:
	1.	advance clock
	2.	update weather state and weather timers
	3.	update event timers and event progression
	4.	recalculate total utility supply/capacity
	5.	recalculate district demands
	6.	compute transport graph loads and congestion
	7.	compute district service coverage
	8.	compute district attractiveness/satisfaction
	9.	apply event penalties to districts
	10.	apply utility deficits to districts
	11.	update growth/decline only on growth-check ticks
	12.	update representative actor spawn targets
	13.	update timeline/UI state

This order must not be arbitrarily changed during implementation.

⸻

20. Growth and decline model

20.1 Growth check cadence

Growth/decline is evaluated every 24 ticks (6 in-game hours).

20.2 Growth score

For each district:

growth_score =
  demand_score
  + utility_score
  + transport_score
  + service_score
  + attractiveness_score
  - congestion_penalty
  - event_penalty

Clamp to 0–100.

20.3 Score inputs

demand_score

Represents whether the world currently wants more of this district type.
Use a simple system:
	•	residential demand rises when jobs exceed population
	•	commercial demand rises when residential level/population is high
	•	industrial demand rises when job demand and logistics demand are high
	•	leisure demand rises when satisfaction is high and city size is above starter threshold

Normalize to 0–25.

utility_score
	•	full utilities: +20
	•	mild deficit: +8
	•	severe deficit: -20

transport_score
	•	strong transit access / low congestion: +18
	•	acceptable access: +8
	•	poor access: -12

service_score
	•	covered by parks/fire service where relevant: +10
	•	uncovered: 0
	•	distressed and uncovered: -8

attractiveness_score

Derived from district type, nearby parks, coastline, nearby industry, and weather stress.
Normalize to -10 to +15.

congestion_penalty
	•	low: 0
	•	moderate: 8
	•	severe: 16

event_penalty
	•	no event: 0
	•	storm pressure: 8
	•	blackout: 18
	•	fire: 25
	•	traffic collapse: 15

20.4 Growth progress

Each district has growth_progress in the range -4 to +4.

At each growth check:
	•	if growth_score >= 60, increment growth_progress by 1
	•	if growth_score <= 40, decrement growth_progress by 1
	•	else move growth_progress 1 step toward 0

Level up

If growth_progress == +4:
	•	increase district level by 1 (max 5)
	•	reset growth_progress = 0

Level down

If growth_progress == -4:
	•	decrease district level by 1 (min 1)
	•	reset growth_progress = 0

Freeze conditions

A district cannot grow while any of the following is true:
	•	severe power deficit
	•	severe water deficit
	•	active blackout
	•	active fire

⸻

21. Weather system

21.1 Weather states

P0 weather states:
	•	clear
	•	cloudy
	•	rain
	•	storm
	•	fog

21.2 Weather duration

Each weather state lasts for a randomized duration within:
	•	clear: 24–72 ticks
	•	cloudy: 24–48 ticks
	•	rain: 16–40 ticks
	•	storm: 12–24 ticks
	•	fog: 12–24 ticks

21.3 Weather transitions

Weather transitions through weighted probabilities. Storms should be infrequent.

21.4 Weather effects

Clear
	•	baseline visuals
	•	no penalties

Cloudy
	•	darker lighting
	•	slight attractiveness reduction

Rain
	•	water animation intensifies
	•	ferry efficiency -10%
	•	slight traffic penalty

Storm
	•	dramatic sky and rain
	•	ferry efficiency -50%
	•	blackout chance increases
	•	coastal attractiveness -10
	•	fire chance reduced
	•	event timeline marker required

Fog
	•	muted atmosphere
	•	slight transport efficiency penalty

21.5 Weather implementation scope

P0 uses global weather states with animated sky/cloud/water/particles.

Spatial moving weather fronts are P1, not P0.

⸻

22. Events and disasters

P0 events:

22.1 Storm

Triggered by weather state storm.

Effects:
	•	ferry penalty
	•	blackout risk increase
	•	satisfaction -5 globally during storm
	•	visible rain/storm atmosphere

22.2 Blackout

Triggered when:
	•	total power deficit > 15% for 8 consecutive ticks
	•	or random storm blackout chance fires

Effects:
	•	affected districts lights go dark
	•	growth freezes in affected districts
	•	satisfaction -20 in affected districts
	•	visible darkening required

Duration:
	•	12–36 ticks depending on power recovery

22.3 Traffic collapse

Triggered when:
	•	average congestion across high-traffic edges > 0.85 for 24 consecutive ticks

Effects:
	•	commercial/industrial districts lose efficiency
	•	satisfaction -10 in badly affected districts
	•	visible road standstill increase
	•	event timeline entry required

Duration:
	•	until congestion average stays under 0.75 for 12 ticks

22.4 Fire

Triggered by:
	•	industrial district overload chance
	•	storm electrical risk chance
	•	random low baseline probability

Fire behavior in P0:
	•	affects one district only
	•	no tile-to-tile spreading simulation
	•	district efficiency drops to 0 while active
	•	visible fire/smoke effect required

Duration:
	•	covered by fire station: 8–16 ticks
	•	uncovered: 16–32 ticks

⸻

23. Day/night cycle

23.1 Day length

One full day = 96 ticks.

23.2 Lighting behavior
	•	sun direction changes continuously over day
	•	dusk/dawn must visibly shift sky and shadows
	•	night enables emissive district lights
	•	blackout districts must visibly lose night lighting

Night presentation is a required visual feature, not optional polish.

⸻

24. Motion and life

The world must feel alive at all times.

P0 must visibly include:
	•	moving road traffic
	•	moving trams
	•	moving ferries
	•	moving clouds / weather
	•	animated water
	•	changing lights
	•	district activity differences by level

No static idle world is acceptable.

⸻

25. UI / UX requirements

25.1 Main layout

Desktop-first layout:

Top bar
	•	seed
	•	world name
	•	time/date
	•	weather
	•	speed controls
	•	save/load
	•	new world

Left panel
	•	build tools
	•	build categories
	•	demolish
	•	overlays toggle

Right panel
	•	inspector for selected district/building/route/event
	•	world stats summary when nothing selected

Bottom strip
	•	event timeline
	•	recent alerts
	•	timelapse indicator

25.2 Overlays

P0 overlays:
	•	traffic
	•	power
	•	water
	•	satisfaction

Each overlay must:
	•	be readable
	•	use a polished color palette
	•	not look like a debug heatmap

25.3 Photo mode

Pressing H hides HUD.
This is the MVP screenshot mode.

No dedicated photo-mode menu is required in P0.

⸻

26. Save/load

26.1 Storage model

Use local browser persistence only.

Recommended:
	•	IndexedDB for save data
	•	localStorage only for small user preferences

26.2 Save slots

P0 requires:
	•	1 autosave
	•	3 named manual save slots

26.3 Save contents

A save must contain:
	•	seed
	•	terrain/world generation metadata
	•	districts
	•	infrastructure
	•	transit routes
	•	current weather
	•	current time
	•	active events
	•	simulation values
	•	camera state (optional but recommended)

26.4 No migration support

No cross-version save migration is required in MVP.

⸻

27. Accessibility and clarity

P0 accessibility requirements:
	•	readable contrast
	•	scalable UI text
	•	colorblind-safe overlay palette where practical
	•	essential meaning not encoded by one color alone
	•	ability to pause and inspect the world

⸻

28. Asset and dependency policy

Allowed:
	•	open-source npm packages
	•	icon libraries
	•	local static assets
	•	procedural geometry/materials
	•	free/open visual assets if licensing is compatible

Not allowed:
	•	paid asset dependency required for MVP
	•	third-party APIs
	•	server-side rendering dependency
	•	cloud asset generation requirement

Stylized primitives are acceptable if:
	•	composition is strong
	•	lighting is strong
	•	motion is strong
	•	the result looks cohesive

⸻

29. Debug tooling requirement

A dev/debug panel is required for development builds.

It must expose:
	•	seed
	•	current tick/day/time
	•	weather state
	•	active events
	•	total power supply vs demand
	•	total water supply vs demand
	•	total waste capacity vs demand
	•	average congestion
	•	district count by type/level
	•	selected district stats
	•	simulation speed

This panel does not need to appear in HUD-hidden photo mode.

⸻

30. Repository structure

Use this repo structure unless there is a compelling reason not to:

src/
  app/
    App.tsx
    routes/
  ui/
    components/
    panels/
    overlays/
  world/
    generation/
    terrain/
    rendering/
    camera/
    weather/
  simulation/
    core/
    districts/
    utilities/
    transport/
    events/
    time/
  persistence/
  debug/
  types/
  assets/

Keep simulation logic separate from rendering logic.

⸻

31. Technical architecture

31.1 Simulation/render separation

Simulation must not depend on render objects.

Renderer consumes derived state from simulation.

31.2 Determinism

Given:
	•	same seed
	•	same player actions
	•	same tick sequence

the simulation should be deterministic where practical.

31.3 State management

Use a lightweight client-side state model. Avoid over-engineered framework abstractions.

⸻

32. Success criteria

The MVP is successful if:

Visual success
	•	a first-time viewer understands the app as a living island simulation within 10 seconds
	•	day/night looks polished
	•	storms, fire, and blackout are visually obvious
	•	clips and screenshots look impressive without explanation

Simulation success
	•	user actions visibly affect growth and decline
	•	utilities and transport have clear consequences
	•	event causes and recovery paths are understandable

Interaction success
	•	building/placement feels predictable
	•	camera/navigation feels good
	•	timelapse is satisfying

Product success
	•	the experience feels like a coherent product, not disconnected systems pasted together

⸻

Appendix A — P0 / P1 / P2 scope split

P0 (required)
	•	seeded island generation
	•	water/terrain/sky
	•	day/night
	•	global weather states
	•	residential/commercial/industrial/leisure zones
	•	roads
	•	tram
	•	ferry
	•	power/water/waste
	•	park
	•	fire station
	•	district growth/decline
	•	traffic/load simulation
	•	events: storm, blackout, traffic collapse, fire
	•	overlays
	•	save/load
	•	cinematic mode
	•	timelapse
	•	HUD hide photo mode

P1 (not required for MVP)
	•	spatial moving weather fronts
	•	pedestrians
	•	aircraft/drones
	•	harbor disruption event
	•	flood surge
	•	replay mode
	•	richer photo mode
	•	more district types
	•	more landmarks

P2 (not required for MVP)
	•	custom map import
	•	online sharing
	•	multiplayer
	•	advanced economy
	•	policy systems
	•	scenario scripting
	•	modding

⸻

Appendix B — Concrete implementation defaults

B1. World generation algorithm

Use:
	•	seeded noise-based heightmap
	•	radial falloff to ensure island form
	•	smoothing pass
	•	tile classification thresholds for water/coast/plains/hills/cliffs
	•	one guaranteed central buildable basin on the main island

B2. Road graph defaults
	•	roads connect grid intersections
	•	default edge capacity: 100
	•	bridge segments optional for P0 but allowed if simple

B3. Tram defaults
	•	one tram line type
	•	line follows road-aligned edges
	•	each stop increases transport access in radius 10 tiles

B4. Ferry defaults
	•	ferry route connects exactly two docks
	•	each dock must be on coastline adjacent to a road node
	•	ferry travel time = route length / ferry speed factor

B5. Utility deficit thresholds

Power
	•	deficit < 5%: negligible
	•	5–15%: mild penalty
	•	15%: severe penalty and blackout risk

Water
	•	deficit < 5%: negligible
	•	5–15%: mild penalty
	•	15%: severe penalty and no growth

Waste
	•	deficit < 5%: negligible
	•	5–15%: mild penalty
	•	15%: strong satisfaction penalty

B6. Service coverage

Use Euclidean or path-distance approximation on the grid.

Park
	•	radius 12

Fire station
	•	radius 16

B7. Actor density

Representative actors only.

Spawn targets:
	•	cars based on high-load road edges
	•	trams based on existing tram lines
	•	ferries based on active ferry routes

Do not simulate one actor per citizen.

⸻

Appendix C — Type-level data model guidance

Use a data model roughly equivalent to:

type DistrictType = "residential" | "commercial" | "industrial" | "leisure";

type WeatherState = "clear" | "cloudy" | "rain" | "storm" | "fog";

type EventType = "storm" | "blackout" | "traffic_collapse" | "fire";

interface District {
  id: string;
  type: DistrictType;
  tiles: Array<{ x: number; y: number }>;
  level: 1 | 2 | 3 | 4 | 5;
  population: number;
  jobs: number;
  satisfaction: number;
  attractiveness: number;
  powerDemand: number;
  waterDemand: number;
  wasteDemand: number;
  transportDemand: number;
  serviceScore: number;
  growthProgress: number;
  activeEventIds: string[];
}

interface UtilityBuilding {
  id: string;
  type: "power_plant" | "water_tower" | "waste_center" | "park" | "fire_station";
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RoadEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  length: number;
  capacity: number;
  load: number;
  congestion: number;
}

interface TramLine {
  id: string;
  stopNodeIds: string[];
  edgeIds: string[];
}

interface FerryRoute {
  id: string;
  dockAId: string;
  dockBId: string;
  length: number;
}

interface SimEvent {
  id: string;
  type: EventType;
  startTick: number;
  endTick: number;
  affectedDistrictIds: string[];
}

interface WorldState {
  seed: string;
  tick: number;
  weather: WeatherState;
  districts: District[];
  utilities: UtilityBuilding[];
  roadEdges: RoadEdge[];
  tramLines: TramLine[];
  ferryRoutes: FerryRoute[];
  events: SimEvent[];
}

Exact naming may vary, but the model should remain structurally similar.

⸻

Appendix D — Definitions of done

D1. World generation done when
	•	10 different seeds generate valid worlds
	•	every world has at least one viable starter basin
	•	terrain, water, and lighting render correctly
	•	world generation is deterministic from seed

D2. Zones done when
	•	user can place all four zone types
	•	invalid placement is blocked
	•	zones render distinct visual identities
	•	zones level up/down visibly

D3. Roads done when
	•	user can draw connected road segments
	•	roads visually render correctly
	•	traffic uses the road graph
	•	disconnected zones show transport penalties

D4. Tram done when
	•	user can place a valid tram line with stops
	•	trams render and move
	•	connected districts receive transport bonus

D5. Ferry done when
	•	user can place docks and connect them
	•	ferries render and move
	•	island connectivity improves connected districts

D6. Utilities done when
	•	power/water/waste capacities update correctly
	•	deficits visibly affect districts
	•	restoration visibly improves districts

D7. Events done when
	•	each P0 event can trigger
	•	each event has visible presentation
	•	each event appears in the timeline
	•	each event affects simulation state in the intended way

D8. Timelapse done when
	•	simulation speeds up
	•	visuals remain coherent
	•	world remains readable
	•	clip quality is good enough for sharing

D9. Persistence done when
	•	autosave works
	•	3 manual save slots work
	•	save/load restores the world reliably

D10. Visual bar met when
	•	the app is immediately legible in a short clip
	•	night lighting looks intentional
	•	storms, blackout, and fire all read clearly on screen
	•	the world feels alive even without user input for a short period

⸻

Appendix E — Explicit implementation constraints for the agent

The implementing agent must follow these rules:
	1.	Implement P0 only unless explicitly instructed otherwise.
	2.	Do not add a currency/economy/build timer system.
	3.	Do not add multiplayer, backend, auth, or third-party integrations.
	4.	Use aggregate flow simulation plus representative actors.
	5.	Keep simulation logic separate from rendering logic.
	6.	Keep the visual result stylized and polished rather than realistic and unfinished.
	7.	Prefer a coherent vertical slice over broad feature sprawl.
	8.	If forced to choose between more systems and better presentation, prefer better presentation within P0.
	9.	Preserve determinism from seed where practical.
	10.	Do not silently expand scope into a full city-builder platform.

⸻

This version is substantially more implementation-ready.
A strong autonomous coding agent such as Codex CLI should be able to build the intended MVP with much less drift from this document.
