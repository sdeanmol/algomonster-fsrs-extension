document.addEventListener('DOMContentLoaded', () => {
    // Close button
    document.getElementById('back-to-popup-btn').addEventListener('click', () => {
        window.close();
    });

    // Tab toggling logic
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // Load gamification profiles
    loadGamifyData();

    // Wire global handlers
    document.getElementById('hatch-btn').addEventListener('click', handleHatchCompanion);
    document.getElementById('add-reward-btn').addEventListener('click', handleAddCustomReward);

    // Profile Edit handlers
    const editForm = document.getElementById('edit-profile-form');
    const editBtn = document.getElementById('edit-profile-btn');
    const cancelBtn = document.getElementById('cancel-profile-btn');
    const saveBtn = document.getElementById('save-profile-btn');

    if (editBtn && editForm) {
        editBtn.addEventListener('click', () => {
            const isHidden = editForm.style.display === 'none' || !editForm.style.display;
            if (isHidden) {
                document.getElementById('edit-char-name').value = gamifyState.character.name || "Coding Hero";
                document.getElementById('edit-char-avatar').value = gamifyState.character.avatar || "👤";
                editForm.style.display = 'flex';
            } else {
                editForm.style.display = 'none';
            }
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            editForm.style.display = 'none';
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const newName = document.getElementById('edit-char-name').value.trim();
            const newAvatar = document.getElementById('edit-char-avatar').value.trim() || "👤";

            if (!newName) {
                showToast("Character Name cannot be empty.", true);
                return;
            }

            gamifyState.character.name = newName;
            gamifyState.character.avatar = newAvatar;

            saveGamifyState(() => {
                editForm.style.display = 'none';
                loadGamifyData();
                showToast("Player Profile saved successfully!");
            });
        });
    }

    // Bind buy items in shop
    document.querySelectorAll('.buy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const item = e.currentTarget.getAttribute('data-item');
            const cost = parseInt(e.currentTarget.getAttribute('data-cost'), 10);
            handleBuyShopItem(item, cost);
        });
    });
});

let gamifyState = {};

function loadGamifyData() {
    chrome.storage.local.get(['fsrsGamification'], (result) => {
        gamifyState = result.fsrsGamification || {
            character: {
                level: 1, xp: 0, hp: 50, maxHp: 50, gold: 10, class: null, statPoints: 0,
                stats: { str: 0, int: 0, con: 0, per: 0 },
                equipment: { weapon: null, armor: null, head: null },
                name: "Coding Hero",
                avatar: "👤"
            },
            inventory: { eggs: [], potions: [], food: [] },
            pets: [], mounts: [], activeCompanion: null, customRewards: [], lastCronCheck: Date.now()
        };

        renderCharacterInfo();
        renderInventoryGrids();
        renderCompanionsStable();
        renderRewardsAndShop();
    });
}

function renderCharacterInfo() {
    const char = gamifyState.character;
    if (!char) return;

    // Display basic stats
    document.getElementById('char-name-display').textContent = char.name || "Coding Hero";
    document.getElementById('profile-avatar-emoji').textContent = char.avatar || "👤";
    document.getElementById('char-class-display').textContent = char.class ? char.class : "No Class Unlocked";
    document.getElementById('char-level-display').textContent = `Level ${char.level} Practice RPG`;

    // HP & XP bars
    const maxXp = char.level * 100;
    document.getElementById('stat-hp-text').textContent = `${char.hp} / ${char.maxHp}`;
    document.getElementById('stat-hp-fill').style.width = `${(char.hp / char.maxHp) * 100}%`;
    document.getElementById('stat-xp-text').textContent = `${char.xp} / ${maxXp}`;
    document.getElementById('stat-xp-fill').style.width = `${(char.xp / maxXp) * 100}%`;

    // Gold balance
    const goldSpan = document.getElementById('rpg-gold-val');
    if (goldSpan) goldSpan.textContent = char.gold;

    // Attribute points badge
    const ptsBadge = document.getElementById('stat-points-badge');
    ptsBadge.textContent = `${char.statPoints} Stat Points`;

    // Attributes list
    document.getElementById('val-str').textContent = char.stats.str || 0;
    document.getElementById('val-int').textContent = char.stats.int || 0;
    document.getElementById('val-con').textContent = char.stats.con || 0;
    document.getElementById('val-per').textContent = char.stats.per || 0;

    // Set stat points click triggers
    document.querySelectorAll('.btn-icon-add').forEach(btn => {
        btn.onclick = (e) => {
            const statKey = e.target.getAttribute('data-stat');
            handleAllocateStat(statKey);
        };
        // Disable click triggers if no stat points available
        if (char.statPoints <= 0) {
            btn.style.opacity = '0.3';
            btn.style.cursor = 'not-allowed';
        } else {
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        }
    });

    // Class selection visibility
    const classPanel = document.getElementById('class-selection-panel');
    if (char.level >= 10 && !char.class) {
        classPanel.style.display = 'block';
        document.querySelectorAll('.class-btn').forEach(btn => {
            btn.onclick = (e) => {
                const cls = e.target.getAttribute('data-class');
                handleChooseClass(cls);
            };
        });
    } else {
        classPanel.style.display = 'none';
    }
}

