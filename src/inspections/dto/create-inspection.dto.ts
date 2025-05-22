/*
 * --------------------------------------------------------------------------
 * File: create-inspection.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object (DTO) used for creating a new inspection record.
 * This DTO defines the expected structure of the data sent in the request body
 * when using the `POST /inspections` endpoint (expecting `application/json`).
 * It includes basic data fields and properties intended to hold structured data
 * (parsed from JSON) related to different sections of the inspection form.
 * Minimal validation is applied at this stage. File uploads are handled separately.
 * --------------------------------------------------------------------------
 */
import {
  IsString,
  IsDateString,
  IsObject,
  IsOptional,
  ValidateNested,
} from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IdentityDetailsDto } from './identity-details.dto';

/**
 * Data Transfer Object (DTO) for creating a new inspection record.
 */
export class CreateInspectionDto {
  /**
   * The license plate number of the inspected vehicle.
   * @example "AB 1 DQ"
   */
  @ApiProperty({
    example: 'AB 1 DQ',
    description: 'The license plate number of the inspected vehicle.',
  })
  @IsString()
  vehiclePlateNumber: string;

  /**
   * The date and time when the inspection was performed.
   * Expected as an ISO 8601 format string in the request body.
   * @example "2025-07-05T14:30:00Z"
   */
  @ApiProperty({
    example: '2025-07-05T14:30:00Z',
    description:
      'The date and time when the inspection was performed. Expected as an ISO 8601 format string.',
  })
  @IsDateString()
  inspectionDate: string;

  /**
   * The overall rating assigned to the vehicle based on the inspection.
   * @example "8"
   */
  @ApiProperty({
    example: '8',
    description:
      'The overall rating assigned to the vehicle based on the inspection.',
  })
  @IsString()
  overallRating?: string;

  /**
   * Object containing details from the "Identitas" section of the inspection form.
   * Expected to be a valid JavaScript object after potential parsing from a JSON string by NestJS pipes.
   * Contains UUIDs for the inspector (`namaInspektor`) and the inspection branch city (`cabangInspeksi`).
   * @example { "namaInspektor": "ac5ae369-a422-426f-b01e-fad5476edda5", "namaCustomer": "Maul", "cabangInspeksi": "ac5ae369-a422-426f-b01e-fad5476edda5" }
   */
  @ApiProperty({
    example: {
      namaInspektor: 'ac5ae369-a422-426f-b01e-fad5476edda5',
      namaCustomer: 'Maul',
      cabangInspeksi: 'ac5ae369-a422-426f-b01e-fad5476edda5',
    },
    description:
      'Object containing details from the "Identitas" section of the inspection form, with UUIDs for inspector and branch city.',
  })
  @Type(() => IdentityDetailsDto)
  @ValidateNested()
  identityDetails: IdentityDetailsDto;

  /**
   * Object containing details from the "Data Kendaraan" section of the inspection form.
   */
  @ApiProperty({
    example: {
      merekKendaraan: 'Hyundai',
      tipeKendaraan: 'Ioniq 5',
      tahun: 2023,
      transmisi: 'Automatic',
      warnaKendaraan: 'Silver',
      odometer: 15000,
      kepemilikan: 'Tangan Pertama',
      platNomor: 'AB 4332 KJ',
      pajak1Tahun: '2025-05-18T00:00:00.000',
      pajak5Tahun: '2025-05-18T00:00:00.000',
      biayaPajak: 3500000,
    },
    description:
      'Object containing details from the "Data Kendaraan" section of the inspection form.',
  })
  @IsObject()
  vehicleData?: Record<string, any>;

  /**
   * Object containing details from the "Kelengkapan" section(s) of the inspection form.
   */
  @ApiProperty({
    example: {
      bukuService: true,
      kunciSerep: false,
      bukuManual: true,
      banSerep: true,
      bpkb: true,
      dongkrak: true,
      toolkit: true,
      noRangka: true,
      noMesin: true,
    },
    description:
      'Object containing details from the "Kelengkapan" section(s) of the inspection form.',
  })
  @IsObject()
  equipmentChecklist?: Record<string, any>;

  /**
   * Object containing details from the "Hasil Inspeksi" summary section of the form.
   */
  @ApiProperty({
    example: {
      interiorScore: 9,
      interiorNotes: 'Bersih terawat',
      eksteriorScore: 8,
      eksteriorNotes: 'Baret halus pintu kanan',
      kakiKakiScore: 10,
      kakiKakiNotes: 'Aman',
      mesinScore: 9,
      mesinNotes: 'Suara halus',
      penilaianKeseluruhanScore: 9,
      deskripsiKeseluruhan: ['Kondisi sangat baik', 'Ada baret halus'],
      indikasiTabrakan: false,
      indikasiBanjir: false,
      indikasiOdometerReset: false,
      posisiBan: 'Bridgestone',
      merkban: 'Bridgestone',
      tipeVelg: 'Original',
      ketebalanBan: '80%',
      estimasiPerbaikan: [
        {
          namaPart: 'Tie Rod Kanan Kiri',
          harga: 700000,
        },
        {
          namaPart: 'Spooring',
          harga: 300000,
        },
      ],
    },
    description:
      'Object containing details from the "Hasil Inspeksi" summary section of the form.',
  })
  @IsObject()
  inspectionSummary?: Record<string, any>;

