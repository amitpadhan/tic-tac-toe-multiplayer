/**
 * Main Application Hub & Orchestrator
 * - Main Game Selector (Tic-Tac-Toe Pro & Dots and Boxes)
 * - URL Routing & Room Link auto-handling
 * - Global Audio, Themes, Modals, Reactions, and Toasts
 */

(function () {
  'use strict';

  // Global Toast function
  window.showAppToast = function (text) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = text;
    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 2800);
  };

  // Global Floating Reaction function
  window.triggerFloatingReaction = function (sender, emoji, isSelf) {
    const streams = document.querySelectorAll('.reaction-stream');
    streams.forEach(stream => {
      const toast = document.createElement('div');
      toast.className = 'reaction-toast';
      toast.innerHTML = `<span>${emoji}</span> <span>${isSelf ? 'You' : sender}</span>`;
      stream.appendChild(toast);

      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 2900);
    });
    if (window.soundFX) window.soundFX.playReaction();
  };

  function setupSoundTheme() {
    const soundIcon = document.getElementById('sound-icon');
    const btnSound = document.getElementById('btn-sound-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const btnTheme = document.getElementById('btn-theme-toggle');

    if (window.soundFX && window.soundFX.isMuted()) {
      soundIcon.textContent = '🔇';
    }

    if (btnSound) {
      btnSound.addEventListener('click', () => {
        const isMuted = window.soundFX.toggleMute();
        soundIcon.textContent = isMuted ? '🔇' : '🔊';
        if (!isMuted) window.soundFX.playClick();
      });
    }

    const savedTheme = localStorage.getItem('arcade_theme') || 'dark';
    if (savedTheme === 'light') {
      document.body.classList.add('theme-light');
      if (themeIcon) themeIcon.textContent = '☀️';
    } else {
      if (themeIcon) themeIcon.textContent = '🌙';
    }

    if (btnTheme) {
      btnTheme.addEventListener('click', () => {
        window.soundFX.playClick();
        const isLight = document.body.classList.toggle('theme-light');
        if (themeIcon) themeIcon.textContent = isLight ? '☀️' : '🌙';
        localStorage.setItem('arcade_theme', isLight ? 'light' : 'dark');
      });
    }
  }

  function setupGlobalModals() {
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetId = e.currentTarget.dataset.close;
        const modalEl = document.getElementById(targetId);
        if (modalEl) modalEl.classList.add('hidden');
      });
    });

    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.add('hidden');
        }
      });
    });
  }

  function showGameSelector() {
    const viewSelector = document.getElementById('view-game-selector');
    const containerTtt = document.getElementById('game-container-ttt');
    const containerDots = document.getElementById('game-container-dots');
    const logoTag = document.getElementById('main-logo-tag');
    const btnSelectorNav = document.getElementById('btn-hub-nav');

    if (window.networkManager) {
      window.networkManager.disconnect();
    }
    if (window.tttController) {
      window.tttController.returnToMenu();
    }
    if (window.dotsController) {
      window.dotsController.returnToMenu();
    }

    if (viewSelector) {
      viewSelector.classList.remove('hidden');
      viewSelector.classList.add('active');
    }
    if (containerTtt) containerTtt.classList.add('hidden');
    if (containerDots) containerDots.classList.add('hidden');
    if (logoTag) logoTag.textContent = 'ARCADE';
    if (btnSelectorNav) btnSelectorNav.classList.add('hidden');

    // Update URL without reloading
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  }

  function selectGame(gameName, roomCode = null) {
    const viewSelector = document.getElementById('view-game-selector');
    const containerTtt = document.getElementById('game-container-ttt');
    const containerDots = document.getElementById('game-container-dots');
    const logoTag = document.getElementById('main-logo-tag');
    const btnSelectorNav = document.getElementById('btn-hub-nav');

    if (viewSelector) {
      viewSelector.classList.add('hidden');
      viewSelector.classList.remove('active');
    }
    if (btnSelectorNav) btnSelectorNav.classList.remove('hidden');

    if (gameName === 'dots') {
      if (containerTtt) containerTtt.classList.add('hidden');
      if (containerDots) containerDots.classList.remove('hidden');
      if (logoTag) logoTag.textContent = 'DOTS & BOXES';

      if (window.dotsController) {
        window.dotsController.switchView('menu');
      }

      if (roomCode) {
        if (window.dotsController) {
          window.dotsController.openModal('online');
          const tabJoin = document.getElementById('dots-tab-join-room');
          if (tabJoin) tabJoin.click();
          const codeInput = document.getElementById('dots-join-room-code');
          if (codeInput) {
            codeInput.value = roomCode.toUpperCase();
            codeInput.focus();
          }
        }
      }
    } else {
      // Default to Tic-Tac-Toe
      if (containerDots) containerDots.classList.add('hidden');
      if (containerTtt) containerTtt.classList.remove('hidden');
      if (logoTag) logoTag.textContent = 'TIC-TAC-TOE';

      if (window.tttController) {
        window.tttController.switchView('menu');
      }

      if (roomCode) {
        if (window.tttController) {
          window.tttController.openModal('online');
          const tabJoin = document.getElementById('ttt-tab-join-room');
          if (tabJoin) tabJoin.click();
          const codeInput = document.getElementById('ttt-join-room-code');
          if (codeInput) {
            codeInput.value = roomCode.toUpperCase();
            codeInput.focus();
          }
        }
      }
    }
  }

  function checkUrlRouting() {
    const params = new URLSearchParams(window.location.search);
    const game = params.get('game');
    const room = params.get('room');

    if (game === 'dots') {
      selectGame('dots', room);
    } else if (game === 'tictactoe' || game === 'ttt') {
      selectGame('tictactoe', room);
    } else if (room) {
      // Default room join to tictactoe or ask
      selectGame('tictactoe', room);
    } else {
      // Show main game selector first
      showGameSelector();
    }
  }

  function initApp() {
    setupSoundTheme();
    setupGlobalModals();

    // Init controllers
    if (window.tttController) window.tttController.init();
    if (window.dotsController) window.dotsController.init();

    // Hub nav button
    const btnHubNav = document.getElementById('btn-hub-nav');
    if (btnHubNav) {
      btnHubNav.addEventListener('click', () => {
        window.soundFX.playClick();
        showGameSelector();
      });
    }

    // Selector Cards Click Handlers
    const cardSelectTtt = document.getElementById('card-select-ttt');
    if (cardSelectTtt) {
      cardSelectTtt.addEventListener('click', () => {
        window.soundFX.playClick();
        selectGame('tictactoe');
        window.history.pushState({}, '', '?game=tictactoe');
      });
    }

    const cardSelectDots = document.getElementById('card-select-dots');
    if (cardSelectDots) {
      cardSelectDots.addEventListener('click', () => {
        window.soundFX.playClick();
        selectGame('dots');
        window.history.pushState({}, '', '?game=dots');
      });
    }

    // Popstate navigation for browser back/forward buttons
    window.addEventListener('popstate', () => {
      checkUrlRouting();
    });

    // Check initial route
    checkUrlRouting();
  }

  document.addEventListener('DOMContentLoaded', initApp);
})();
