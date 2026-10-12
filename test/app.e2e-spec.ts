import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { UserController } from '../src/modules/user/user.controller';
import { UsuariosService } from '../src/modules/user/user.service';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { ConfigService } from '@nestjs/config';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [AppController, UserController],
      providers: [AppService, JwtStrategy,
        { provide: ConfigService, useValue: { get: () => 'http-test-only' } },
        { provide: UsuariosService, useValue: {} },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  }, 60000);

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  afterEach(async () => {
    await app?.close();
  });

  it('/user (POST) rejects requests without a JWT', () => {
    return request(app.getHttpServer()).post('/user').send({}).expect(401);
  });
});
