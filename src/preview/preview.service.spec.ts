import { Test, TestingModule } from '@nestjs/testing';
import { PreviewService } from './preview.service';

describe('PreviewService', () => {
  let service: PreviewService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PreviewService],
    }).compile();

    service = module.get<PreviewService>(PreviewService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
