import { IsEmail, IsString, IsDateString, IsInt, IsOptional } from 'class-validator';

export class CreateFileShareDto {
  @IsString()
  fileId: string;

  @IsEmail()
  email: string;

  @IsDateString()
  expiresAt: string;

  @IsInt()
  maxDownload: number;

  @IsOptional()
  @IsString()
  note?: string;
}
