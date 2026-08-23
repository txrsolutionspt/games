// Currency/inventory mutations — PLAN.md §7. state.coins and
// state.inventory are only ever changed through these functions, so every
// other module (simulation, input, missions) shares one source of truth
// for "can I afford this" / "do I have enough of this".

const Economy = (function () {
  function addCoins(state, amount) {
    state.coins += amount;
  }

  function spendCoins(state, amount) {
    if (state.coins < amount) return false;
    state.coins -= amount;
    return true;
  }

  function addItem(state, item, qty) {
    state.inventory[item] = (state.inventory[item] || 0) + qty;
  }

  function removeItem(state, item, qty) {
    const have = state.inventory[item] || 0;
    if (have < qty) return false;
    state.inventory[item] = have - qty;
    return true;
  }

  function plotUnlockCost(index) {
    return CONFIG.plotUnlockCost(index);
  }

  // Looks up the sell price for any item the player can hold: raw crop
  // harvests, animal produce, or processed goods — one shared table instead
  // of three separate lookups scattered through the UI.
  function sellPriceFor(itemId) {
    const crop = CROPS.find(function (c) { return c.harvestYield.item === itemId; });
    if (crop) return crop.sellPrice;
    for (const animal of ANIMALS) {
      if (animal.produces.item === itemId) return animal.produces.sellPrice;
    }
    for (const recipe of RECIPES) {
      if (recipe.output.item === itemId) return recipe.output.sellPrice;
    }
    return 0;
  }

  function sellItem(state, itemId, qty) {
    const price = sellPriceFor(itemId);
    if (!removeItem(state, itemId, qty)) return false;
    addCoins(state, price * qty);
    return true;
  }

  return {
    addCoins: addCoins,
    spendCoins: spendCoins,
    addItem: addItem,
    removeItem: removeItem,
    plotUnlockCost: plotUnlockCost,
    sellPriceFor: sellPriceFor,
    sellItem: sellItem
  };
})();
