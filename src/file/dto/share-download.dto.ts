import { IsString, IsNotEmpty } from 'class-validator';

export class ShareDownloadDto {
  @IsString()
  @IsNotEmpty()
  password: string;
}