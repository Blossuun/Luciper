export class Dispatcher {
  /**
   * Ping the worker to check if it's alive.
   */
  ping(): Promise<void> {
    // No implementation
    return Promise.resolve();
  }

  /**
   * Initialize the worker with necessary configuration.
   */
  initialize(config: Record<string, unknown>): Promise<void> {
    // No implementation
    return Promise.resolve();
  }

  /**
   * Gracefully shutdown the worker.
   */
  shutdown(): Promise<void> {
    // No implementation
    return Promise.resolve();
  }
}
