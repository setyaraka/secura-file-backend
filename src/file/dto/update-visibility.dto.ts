import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateVisibilityDto {
  @IsEnum(['private', 'password_protected', 'public'])
  visibility: 'private' | 'password_protected' | 'public';

  @IsOptional()
  @IsString()
  password?: string;
}