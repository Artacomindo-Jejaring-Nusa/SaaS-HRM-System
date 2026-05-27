// Jest compatibility shim for Vitest imports
export const describe = (globalThis as any).describe;
export const it = (globalThis as any).it;
export const test = (globalThis as any).test;
export const expect = (globalThis as any).expect;
export const beforeEach = (globalThis as any).beforeEach;
export const afterEach = (globalThis as any).afterEach;
export const beforeAll = (globalThis as any).beforeAll;
export const afterAll = (globalThis as any).afterAll;

export const vi = {
  fn: (...args: any[]) => jest.fn(...args),
  mock: (path: string, factory?: any) => {
    // Under Jest, jest.mock must be called in module scope, but vi.mock can be inside describes.
    // However, Jest allows jest.mock at the top level or via this shim if called early.
    return jest.mock(path, factory);
  },
  spyOn: (object: any, method: any) => jest.spyOn(object, method),
  clearAllMocks: () => jest.clearAllMocks(),
  resetAllMocks: () => jest.resetAllMocks(),
  restoreAllMocks: () => jest.restoreAllMocks(),
  mocked: (item: any) => {
    // Return a mocked wrapper compatible with Jest
    return item;
  }
};
