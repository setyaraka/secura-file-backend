import { Type } from 'class-transformer';
import { IsOptional, IsPositive } from 'class-validator';

export class PaginationDto {
    @IsOptional()
    @Type(() => Number)
    @IsPositive()
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsPositive()
    limit?: number = 10;
}