function handleAllocateStat(statKey) {
    if (gamifyState.character.statPoints <= 0) return;
    
    gamifyState.character.stats[statKey] = (gamifyState.character.stats[statKey] || 0) + 1;
    gamifyState.character.statPoints -= 1;

    saveGamifyState(() => {
        loadGamifyData();
        showToast(`Allocated 1 point to ${statKey.toUpperCase()}!`);
    });
}

function handleChooseClass(className) {
    if (gamifyState.character.level < 10) return;
    gamifyState.character.class = className;

    saveGamifyState(() => {
        loadGamifyData();
        showToast(`Congratulations! You unlocked class role: ${className}! 🎉`);
    });
}

function renderInventoryGrids() {
    const inv = gamifyState.inventory || { eggs: [], potions: [], food: [] };
    const eggs = inv.eggs || [];
    const potions = inv.potions || [];
    const food = inv.food || [];

    const eggsGrid = document.getElementById('eggs-grid');
    const potionsGrid = document.getElementById('potions-grid');
    const foodGrid = document.getElementById('food-grid');

    const eggSelect = document.getElementById('hatch-egg-select');
    const potionSelect = document.getElementById('hatch-potion-select');

    eggsGrid.innerHTML = '';
    potionsGrid.innerHTML = '';
    foodGrid.innerHTML = '';

    eggSelect.innerHTML = '<option value="">-- Select Egg --</option>';
    potionSelect.innerHTML = '<option value="">-- Select Potion --</option>';

    // Render Eggs
    if (eggs.length === 0) {
        eggsGrid.innerHTML = `<span class="empty-tile-msg">No Eggs Collected. Practice Good/Easy reviews to discover drops!</span>`;
    } else {
        const uniqueEggs = [...new Set(eggs)];
        uniqueEggs.forEach(egg => {
            const count = eggs.filter(e => e === egg).length;
            const tile = document.createElement('div');
            tile.className = 'inventory-tile';
            tile.innerHTML = `🥚`;
            tile.title = `${egg} (Count: ${count})`;
            eggsGrid.appendChild(tile);

            const opt = document.createElement('option');
            opt.value = egg;
            opt.textContent = `${egg} (x${count})`;
            eggSelect.appendChild(opt);
        });
    }

    // Render Potions
    if (potions.length === 0) {
        potionsGrid.innerHTML = `<span class="empty-tile-msg">No Hatching Potions Available. Try shopping or check drop drops!</span>`;
    } else {
        const uniquePotions = [...new Set(potions)];
        uniquePotions.forEach(pot => {
            const count = potions.filter(p => p === pot).length;
            const tile = document.createElement('div');
            tile.className = 'inventory-tile';
            tile.innerHTML = `🧪`;
            tile.title = `${pot} (Count: ${count})`;
            potionsGrid.appendChild(tile);

            const opt = document.createElement('option');
            opt.value = pot;
            opt.textContent = `${pot} (x${count})`;
            potionSelect.appendChild(opt);
        });
    }

    // Render Food
    if (food.length === 0) {
        foodGrid.innerHTML = `<span class="empty-tile-msg">No Food Collected. Feed pets to grow them.</span>`;
    } else {
        const uniqueFood = [...new Set(food)];
        uniqueFood.forEach(fd => {
            const count = food.filter(f => f === fd).length;
            const tile = document.createElement('div');
            tile.className = 'inventory-tile';
            tile.innerHTML = fd.includes('Berry') || fd.includes('fruit') ? `🍎` : `🍇`;
            tile.title = `${fd} (Count: ${count}) - Click to eat/restore 10 HP`;
            tile.style.cursor = 'pointer';
            tile.onclick = () => handleConsumeFood(fd);
            foodGrid.appendChild(tile);
        });
    }
}