  /**
   * Object containing details from the "Penilaian" section(s) of the inspection form.
   */
  @ApiProperty({
    example: {
      testDrive: {
        bunyiGetaran: 10,
        performaStir: 9,
        perpindahanTransmisi: 10,
        stirBalance: 10,
        performaSuspensi: 9,
        performaKopling: 10,
        rpm: 10,
        catatan: 'OK',
      },
      banDanKakiKaki: {
        banDepan: 9,
        velgDepan: 10,
        discBrake: 10,
        masterRem: 10,
        tieRod: 10,
        gardan: 10,
        banBelakang: 9,
        velgBelakang: 10,
        brakePad: 9,
        crossmember: 10,
        knalpot: 10,
        balljoint: 10,
        rocksteer: 10,
        karetBoot: 10,
        upperLowerArm: 10,
        shockBreaker: 9,
        linkStabilizer: 10,
        catatan: 'OK',
      },
      hasilInspeksiEksterior: {
        bumperDepan: 8,
        kapMesin: 10,
        lampuUtama: 10,
        panelAtap: 10,
        grill: 10,
        lampuFoglamp: 10,
        kacaBening: 10,
        wiperBelakang: 10,
        bumperBelakang: 9,
        lampuBelakang: 10,
        trunklid: 10,
        kacaDepan: 10,
        fenderKanan: 10,
        quarterPanelKanan: 10,
        pintuBelakangKanan: 10,
        spionKanan: 10,
        lisplangKanan: 10,
        sideSkirtKanan: 10,
        daunWiper: 10,
        pintuBelakang: 10,
        fenderKiri: 10,
        quarterPanelKiri: 10,
        pintuDepan: 10,
        kacaJendelaKanan: 10,
        pintuBelakangKiri: 10,
        spionKiri: 10,
        pintuDepanKiri: 10,
        kacaJendelaKiri: 10,
        lisplangKiri: 10,
        sideSkirtKiri: 10,
        catatan: 'Baret halus pintu kanan',
      },
      toolsTest: {
        tebalCatBodyDepan: 8,
        tebalCatBodyKiri: 8,
        temperatureAC: 4,
        tebalCatBodyKanan: 5,
        tebalCatBodyBelakang: 1,
        obdScanner: 10,
        tebalCatBodyAtap: 110,
        testAccu: 10,
        catatan: 'OK',
      },
      fitur: {
        airbag: 10,
        sistemAudio: 9,
        powerWindow: 10,
        sistemAC: 10,
        interior1: 10,
        interior2: 10,
        interior3: 10,
        catatan: 'OK',
      },
      hasilInspeksiMesin: {
        getaranMesin: 10,
        suaraMesin: 10,
        transmisi: 10,
        pompaPowerSteering: 10,
        coverTimingChain: 10,
        oliPowerSteering: 10,
        accu: 9,
        kompressorAC: 10,
        fan: 10,
        selang: 10,
        karterOli: 10,
        oliRem: 10,
        kabel: 10,
        kondensor: 10,
        radiator: 10,
        cylinderHead: 10,
        oliMesin: 9,
        airRadiator: 10,
        coverKlep: 10,
        alternator: 10,
        waterPump: 10,
        belt: 9,
        oliTransmisi: 10,
        cylinderBlock: 10,
        bushingBesar: 10,
        bushingKecil: 10,
        tutupRadiator: 10,
        catatan: 'OK',
      },
      hasilInspeksiInterior: {
        stir: 10,
        remTangan: 10,
        pedal: 10,
        switchWiper: 10,
        lampuHazard: 10,
        switchLampu: 10,
        panelDashboard: 9,
        pembukaKapMesin: 10,
        pembukaBagasi: 10,
        jokDepan: 9,
        aromaInterior: 10,
        handlePintu: 10,
        consoleBox: 10,
        spionTengah: 10,
        tuasPersneling: 10,
        jokBelakang: 9,
        panelIndikator: 10,
        switchLampuInterior: 10,
        karpetDasar: 8,
        klakson: 10,
        sunVisor: 10,
        tuasTangkiBensin: 10,
        sabukPengaman: 10,
        trimInterior: 9,
        plafon: 10,
        catatan: 'OK',
      },
    },
    description:
      'Object containing details from the "Penilaian" section(s) of the inspection form.',
  })
  @IsObject()
  detailedAssessment?: Record<string, any>;

  /**
   * Object containing details from the "Body Paint Thickness" test section of the form.
   */
  @ApiProperty({
    example: {
      front: '10',
      rear: {
        trunk: 10,
        bumper: 10,
      },
      right: {
        frontFender: 10,
        frontDoor: 10,
        rearDoor: 10,
        rearFender: 10,
      },
      left: {
        frontFender: 10,
        frontDoor: 10,
        rearDoor: 10,
        rearFender: 10,
      },
    },
    description:
      'Object containing details from the "Body Paint Thickness" test section of the form.',
  })
  @IsObject()
  bodyPaintThickness?: Record<string, any>;

  /**
   * Map of note field paths to their desired font sizes in the report.
   */
  @ApiProperty({
    example: {
      'inspectionSummary.interiorNotes': 12,
      'inspectionSummary.eksteriorNotes': 12,
      'inspectionSummary.kakiKakiNotes': 12,
      'inspectionSummary.mesinNotes': 12,
      'inspectionSummary.deskripsiKeseluruhan': 12,
      'detailedAssessment.testDrive.catatan': 12,
      'detailedAssessment.banDanKakiKaki.catatan': 12,
      'detailedAssessment.hasilInspeksiEksterior.catatan': 12,
      'detailedAssessment.toolsTest.catatan': 12,
      'detailedAssessment.fitur.catatan': 12,
      'detailedAssessment.hasilInspeksiMesin.catatan': 12,
      'detailedAssessment.hasilInspeksiInterior.catatan': 12,
    },
    description:
      'Map of note field paths to their desired font sizes in the report.',
  })
  @IsOptional()
  @IsObject()
  notesFontSizes?: object;

  // Note: Files (like 'photos') are not included in this DTO as they are handled
  // by file upload interceptors (e.g., FilesInterceptor) in the controller method.
}
