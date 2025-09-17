import { Test, TestingModule } from '@nestjs/testing';
import { CustomerVehiclesController } from './customer-vehicles.controller';
import { CustomerVehiclesService } from './customer-vehicles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { CustomerVehicleListResponseDto, CustomerVehicleResponseDto } from './dto/customer-vehicle-response.dto';
import { VehiclePhotoType, VehicleTransmission, VehicleType } from '@prisma/client';

const mockVehiclesService = {
  listVehicles: jest.fn(),
  getVehicle: jest.fn(),
  createVehicle: jest.fn(),
  updateVehicle: jest.fn(),
};

const createUserDto = () =>
  ({
    id: 'user-1',
    email: 'user@example.com',
    username: 'user',
    name: 'User',
    walletAddress: null,
    role: Role.CUSTOMER,
  }) as any;

describe('CustomerVehiclesController', () => {
  let controller: CustomerVehiclesController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerVehiclesController],
      providers: [
        { provide: CustomerVehiclesService, useValue: mockVehiclesService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get(CustomerVehiclesController);
  });

  describe('listVehicles', () => {
    it('should return list payload from service', async () => {
      const user = createUserDto();
      const query = { page: 1, pageSize: 10 };
      const serviceResult: CustomerVehicleListResponseDto = {
        items: [] as CustomerVehicleResponseDto[],
        meta: { total: 0, page: 1, pageSize: 10, totalPages: 1 },
      };
      mockVehiclesService.listVehicles.mockResolvedValue(serviceResult);

      const result = await controller.listVehicles(user, query as any);
      expect(mockVehiclesService.listVehicles).toHaveBeenCalledWith(
        user.id,
        query,
      );
      expect(result).toEqual(serviceResult);
    });
  });

  describe('getVehicle', () => {
    it('should delegate to service', async () => {
      const user = createUserDto();
      const detail = { id: 'veh-1' } as any;
      mockVehiclesService.getVehicle.mockResolvedValue(detail);

      const result = await controller.getVehicle(user, 'veh-1');
      expect(mockVehiclesService.getVehicle).toHaveBeenCalledWith(
        user.id,
        'veh-1',
      );
      expect(result).toBe(detail);
    });
  });

  describe('createVehicle', () => {
    it('should throw when no files provided', async () => {
      const user = createUserDto();
      await expect(
        controller.createVehicle(user, { photos: [] } as any, []),
      ).rejects.toThrow();
    });

    it('should call service when payload valid', async () => {
      const user = createUserDto();
      const dto = {
        plateNumber: 'AB1234CD',
        year: 2020,
        transmission: VehicleTransmission.AUTOMATIC,
        vehicleType: VehicleType.SUV,
        brand: 'Toyota',
        model: 'Fortuner',
        color: 'Black',
        photos: [{ type: VehiclePhotoType.FRONT }],
      } as any;
      const files = [{ originalname: 'front.jpg', buffer: Buffer.from('x') }] as any;
      const serviceResult = { id: 'veh-1' } as any;
      mockVehiclesService.createVehicle.mockResolvedValue(serviceResult);

      const result = await controller.createVehicle(user, dto, files);
      expect(mockVehiclesService.createVehicle).toHaveBeenCalled();
      expect(result).toBe(serviceResult);
    });
  });

  describe('updateVehicle', () => {
    it('should call service for metadata update without files', async () => {
      const user = createUserDto();
      const dto = { brand: 'Updated' } as any;
      const serviceResult = { id: 'veh-1' } as any;
      mockVehiclesService.updateVehicle.mockResolvedValue(serviceResult);

      const result = await controller.updateVehicle(user, 'veh-1', dto, undefined);

      expect(mockVehiclesService.updateVehicle).toHaveBeenCalledWith(
        user.id,
        'veh-1',
        dto,
        [],
      );
      expect(result).toBe(serviceResult);
    });
  });
});