function handleConsumeFood(foodName) {
    const inv = gamifyState.inventory;
    const idx = inv.food.indexOf(foodName);
    if (idx === -1) return;

    // Restore HP
    const char = gamifyState.character;
    if (char.hp >= char.maxHp) {
        showToast("Health is already full!", true);
        return;
    }

    inv.food.splice(idx, 1);
    char.hp = Math.min(char.maxHp, char.hp + 10);

    saveGamifyState(() => {
        loadGamifyData();
        showToast(`Ate ${foodName}! Restored 10 HP.`);
    });
}

function handleHatchCompanion() {
    const eggSelect = document.getElementById('hatch-egg-select');
    const potionSelect = document.getElementById('hatch-potion-select');

    const egg = eggSelect.value;
    const potion = potionSelect.value;

    if (!egg || !potion) {
        showToast("Please select both an Egg and Potion.", true);
        return;
    }

    // Remove from inventory
    const inv = gamifyState.inventory;
    const eggIdx = inv.eggs.indexOf(egg);
    const potIdx = inv.potions.indexOf(potion);

    if (eggIdx === -1 || potIdx === -1) return;

    inv.eggs.splice(eggIdx, 1);
    inv.potions.splice(potIdx, 1);

    // Hatch matching companion pet
    let newPet = "";
    if (egg.includes("Dragon")) newPet = "Linear Dragon";
    else if (egg.includes("Phoenix")) newPet = "Recursive Phoenix";
    else if (egg.includes("Ent")) newPet = "Tree Ent";
    else if (egg.includes("Griffin")) newPet = "Graph Griffin";
    else newPet = "Linear Dragon";

    gamifyState.pets = gamifyState.pets || [];
    if (!gamifyState.pets.includes(newPet)) {
        gamifyState.pets.push(newPet);
    }

    saveGamifyState(() => {
        loadGamifyData();
        showToast(`⚡ Magic combination hatched a new companion: ${newPet}! 🐉`);
    });
}

function renderCompanionsStable() {
    const pets = gamifyState.pets || [];
    const active = gamifyState.activeCompanion;

    const bannerName = document.getElementById('active-companion-name');
    bannerName.textContent = active ? active : "None equipped";

    const container = document.getElementById('companions-list');
    container.innerHTML = '';

    if (pets.length === 0) {
        container.innerHTML = `<span class="empty-tile-msg" style="grid-column: 1 / -1; font-size:13px; text-align:left;">You haven't hatched any pets yet. Hatch eggs inside the Inventory tab!</span>`;
        return;
    }

    const companionMap = {
        "Linear Dragon": { icon: "🐉", name: "Linear Dragon" },
        "Recursive Phoenix": { icon: "🐦", name: "Recursive Phoenix" },
        "Tree Ent": { icon: "🌲", name: "Tree Ent" },
        "Graph Griffin": { icon: "🦅", name: "Graph Griffin" }
    };

    pets.forEach(petName => {
        const p = companionMap[petName] || { icon: "👾", name: petName };
        const card = document.createElement('div');
        card.className = 'companion-card';
        
        const isActive = active === petName;
        
        card.innerHTML = `
            <span class="companion-emoji">${p.icon}</span>
            <span class="companion-title">${p.name}</span>
            <button class="btn ${isActive ? 'btn-secondary' : 'btn-primary'} equip-companion-btn" data-pet="${petName}">
                ${isActive ? 'Unequip' : 'Equip companion'}
            </button>
        `;
        container.appendChild(card);
    });

    // Bind equip click handlers
    document.querySelectorAll('.equip-companion-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const pet = e.currentTarget.getAttribute('data-pet');
            handleEquipCompanion(pet);
        });
    });
}

