declare global {
  const jest: {
    fn: (...args: any[]) => any;
    mock: (moduleName: string, factory?: any, options?: any) => any;
    spyOn: (object: any, method: any) => any;
    clearAllMocks: () => void;
    resetAllMocks: () => void;
    restoreAllMocks: () => void;
    mocked: <T>(item: T, options?: any) => any;
  };
}

export {};
