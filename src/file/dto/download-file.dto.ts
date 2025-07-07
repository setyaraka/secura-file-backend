import { IsOptional, IsString } from "class-validator";

export class DownloadFileDto {
    @IsOptional()
    @IsString()
    password?: string;
}