const { EventEmitter } = require('events');
const { fetchDashboard } = require('../ftc/dashboard');
const { demoDashboard } = require('../ftc/demo');

/**
 * Polls the FTC API and keeps the latest dashboard. Emits 'dashboard' after every refresh
 * and 'next-match' when the next match changes (which is what resets the checklist).
 */
class DashboardService extends EventEmitter {
  constructor({ getSettings, getCredentials }) {
    super();
    this.getSettings = getSettings;
    this.getCredentials = getCredentials;
    this.state = { status: 'loading', data: null, error: null, updatedAt: null };
    this.timer = null;
    this.inFlight = false;
    this.rerun = false;
    // Bumped on settings changes so a fetch that started with the old settings is thrown away.
    this.generation = 0;
  }

  isConfigured() {
    return Boolean(this.getSettings().teamNumber);
  }

  settingsChanged() {
    this.generation += 1;
    this.state = { status: 'loading', data: null, error: null, updatedAt: null };
    this.emit('dashboard', this.state);
    this.refresh();
  }

  async refresh() {
    clearTimeout(this.timer);
    if (this.inFlight) {
      this.rerun = true;
      return;
    }
    this.inFlight = true;
    this.rerun = false;
    const generation = this.generation;
    const settings = this.getSettings();

    try {
      if (!this.isConfigured()) {
        this.state = { status: 'unconfigured', data: null, error: null, updatedAt: null };
      } else if (!settings.demoMode && !this.getCredentials()) {
        this.state = { status: 'error', data: null, error: 'חסר חשבון FTC API בהתקנה (ftc-credentials.json)', updatedAt: null };
      } else {
        const data = settings.demoMode
          ? demoDashboard(settings.teamNumber)
          : await fetchDashboard(settings, this.getCredentials());
        if (generation === this.generation) {
          this.state = { status: 'ok', data, error: null, updatedAt: Date.now() };
          this.emit('next-match', data.nextMatch ? data.nextMatch.key : 'none');
        }
      }
    } catch (err) {
      if (generation === this.generation) {
        // Keep the last good data on screen (e.g. the pit Wi-Fi dropped) and just flag the error.
        this.state = { ...this.state, status: this.state.data ? 'ok' : 'error', error: err.message };
      }
    } finally {
      this.inFlight = false;
      this.emit('dashboard', this.state);
      if (this.rerun) this.refresh();
      else this.timer = setTimeout(() => this.refresh(), this.getSettings().refreshSeconds * 1000);
    }
  }

  stop() {
    clearTimeout(this.timer);
  }
}

module.exports = { DashboardService };
