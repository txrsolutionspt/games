/**
 * Pure game-rule functions for The Last Little Farm.
 *
 * No DOM/canvas/timer dependencies, so this file can be loaded either as a
 * browser <script> (attaches to window.FarmLogic) or with require() from
 * plain Node for unit testing (see test-farm-logic.js).
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.FarmLogic = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function createPlot(x) {
        return { x: x, state: 'empty', growth: 0, watered: false };
    }

    // empty -> tilled
    function tillPlot(plot) {
        if (plot.state !== 'empty') return false;
        plot.state = 'tilled';
        return true;
    }

    // tilled -> planted (consumes 1 seed)
    function plantSeed(plot, resources) {
        if (plot.state !== 'tilled' || resources.seeds <= 0) return false;
        resources.seeds -= 1;
        plot.state = 'planted';
        plot.watered = false;
        return true;
    }

    // planted -> growing (consumes 1 water)
    function waterPlot(plot, resources) {
        if (plot.state !== 'planted' || resources.water <= 0) return false;
        resources.water -= 1;
        plot.watered = true;
        plot.state = 'growing';
        plot.growth = 0;
        return true;
    }

    // growing -> ready once growth timer elapses. Returns true the tick it
    // becomes ready (useful for one-shot effects/sounds).
    function growPlot(plot, dt, growTime) {
        if (plot.state !== 'growing') return false;
        plot.growth += dt / growTime;
        if (plot.growth >= 1) {
            plot.growth = 1;
            plot.state = 'ready';
            return true;
        }
        return false;
    }

    // ready -> empty (+1 crop, chance of +1 seed)
    function harvestPlot(plot, resources, rng) {
        rng = rng || Math.random;
        if (plot.state !== 'ready') return false;
        resources.crops += 1;
        if (rng() < 0.6) resources.seeds += 1;
        plot.state = 'empty';
        plot.growth = 0;
        plot.watered = false;
        return true;
    }

    function fillWater(resources) {
        if (resources.water >= resources.waterMax) return false;
        resources.water = resources.waterMax;
        return true;
    }

    function createTree(x) {
        return { x: x, hp: 3, stumpTimer: 0 };
    }

    // one hit; fells the tree and grants wood on the final hit
    function chopTree(tree, resources, regrowTime) {
        if (tree.hp <= 0) return false;
        tree.hp -= 1;
        if (tree.hp <= 0) {
            resources.wood += 2;
            tree.stumpTimer = regrowTime;
        }
        return true;
    }

    // regrow timer counts down while felled; returns true the tick it regrows
    function regrowTree(tree, dt) {
        if (tree.hp > 0) return false;
        tree.stumpTimer -= dt;
        if (tree.stumpTimer <= 0) {
            tree.hp = 3;
            return true;
        }
        return false;
    }

    // feeds the chicken 1 crop and starts the egg timer, if not already
    // incubating one; returns true if the chicken was actually fed
    function feedChicken(chicken, resources, eggTime) {
        if (resources.crops > 0 && chicken.eggTimer < 0) {
            resources.crops -= 1;
            chicken.eggTimer = eggTime;
            chicken.fedFlash = 0.6;
            return true;
        }
        chicken.fedFlash = 0.3;
        return false;
    }

    // ticks the egg-laying timer; returns true the tick an egg is laid
    function updateChickenEgg(chicken, resources, dt) {
        if (chicken.eggTimer < 0) return false;
        chicken.eggTimer -= dt;
        if (chicken.eggTimer <= 0) {
            chicken.eggTimer = -1;
            resources.eggs += 1;
            chicken.hopTimer = 0.5;
            return true;
        }
        return false;
    }

    function createBush(x) {
        return { x: x, hasSeed: true, respawnTimer: 0 };
    }

    // gathers the wild seed(s) off a bush, if it currently has one
    function gatherBush(bush, resources, respawnTime, yieldAmount) {
        yieldAmount = yieldAmount || 1;
        if (!bush.hasSeed) return false;
        resources.seeds += yieldAmount;
        bush.hasSeed = false;
        bush.respawnTimer = respawnTime;
        return true;
    }

    // respawn timer counts down while bare; returns true the tick it regrows
    function regrowBush(bush, dt) {
        if (bush.hasSeed) return false;
        bush.respawnTimer -= dt;
        if (bush.respawnTimer <= 0) {
            bush.hasSeed = true;
            return true;
        }
        return false;
    }

    // trades wood for a seed at the seed stand
    function buySeed(resources, woodCost) {
        if (resources.wood < woodCost) return false;
        resources.wood -= woodCost;
        resources.seeds += 1;
        return true;
    }

    // The game is a landscape-oriented side-scroller (per MOBILE_CONTROLS_SPEC.md).
    // On touch devices we require landscape and show a rotate prompt; desktop/mouse
    // windows are left alone since there's nothing to "rotate".
    function shouldLockLandscape(width, height, isTouch) {
        return !!(isTouch && height > width);
    }

    return {
        createPlot: createPlot,
        tillPlot: tillPlot,
        plantSeed: plantSeed,
        waterPlot: waterPlot,
        growPlot: growPlot,
        harvestPlot: harvestPlot,
        fillWater: fillWater,
        createTree: createTree,
        chopTree: chopTree,
        regrowTree: regrowTree,
        createBush: createBush,
        gatherBush: gatherBush,
        regrowBush: regrowBush,
        buySeed: buySeed,
        feedChicken: feedChicken,
        updateChickenEgg: updateChickenEgg,
        shouldLockLandscape: shouldLockLandscape,
    };
});
