import { ApiProperty } from '@nestjs/swagger';
import { Inspection, Prisma } from '@prisma/client';

export class InspectionSummaryResponseDto {
    @ApiProperty({
        example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
        description: 'The unique identifier (UUID) for the inspection record.',
    })
    id: string;

    @ApiProperty({
        example: 'SOL-05072025-002',
        description: 'The unique human-readable identifier for the inspection.',
    })
    pretty_id: string;

    @ApiProperty({
        example: 'AB 4332 KJ',
        description: 'The license plate number of the inspected vehicle.',
        nullable: true,
    })
    vehiclePlateNumber: string | null;

    @ApiProperty({
        example: '2025-07-05T14:30:00.000Z',
        description: 'The date and time the inspection occurred.',
        nullable: true,
    })
    inspectionDate: Date | null;

    @ApiProperty({
        example: 'NEED_REVIEW',
        description: 'The current status of the inspection.',
    })
    status: string;

    @ApiProperty({
        example: {
            namaCustomer: 'Steve Roger',
            namaInspektor: 'Tony Stark',
            cabangInspeksi: 'Semarang',
        },
        description: 'Basic identity details.',
        nullable: true,
    })
    identityDetails: Prisma.JsonValue | null;

    @ApiProperty({
        example: {
            merekKendaraan: 'Hyundai',
            tipeKendaraan: 'Ioniq 5',
        },
        description: 'Basic vehicle details.',
        nullable: true,
    })
    vehicleData: Prisma.JsonValue | null;

    @ApiProperty({
        example: '2025-05-17T17:55:34.539Z',
        description: 'Creation timestamp.',
    })
    createdAt: Date;

    @ApiProperty({
        example: '2025-05-18T06:01:32.595Z',
        description: 'Last update timestamp.',
    })
    updatedAt: Date;

    constructor(partial: any) {
        this.id = partial.id;
        this.pretty_id = partial.pretty_id;
        this.vehiclePlateNumber = partial.vehiclePlateNumber;
        this.inspectionDate = partial.inspectionDate;
        this.status = partial.status;
        this.identityDetails = partial.identityDetails;
        this.vehicleData = partial.vehicleData;
        this.createdAt = partial.createdAt;
        this.updatedAt = partial.updatedAt;
    }
}
