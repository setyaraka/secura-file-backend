import { IsDateString, IsOptional } from "class-validator";

export class UploadFileDto {
    @IsOptional()
    @IsDateString({}, { message: 'expiresAt must be a valid ISO date string (e.g. YYYY-MM-DD).' })
    expiresAt?: string;
}