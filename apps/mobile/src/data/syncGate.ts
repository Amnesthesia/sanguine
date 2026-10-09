// One background job at a time, and a way to stop it for good before the data it works on is deleted ("Delete everything").
export class SyncGate {
  private current: Promise<unknown> | undefined;
  private closed = false;

  get running(): boolean { return this.current !== undefined; }

  /** Runs `fn` unless a job is running or the gate is closed (then null). A failure reaches the caller and frees the gate. */
  async run<T>(fn: () => Promise<T>): Promise<T | null> {
    if (this.closed || this.current) return null;
    const p = fn();
    this.current = p.catch(() => {});
    try {
      return await p;
    } finally {
      this.current = undefined;
    }
  }

  /** Refuses new jobs and resolves when the running one has finished. */
  async close(): Promise<void> {
    this.closed = true;
    await this.current;
  }
  open(): void { this.closed = false; }
}
