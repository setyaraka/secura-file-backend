import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuthService {
    constructor(private jwtService: JwtService, private prisma: PrismaService) {}

    async register(email: string, password: string) {
        const existingUser = await this.prisma.user.findUnique({ where: { email } });
        if (existingUser) throw new BadRequestException('Email already in use');

        const hashedPassword = await bcrypt.hash(password, 10);
    
        const user = await this.prisma.user.create({
          data: { email, password: hashedPassword },
        });
    
        const token = this.jwtService.sign({ sub: user.id, email: user.email });
    
        return { access_token: token };
    }

    async validateUser(email: string, password: string) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (user && await bcrypt.compare(password, user.password)) {
            return user;
        }
        return null;
    }

    async login(email: string, password: string) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) throw new UnauthorizedException('Invalid credentials');

        const passwordValid = await bcrypt.compare(password, user.password);
        if (!passwordValid) throw new UnauthorizedException('Invalid credentials');

        const token = this.jwtService.sign({ sub: user.id, email: user.email });

        return { access_token: token };
    }
}
