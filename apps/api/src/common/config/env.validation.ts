import { plainToInstance } from 'class-transformer';
import { IsString, IsOptional, IsNumber, validateSync, Min } from 'class-validator';

export class EnvironmentVariables {
  @IsString()
  DATABASE_URL: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  API_PORT: number = 4000;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_ACCESS_EXPIRATION: string = '15m';

  @IsString()
  @IsOptional()
  JWT_REFRESH_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_EXPIRATION: string = '30d';

  @IsString()
  @IsOptional()
  WEB_URL: string = 'http://localhost:3000';

  @IsString()
  @IsOptional()
  LANDING_URL: string = 'http://localhost:3001';

  @IsString()
  @IsOptional()
  REDIS_URL: string = 'redis://localhost:6379';

  // Google OAuth (optional — Google login disabled if not set)
  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_ID: string;

  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_SECRET: string;

  @IsString()
  @IsOptional()
  GOOGLE_CALLBACK_URL: string;

  @IsString()
  @IsOptional()
  GOOGLE_REFRESH_TOKEN: string;

  // Admin Gmail OAuth "Connect" callback (must match a redirect URI registered
  // in Google Cloud Console). Defaults to the local API URL.
  @IsString()
  @IsOptional()
  GMAIL_OAUTH_REDIRECT_URL: string;

  // Email — generic SMTP (optional; works with Google via smtp.gmail.com).
  // Host + Port enable the SMTP transport; falls back to Gmail OAuth2, then console.
  @IsString()
  @IsOptional()
  SMTP_HOST: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  SMTP_PORT: number;

  @IsString()
  @IsOptional()
  SMTP_SECURE: string;

  @IsString()
  @IsOptional()
  SMTP_USER: string;

  @IsString()
  @IsOptional()
  SMTP_PASS: string;

  @IsString()
  @IsOptional()
  SMTP_FROM: string;

  // WhatsApp (optional — falls back to console logging)
  @IsString()
  @IsOptional()
  FONNTE_API_KEY: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const messages = errors.map((e) => Object.values(e.constraints || {}).join(', '));
    throw new Error(`\n❌ ENV validation failed:\n  - ${messages.join('\n  - ')}\n`);
  }

  return validatedConfig;
}
