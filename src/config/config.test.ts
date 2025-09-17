import { describe, it, expect } from 'vitest';

describe('Config Module', () => {
  it('should export config object with required properties', async () => {
    const configModule = await import('./index');
    const { config } = configModule;

    expect(config).toBeDefined();
    expect(config.DATABASE_URL).toBeDefined();
    expect(config.JWT_SECRET).toBeDefined();
    expect(config.NODE_ENV).toBeDefined();
    expect(typeof config.DATABASE_URL).toBe('string');
    expect(typeof config.JWT_SECRET).toBe('string');
    expect(typeof config.NODE_ENV).toBe('string');
  });

  it('should export dbConfig object', async () => {
    const configModule = await import('./index');
    const { dbConfig } = configModule;

    expect(dbConfig).toBeDefined();
    expect(dbConfig.url).toBeDefined();
    expect(typeof dbConfig.url).toBe('string');
  });
});