'use strict';

/**
 * Vulta — In-Process Async Job Queue
 *
 * A lightweight FIFO queue that runs scanner jobs sequentially (or with
 * configurable concurrency) without requiring Redis/BullMQ for a demo project.
 *
 * Each job is identified by its scanId and holds:
 *   - status: 'pending' | 'running' | 'done' | 'error'
 *   - result / error (set on completion)
 */

const MAX_CONCURRENCY = 2; // run up to 2 scans in parallel
const JOB_TIMEOUT_MS  = 120_000; // 2-minute hard timeout per scan

class JobQueue {
  constructor() {
    /** @type {Map<string, { status: string, result?: any, error?: string }>} */
    this._jobs    = new Map();
    this._running = 0;
    /** @type {Array<{ scanId: string, fn: Function }>} */
    this._queue   = [];
  }

  /**
   * Add a scan job to the queue and start processing if capacity allows.
   *
   * @param {string}   scanId   - UUID of the scan record
   * @param {Function} fn       - async function that performs the scan, must return findings[]
   */
  enqueue(scanId, fn) {
    this._jobs.set(scanId, { status: 'pending' });
    this._queue.push({ scanId, fn });
    setImmediate(() => this._process());
  }

  /** Get the in-memory status snapshot for a scanId. */
  getStatus(scanId) {
    return this._jobs.get(scanId) ?? null;
  }

  /** @private */
  async _process() {
    if (this._running >= MAX_CONCURRENCY || this._queue.length === 0) return;

    const { scanId, fn } = this._queue.shift();
    this._running++;
    this._jobs.set(scanId, { status: 'running' });

    // Race the scan function against a hard timeout
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Scan timed out after ${JOB_TIMEOUT_MS / 1000}s`)),
        JOB_TIMEOUT_MS
      );
    });

    try {
      const result = await Promise.race([fn(), timeoutPromise]);
      clearTimeout(timer);
      this._jobs.set(scanId, { status: 'done', result });
    } catch (err) {
      clearTimeout(timer);
      const msg = err?.message ?? 'Unknown error';
      this._jobs.set(scanId, { status: 'error', error: msg });
      console.error(`[Queue] scan ${scanId} failed:`, msg);
    } finally {
      this._running--;
      // Kick off the next pending job
      setImmediate(() => this._process());
    }
  }
}

// Export a singleton
const queue = new JobQueue();
module.exports = queue;
