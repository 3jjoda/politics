import { AsyncLocalStorage } from 'async_hooks';

export const asyncLocalStorage = new AsyncLocalStorage();

export const getContext = () => {
    return asyncLocalStorage.getStore() || {};
};

export const updateContext = (updates = {}) => {
    const store = getContext();
    if (store) {
        Object.assign(store, updates);
    }
};