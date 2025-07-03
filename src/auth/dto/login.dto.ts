import { IsEmail, IsNotEmpty } from "class-validator";

export class LoginDto {
    @IsEmail({}, { message: 'Please provide a valid email address.' })
    email: string;

    @IsNotEmpty({ message: 'Password is required.' })
    password: string;
}