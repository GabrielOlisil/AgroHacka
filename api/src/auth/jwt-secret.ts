// Public by design (it is in the repository): only acceptable outside production.
export const DEV_JWT_SECRET = 'agrohack-jwt-secret-key-2026';

export function resolveJwtSecret(env: Record<string, string | undefined>): string {
  const secret = env.JWT_SECRET?.trim();
  if (env.NODE_ENV !== 'production') return secret || DEV_JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET é obrigatório em produção.');
  if (secret === DEV_JWT_SECRET)
    throw new Error('JWT_SECRET de produção não pode ser o segredo público de desenvolvimento.');
  return secret;
}
