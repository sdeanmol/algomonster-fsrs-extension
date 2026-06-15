let isLifetimeView = false;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Default Views
    loadStats(); 
    loadHeatmap(isLifetimeView);

    // 2. Settings Panel Toggle
    const settingsPanel = document.getElementById('settings-panel');
    const toggleSettingsBtn = document.getElementById('toggle-settings-btn');
    
    if (toggleSettingsBtn && settingsPanel) {
        toggleSettingsBtn.addEventListener('click', () => {
            // Check if it is currently hidden (handles both inline styles and empty states)
            const isHidden = settingsPanel.style.display === 'none' || settingsPanel.style.display === '';
            settingsPanel.style.display = isHidden ? 'block' : 'none';
            
            if (isHidden) {
                loadSavedWeights();
            }
        });
    }

    // 3. Save Custom Weights
    const saveWeightsBtn = document.getElementById('save-weights-btn');
    if (saveWeightsBtn) {
        saveWeightsBtn.addEventListener('click', () => {
            const tag = document.getElementById('weight-tag').value.trim();
            const valuesStr = document.getElementById('weight-values').value.trim();
            
            if (!tag || !valuesStr) return showStatus("Tag and weights are required.", true);

            const weightsArray = valuesStr.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
            
            if (weightsArray.length !== 17) {
                return showStatus(`Invalid array: Found ${weightsArray.length} values. Expected 17.`, true);
            }

            chrome.storage.local.get(['fsrsTopicWeights'], (result) => {
                const topicWeights = result.fsrsTopicWeights || {};
                topicWeights[tag] = weightsArray;
                
                chrome.storage.local.set({ fsrsTopicWeights: topicWeights }, () => {
                    showStatus(`Weights saved for tag: ${tag}`);
                    document.getElementById('weight-tag').value = '';
                    document.getElementById('weight-values').value = '';
                    loadSavedWeights();
                });
            });
        });
    }

    // 4. Clickable Stat Boxes (Opens full data view)
    document.getElementById('box-total')?.addEventListener('click', () => chrome.tabs.create({ url: 'data.html?view=total' }));
    document.getElementById('box-due')?.addEventListener('click', () => chrome.tabs.create({ url: 'data.html?view=due' }));
    document.getElementById('box-retention')?.addEventListener('click', () => chrome.tabs.create({ url: 'data.html?view=retention' }));

    // 5. Heatmap Lifetime Toggle
    const toggleLifetimeBtn = document.getElementById('toggle-lifetime-btn');
    if (toggleLifetimeBtn) {
        toggleLifetimeBtn.addEventListener('click', () => {
            isLifetimeView = !isLifetimeView;
            toggleLifetimeBtn.innerText = isLifetimeView ? "Show Last 12 Weeks" : "Show Lifetime";
            loadHeatmap(isLifetimeView);
        });
    }

    // 6. Export Data
    document.getElementById('export-btn')?.addEventListener('click', () => {
        chrome.storage.local.get(['fsrsCards', 'fsrsActivity', 'fsrsTopicWeights'], (result) => {
            const backupData = {
                cards: result.fsrsCards || [],
                activity: result.fsrsActivity || {},
                weights: result.fsrsTopicWeights || {}
            };
            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            chrome.downloads.download({
                url: url,
                filename: `algo_fsrs_backup_${new Date().toISOString().split('T')[0]}.json`,
                saveAs: true
            });
            showStatus("Backup exported successfully!");
        });
    });

    // 7. Import Data
    document.getElementById('import-file')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const imported = JSON.parse(event.target.result);
                let newCards = Array.isArray(imported) ? imported : (imported.cards || []);
                let newActivity = Array.isArray(imported) ? {} : (imported.activity || {});
                let newWeights = Array.isArray(imported) ? {} : (imported.weights || {});

                chrome.storage.local.set({ 
                    fsrsCards: newCards, 
                    fsrsActivity: newActivity,
                    fsrsTopicWeights: newWeights
                }, () => {
                    showStatus("Data imported successfully!");
                    loadStats(); 
                    loadHeatmap(isLifetimeView);
                    if (settingsPanel.style.display === 'block') loadSavedWeights();
                });
            } catch (err) {
                showStatus("Error reading file.", true);
            }
        };
        reader.readAsText(file);
    });
});

