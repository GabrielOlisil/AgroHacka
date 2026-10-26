export class RegisterDto {
  nome!: string;
  email!: string;
  senha!: string;
  nomeFazenda!: string;
  telefone?: string;
}

export class UpdateTelefoneDto {
  // Vazio ou nulo desativa os alertas de WhatsApp.
  telefone?: string | null;
}

export class LoginDto {
  email!: string;
  senha?: string;
  password?: string;
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
    telefone?: string;
  };
}
