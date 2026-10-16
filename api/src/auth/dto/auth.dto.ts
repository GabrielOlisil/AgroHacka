export class RegisterDto {
  nome!: string;
  email!: string;
  senha!: string;
  nomeFazenda!: string;
  telefone?: string;
}

export class LoginDto {
  email!: string;
  senha!: string;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    nome: string;
    email: string;
    role: string;
    farmId: string | null;
    farmNome?: string;
  };
}
