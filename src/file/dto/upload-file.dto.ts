import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";

export class UploadFileDto {
    @IsEnum(['private', 'password_protected', 'public'])
    visibility: 'private' | 'password_protected' | 'public';

    @IsOptional()
    @IsString()
    password?: string;

    @IsOptional()
    @IsDateString({}, { message: 'expiresAt must be a valid ISO date string (e.g. YYYY-MM-DD).' })
    expiresAt?: string;
}