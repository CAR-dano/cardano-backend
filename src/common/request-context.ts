import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextStore {
  requestId: string;
}

const requestContextStorage = new AsyncLocalStorage<RequestContextStore>();

export class RequestContext {
  static run<T>(store: RequestContextStore, callback: () => T): T {
    return requestContextStorage.run(store, callback);
  }

  static getStore(): RequestContextStore | undefined {
    return requestContextStorage.getStore();
  }

  static getRequestId(): string | undefined {
    return requestContextStorage.getStore()?.requestId;
  }
}
