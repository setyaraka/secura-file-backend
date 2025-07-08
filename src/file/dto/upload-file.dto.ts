import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";

export class UpdateFileMetadataDto {
    @IsString()
    fileId: string;

    @IsEnum(['private', 'password_protected', 'public'])
    visibility: 'private' | 'password_protected' | 'public';

    @IsOptional()
    @IsInt()
    @Min(1)
    downloadLimit?: number;

    @IsOptional()
    @IsString()
    password?: string;

    @IsOptional()
    @IsDateString({}, { message: 'expiresAt must be a valid ISO date string (e.g. YYYY-MM-DD).' })
    expiresAt?: string;
}