import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('configuração do plugin Swagger', () => {
  it('habilita a inferência automática dos schemas dos DTOs', () => {
    const config = JSON.parse(
      readFileSync(resolve(__dirname, '../nest-cli.json'), 'utf8'),
    ) as {
      compilerOptions?: {
        plugins?: Array<string | { name?: string; options?: unknown }>;
      };
    };

    expect(config.compilerOptions?.plugins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: '@nestjs/swagger',
        }),
      ]),
    );
  });
});
