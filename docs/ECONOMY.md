<!-- Copyright (c) 2026 Merchant Protocol. All rights reserved. -->
# Kinstead · the town economy (plan)

Your homestead grows into a small town that feeds and arms itself. Buildings make things, carts haul what they make
to your **marketplace** (which is also your storehouse), and the people who live in your town take what they need
from it. Everything you own flies your banner.

## Goods

| Good | Comes from | Used for |
|---|---|---|
| Wheat | Wheat fields around a farm | Bread and meals, feeding cows, buying chickens |
| Eggs | Chickens (1 per chicken per minute) | Meals |
| Milk | Cows (1 per cow every 2 minutes, while fed) | Meals |
| Beef | A cow you butcher at the barn | Meals, raw meat |
| Meals (bread, stew) | The cook in your cottage | Eating: the best way to heal |
| Weapons | The blacksmith | Your weapon drawer; spares go to market |
| Wood, stone, iron | You, woodcutter, quarry | Building, the blacksmith |

## Buildings

1. **Farm** (needs your cottage). Drop it, then pick *Wheat field* in the drawer and draw field squares around it
   (within 14 m). Each square goes sprout → green → gold over about three minutes, then yields 1 wheat and
   starts again. A bigger field means more wheat.
2. **Grain silo.** Holds up to 200 wheat. Its fill level shows on the outside. Wheat goes to the silo first and
   the marketplace takes the overflow.
3. **Chicken coop.** Pay 5 wheat per chicken. Chickens peck around the coop and each lays 1 egg a minute.
4. **Cattle barn.** Pay 10 wheat per cow. Cows graze near the barn and eat 1 wheat every 2 minutes. Fed cows give
   milk. You can butcher a cow at the barn for beef.
5. **Marketplace** (your storehouse). Every good your town makes ends up here, and you see the crates, sacks and
   barrels pile up as the stock grows. A **clerk** stands at the counter. Other players trade with him: they buy
   what you put up for sale, and you set the prices.
6. **Cottage cook.** A woman in your cottage takes wheat, eggs and milk from the market and cooks meals. They go into
   the cottage pantry for you to eat.
7. **Blacksmith smith.** A man in the smithy takes iron and wood from the market and forges what you queue. Finished
   weapons stay in the smithy, and when its racks are full the spares go to the market. He also looks after your
   horses (once horses arrive).

## How goods move

- Every building has its own small store.
- A **carter** pushes a handcart from a building to the marketplace when the building has goods waiting. Carts are
  real things on the road: you can see them, and so can raiders.
- Workers (the cook and the smith) send their own runs to the market to fetch ingredients.
- Livestock is real too. Wolves and bears go after cows and chickens that wander outside your walls.

## Danger and trade

- Wolves and bears hunt livestock outside walls; raiders go after the marketplace.
- Other players can raid what is outside, or buy from your clerk.
- Your flag flies on every building, cart and stall.

## Building it, in phases

1. **Core (built):** the economy ledger (stock per building), carts, the marketplace with growing piles, the farm with
   wheat fields, the grain silo.
2. **Livestock (built):** the chicken coop and chickens with eggs; the cattle barn and cows with milk and beef;
   predators eat animals outside walls.
3. **People:** the cook (meals), the smith (weapon orders, spares to market), the clerk (trading with other
   players).
4. **Shared:** other players see your animals, carts and workers; the clerk trades even while you are offline.

## What is built (November 2026)

- **Purse and storehouses.** Your purse holds 160 wood and stone to start. Each storehouse adds 400 (900 at level 2).
  When you are full, a workshop stacks what it makes (up to 400) and hands it over as soon as there is room.
- **Costs climb.** Walls, gates, fire pots and fields stay cheap. Every other building costs 1.6x the last one of
  its kind. The marketplace (600 wood, 600 stone, 30 iron) needs about two storehouses' worth of goods.
- **Woodcutter and quarry** make 15 a minute (30 upgraded). Their worker walks to real trees and rocks, and every
  third load a cart rolls to your storehouse.
- **Marketplace:** a walk-in hall in four sections, with a street stall per section out front. You take anything
  free; your team takes anything free; other settlers pay your clerk's prices (even while you are offline).
  Passing traders buy too. The gold collects in the market.
- **People:** cook (cottage), smith (blacksmith), clerk (market), baker (bakery: 3 wheat to 2 loaves), butcher
  (keeps 2 cows and 4 hens per building, butchers the rest), alchemist (library: random potions of healing,
  speed, strength and warmth), stablehand (stable: saddle a horse and ride), and a keeper at every farm, coop,
  barn, woodcutter, quarry, storehouse, silo and watchtower. Talk to any of them for a report.
- **Food:** wheat is not food. Bread, meals from the cook and roast meat are. Click bread or a potion in your purse.
- **Wild game:** deer, elk, bison and wild horses graze in herds by day and leave at dusk. Hunt them for raw meat.

## Food demand and hunger

The town spends one ration per person per game-minute from stores, including the player's hero. Rations are taken in order:
bread, beef, eggs, milk, prepared food, then raw wheat. Each whole item counts as one ration. The food HUD estimates production
from bakeries (up to 12 loaves/minute), chickens (1 egg/minute each), cows (1 milk/2 minutes), fields (1 wheat/3 minutes per
field square), and any direct food production. Its remaining-time estimate sums all ration goods in the purse and building
ledgers; treat it as a planning estimate because production may be blocked by missing ingredients or full storage.

When stores cannot cover a ration, workers slow after one missed minute and stop after two. They say they are hungry when
talked to. Replenishing food restores work. Starvation causes no deaths; this is an intentional first release design choice.
A representative mid-game town with a bakery, 24 wheat field squares and a full chicken coop (12 hens) makes about
17.3 food units/minute: 8 wheat/minute, enough wheat for about 5.3 bread/minute, and 12 eggs/minute. The listed
cottage/woodcutter/quarry/farm/storehouse/bakery/coop/barn/market town plus the hero is about 10 mouths (10/min), so
this setup feeds itself. A bakery with 24 field squares but no livestock makes only about 5.3 bread/minute and needs
more fields or animals. Cows' milk is counted against their wheat consumption. A town with 16 mouths and no
bakery, livestock or fields has 0/minute production against 16/minute demand and will starve once stores run out.