function handleEquipCompanion(petName) {
    if (gamifyState.activeCompanion === petName) {
        gamifyState.activeCompanion = null;
    } else {
        gamifyState.activeCompanion = petName;
    }

    saveGamifyState(() => {
        loadGamifyData();
        showToast(gamifyState.activeCompanion ? `Equipped ${petName} as your companion!` : `Unequipped companion.`);
    });
}

function renderRewardsAndShop() {
    const gold = gamifyState.character.gold || 0;
    const rewards = gamifyState.customRewards || [];

    const list = document.getElementById('custom-rewards-list');
    list.innerHTML = '';

    if (rewards.length === 0) {
        list.innerHTML = `<li style="justify-content: center; color: var(--md-text-low); font-style: italic; font-size:12px;">No custom rewards. Add custom routine rewards below!</li>`;
    } else {
        rewards.forEach(r => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="reward-info">
                    <span style="font-weight: 700; font-size: 13px;">${r.name}</span>
                    <span class="reward-cost">🪙 ${r.cost} Gold</span>
                </div>
                <div class="reward-actions">
                    <button class="btn btn-primary claim-reward-btn" data-id="${r.id}" data-cost="${r.cost}">Claim</button>
                    <button class="btn btn-secondary delete-reward-btn" data-id="${r.id}" style="color:var(--md-danger); border-color:transparent;">Delete</button>
                </div>
            `;
            list.appendChild(li);
        });
    }

    // Bind claims click listeners
    document.querySelectorAll('.claim-reward-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const cost = parseInt(e.currentTarget.getAttribute('data-cost'), 10);
            handleClaimReward(id, cost);
        });
    });

    // Bind delete click listeners
    document.querySelectorAll('.delete-reward-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            handleDeleteReward(id);
        });
    });
}

function handleBuyShopItem(itemType, cost) {
    if (gamifyState.character.gold < cost) {
        showToast("Insufficient gold balance!", true);
        return;
    }

    gamifyState.character.gold -= cost;

    if (itemType === 'potion') {
        const potions = ["Dynamic Pink", "Greedy Gold", "Backtracking Black", "BFS Blue"];
        const randPotion = potions[Math.floor(Math.random() * potions.length)];
        gamifyState.inventory.potions.push(randPotion);
        showToast(`Bought Health Potion container & received hatching ingredient: ${randPotion}! 🧪`);
    } else if (itemType === 'egg') {
        const eggs = ["Linear Dragon", "Recursive Phoenix", "Tree Ent", "Graph Griffin"];
        const randEgg = eggs[Math.floor(Math.random() * eggs.length)];
        gamifyState.inventory.eggs.push(randEgg);
        showToast(`Bought Egg container & received: ${randEgg}! 🥚`);
    }

    saveGamifyState(() => {
        loadGamifyData();
    });
}

function handleAddCustomReward() {
    const descInput = document.getElementById('reward-name-input');
    const costInput = document.getElementById('reward-cost-input');

    const name = descInput.value.trim();
    const cost = parseInt(costInput.value.trim(), 10);

    if (!name || isNaN(cost) || cost <= 0) {
        showToast("Valid description and Gold cost are required.", true);
        return;
    }

    gamifyState.customRewards = gamifyState.customRewards || [];
    gamifyState.customRewards.push({
        id: Date.now().toString(),
        name,
        cost
    });

    saveGamifyState(() => {
        descInput.value = '';
        costInput.value = '';
        loadGamifyData();
        showToast(`Added custom reward: ${name}`);
    });
}

function handleClaimReward(id, cost) {
    if (gamifyState.character.gold < cost) {
        showToast("Insufficient gold balance to claim this reward!", true);
        return;
    }

    gamifyState.character.gold -= cost;

    saveGamifyState(() => {
        loadGamifyData();
        showToast(`Claimed Reward successfully! Enjoy your routine break. 🎉`);
    });
}

function handleDeleteReward(id) {
    gamifyState.customRewards = gamifyState.customRewards.filter(r => r.id !== id);

    saveGamifyState(() => {
        loadGamifyData();
        showToast("Reward deleted.");
    });
}

function saveGamifyState(callback) {
    chrome.storage.local.set({ fsrsGamification: gamifyState }, callback);
}

function showToast(msg, isError = false) {
    const toast = document.getElementById('status-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = 'toast show ' + (isError ? 'error' : 'success');
    setTimeout(() => {
        toast.className = 'toast';
    }, 2500);
}