// --- Helper Functions ---

function loadSavedWeights() {
    chrome.storage.local.get(['fsrsTopicWeights'], (result) => {
        const topicWeights = result.fsrsTopicWeights || {};
        const listEl = document.getElementById('active-weights-list');
        if (!listEl) return;
        
        listEl.innerHTML = '';
        
        if (Object.keys(topicWeights).length === 0) {
            listEl.innerHTML = '<li>No custom profiles saved. Using standard defaults.</li>';
            return;
        }

        for (const [tag, weights] of Object.entries(topicWeights)) {
            const li = document.createElement('li');
            li.style.marginBottom = "4px";
            li.innerHTML = `<strong>${tag}</strong> <button data-tag="${tag}" class="delete-weight-btn" style="background:none; border:none; color:#e74c3c; cursor:pointer; font-size:10px;">[Delete]</button>`;
            listEl.appendChild(li);
        }

        document.querySelectorAll('.delete-weight-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetTag = e.target.getAttribute('data-tag');
                delete topicWeights[targetTag];
                chrome.storage.local.set({ fsrsTopicWeights: topicWeights }, loadSavedWeights);
            });
        });
    });
}

function loadStats() {
    chrome.storage.local.get(['fsrsCards'], (result) => {
        const cards = result.fsrsCards || [];
        const now = new Date().getTime();
        
        const totalEl = document.getElementById('total-cards');
        const dueEl = document.getElementById('due-cards');
        const retentionEl = document.getElementById('retention-rate');

        if (totalEl) totalEl.innerText = cards.length;
        if (dueEl) dueEl.innerText = cards.filter(c => c.due <= now).length;
        
        let totalReps = 0;
        let totalLapses = 0;
        cards.forEach(card => {
            totalReps += card.reps || 0;
            totalLapses += card.lapses || 0;
        });

        if (retentionEl) {
            let retentionStr = "0%";
            if (totalReps > 0) {
                const rate = ((totalReps - totalLapses) / totalReps) * 100;
                retentionStr = Math.round(rate) + "%";
            }
            retentionEl.innerText = retentionStr;
        }
    });
}

function loadHeatmap(lifetime = false) {
    chrome.storage.local.get(['fsrsActivity'], (result) => {
        const activity = result.fsrsActivity || {};
        const grid = document.getElementById('heatmap-grid');
        if (!grid) return;
        
        grid.innerHTML = ''; 

        const today = new Date();
        const dayOfWeek = today.getDay(); 
        
        let totalDays = 0;
        let startDate = new Date(today);

        if (lifetime && Object.keys(activity).length > 0) {
            const dateKeys = Object.keys(activity).sort();
            const oldestDateParts = dateKeys[0].split('-'); 
            const oldestDate = new Date(oldestDateParts[0], oldestDateParts[1] - 1, oldestDateParts[2]);
            oldestDate.setDate(oldestDate.getDate() - oldestDate.getDay());
            
            const diffTime = today.getTime() - oldestDate.getTime();
            totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; 
            startDate = oldestDate;
        } else {
            totalDays = (11 * 7) + (dayOfWeek + 1); 
            startDate.setDate(today.getDate() - totalDays + 1);
        }

        for (let i = 0; i < totalDays; i++) {
            const cellDate = new Date(startDate);
            cellDate.setDate(startDate.getDate() + i);
            
            const dateString = new Date(cellDate.getTime() - (cellDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            const count = activity[dateString] || 0;

            const cell = document.createElement('div');
            cell.className = 'heatmap-cell';
            cell.title = count === 1 ? `1 review on ${dateString}` : `${count} reviews on ${dateString}`;

            if (count === 0) cell.classList.add('level-0');
            else if (count <= 2) cell.classList.add('level-1');
            else if (count <= 5) cell.classList.add('level-2');
            else if (count <= 8) cell.classList.add('level-3');
            else cell.classList.add('level-4');

            grid.appendChild(cell);
        }

        setTimeout(() => {
            grid.scrollLeft = grid.scrollWidth;
        }, 10);
    });
}

function showStatus(msg, isError = false) {
    const el = document.getElementById('status-msg');
    if (!el) return;
    el.innerText = msg;
    el.style.color = isError ? "#e74c3c" : "#2ecc71";
    setTimeout(() => el.innerText = "", 3000);
}