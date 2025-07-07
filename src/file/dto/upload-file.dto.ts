import { IsDateString, IsOptional, IsString } from "class-validator";

export class UploadFileDto {
    @IsOptional()
    @IsString()
    password?: string;

    @IsOptional()
    @IsDateString({}, { message: 'expiresAt must be a valid ISO date string (e.g. YYYY-MM-DD).' })
    expiresAt?: string;
}