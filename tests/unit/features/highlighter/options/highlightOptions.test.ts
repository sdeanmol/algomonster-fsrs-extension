import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { HighlightOptionsManager } from '../../../../../features/highlighter/options/highlightOptions';
import { ChromeSettings } from '../../../../../types/domain';

describe('HighlightOptionsManager', () => {
  let manager: HighlightOptionsManager;

  const getFreshSettings = (): ChromeSettings => ({
    defaultHighlightColor: '#f1c40f',
    recentColors: ['#f1c40f', '#e74c3c'],
    showMarkerPopup: true,
    activePaletteIndex: 0,
    palettes: [
      { name: 'Default', colors: ['#f1c40f', '#e74c3c', '#3498db'] },
      { name: 'Custom Palette', colors: ['#9b59b6', '#2ecc71'] }
    ]
  });

  beforeEach(() => {
    delete (chrome.runtime as any).lastError;
    jest.useFakeTimers();

    document.body.innerHTML = `
      <input id="default-color" type="color" value="#f1c40f" />
      <span id="default-hex">#F1C40F</span>

      <input id="palette-name-input" value="" />
      <button id="add-slot-btn">Add Slot</button>
      <button id="save-palette-btn">💾 Save Palette</button>
      <button id="reset-palettes-btn">Reset Palettes</button>

      <div id="palette-slots-container"></div>
      <div id="palettes-list-container"></div>
      <span id="palette-count">0 / 50</span>
      <div id="status-toast"></div>
    `;

    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const result = { chromeSettings: getFreshSettings() };
      if (cb) cb(result);
      return Promise.resolve(result);
    });

    (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
      if (cb) cb();
      return Promise.resolve();
    });

    manager = new HighlightOptionsManager();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    delete (chrome.runtime as any).lastError;
  });

  describe('init and default settings loading', () => {
    it('initializes manager and renders slots and palettes list', () => {
      manager.init();
      expect(chrome.storage.local.get).toHaveBeenCalled();

      const slotsContainer = document.getElementById('palette-slots-container');
      expect(slotsContainer?.children.length).toBe(5);

      const palettesContainer = document.getElementById('palettes-list-container');
      expect(palettesContainer?.children.length).toBe(2);
    });

    it('sets up default palettes when chromeSettings in storage is missing palettes', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        if (cb) cb({ chromeSettings: { defaultHighlightColor: '#f1c40f' } });
      });

      manager.init();
      expect(manager.chromeSettings.palettes?.length).toBe(5);
    });

    it('handles chrome.runtime.lastError during storage get', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Storage error' };
        if (cb) cb({});
      });

      manager.init();
      expect(manager.chromeSettings.palettes).toEqual([]);
    });

    it('handles DOM exception gracefully in init', () => {
      const origGEBI = document.getElementById;
      document.getElementById = () => { throw new Error('GEBI error'); };

      expect(() => manager.init()).not.toThrow();
      document.getElementById = origGEBI;
    });
  });

  describe('event bindings and palette editing actions', () => {
    it('updates default color on input and saves on change', () => {
      manager.init();

      const defaultColorInput = document.getElementById('default-color') as HTMLInputElement;
      defaultColorInput.value = '#00ff00';

      defaultColorInput.dispatchEvent(new Event('input'));
      expect(document.getElementById('default-hex')?.textContent).toBe('#00FF00');

      defaultColorInput.dispatchEvent(new Event('change'));
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('adds a color slot when add-slot-btn is clicked', () => {
      manager.init();
      manager.editorColors = ['#f1c40f'];

      const addSlotBtn = document.getElementById('add-slot-btn') as HTMLElement;
      addSlotBtn.click();

      expect(manager.editorColors.length).toBe(2);
    });

    it('prevents adding more than 5 color slots', () => {
      manager.init();
      manager.editorColors = ['#1', '#2', '#3', '#4', '#5'];

      const addSlotBtn = document.getElementById('add-slot-btn') as HTMLElement;
      addSlotBtn.click();

      const toast = document.getElementById('status-toast');
      expect(toast?.textContent).toContain('maximum of 5 colors');
    });

    it('validates palette name, empty colors, and maximum limit of 50 palettes', () => {
      manager.init();

      const saveBtn = document.getElementById('save-palette-btn') as HTMLElement;
      saveBtn.click();

      const toast = document.getElementById('status-toast');
      expect(toast?.textContent).toContain('Please enter a palette name');

      const nameInput = document.getElementById('palette-name-input') as HTMLInputElement;
      nameInput.value = 'New Palette';
      manager.editorColors = [];

      saveBtn.click();
      expect(toast?.textContent).toContain('must contain at least 1 color');

      // Max 50 palettes validation
      manager.editorColors = ['#fff'];
      manager.chromeSettings.palettes = new Array(50).fill({ name: 'P', colors: ['#fff'] });

      saveBtn.click();
      expect(toast?.textContent).toContain('Maximum limit of 50 palettes reached');
    });

    it('creates a new palette and updates storage when form is valid', () => {
      manager.init();

      const nameInput = document.getElementById('palette-name-input') as HTMLInputElement;
      nameInput.value = 'Brand New Palette';
      manager.editorColors = ['#ff0000'];

      const saveBtn = document.getElementById('save-palette-btn') as HTMLElement;
      saveBtn.click();

      expect(chrome.storage.local.set).toHaveBeenCalled();
      const toast = document.getElementById('status-toast');
      expect(toast?.textContent).toContain('Palette created successfully');
    });

    it('updates an existing palette when editingIndex is set', () => {
      manager.init();
      manager.editingIndex = 0;

      const nameInput = document.getElementById('palette-name-input') as HTMLInputElement;
      nameInput.value = 'Updated Palette Name';
      manager.editorColors = ['#00ffff'];

      const saveBtn = document.getElementById('save-palette-btn') as HTMLElement;
      saveBtn.click();

      expect(chrome.storage.local.set).toHaveBeenCalled();
      expect(manager.chromeSettings.palettes![0].name).toBe('Updated Palette Name');
    });

    it('resets all settings to default on reset-palettes-btn click', () => {
      manager.init();

      const resetBtn = document.getElementById('reset-palettes-btn') as HTMLElement;
      resetBtn.click();

      expect(chrome.storage.local.set).toHaveBeenCalled();
      expect(manager.chromeSettings.activePaletteIndex).toBe(0);
    });
  });

  describe('editor slots rendering and palette list item actions', () => {
    it('deletes a slot row when remove button is clicked', () => {
      manager.init();
      manager.editorColors = ['#f1c40f', '#e74c3c'];
      manager.renderEditorSlots();

      const delBtn = document.querySelector('.btn-danger') as HTMLElement;
      delBtn.click();

      expect(manager.editorColors.length).toBe(1);
    });

    it('updates color on color picker input event', () => {
      manager.init();
      const picker = document.querySelector('.color-picker') as HTMLInputElement;
      picker.value = '#123456';
      picker.dispatchEvent(new Event('input'));

      expect(manager.editorColors[0]).toBe('#123456');
    });

    it('activates a palette on Activate button click', () => {
      manager.init();

      const activateBtn = document.querySelector('.btn-action-activate') as HTMLElement;
      activateBtn.click();

      expect(manager.chromeSettings.activePaletteIndex).toBe(1);
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('edits a palette on Edit button click', () => {
      manager.init();

      const editBtn = document.querySelectorAll('.btn-action-edit')[0] as HTMLElement;
      editBtn.click();

      expect(manager.editingIndex).toBe(0);
      const nameInput = document.getElementById('palette-name-input') as HTMLInputElement;
      expect(nameInput.value).toBe('Default');
    });

    it('deletes a palette on Delete button click', () => {
      manager.init();

      const deleteBtns = document.querySelectorAll('.btn-action-delete');
      (deleteBtns[0] as HTMLElement).click();

      expect(manager.chromeSettings.palettes?.length).toBe(1);
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('prevents deleting the last remaining palette', () => {
      manager.init();
      manager.chromeSettings.palettes = [{ name: 'Sole Palette', colors: ['#fff'] }];
      manager.renderPalettesList();

      const deleteBtn = document.querySelector('.btn-action-delete') as HTMLElement;
      deleteBtn.click();

      const toast = document.getElementById('status-toast');
      expect(toast?.textContent).toContain('Cannot delete the only remaining palette');
    });
  });

  describe('toast and error handling', () => {
    it('shows toast and hides it after 3000ms timer', () => {
      manager.showToast('Test Toast Notification');

      const toast = document.getElementById('status-toast');
      expect(toast?.classList.contains('show')).toBe(true);

      jest.advanceTimersByTime(3000);
      expect(toast?.classList.contains('show')).toBe(false);
    });

    it('handles chrome.runtime.lastError when saving settings', () => {
      (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Write failed' };
        if (cb) cb();
      });

      expect(() => manager.saveSettings('Message')).not.toThrow();
    });

    it('handles exceptions in event listeners and render functions gracefully', () => {
      manager.init();

      const defaultColorInput = document.getElementById('default-color') as HTMLInputElement;
      Object.defineProperty(defaultColorInput, 'value', {
        get: () => { throw new Error('Input value exception'); }
      });

      expect(() => defaultColorInput.dispatchEvent(new Event('input'))).not.toThrow();
      expect(() => defaultColorInput.dispatchEvent(new Event('change'))).not.toThrow();
    });
  });
});
