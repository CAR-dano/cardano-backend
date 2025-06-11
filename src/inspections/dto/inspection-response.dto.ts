/*
 * --------------------------------------------------------------------------
 * File: inspection-response.dto.ts
 * Project: car-dano-backend
 * Copyright © 2025 PT. Inspeksi Mobil Jogja
 * --------------------------------------------------------------------------
 * Description: Data Transfer Object (DTO) representing the structure of a complete
 * Inspection record when returned by API endpoints (e.g., GET /inspections, GET /inspections/:id).
 * It defines the shape of the data sent back to the client, potentially excluding
 * sensitive or internal fields from the original Prisma model.
 * --------------------------------------------------------------------------
 */
import { Inspection, Prisma } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

// Optional: Import UserResponseDto if you plan to embed user details later
// import { UserResponseDto } from '../../users/dto/user-response.dto';

/**
 * Data Transfer Object (DTO) representing a photo associated with an inspection.
 */
export class PhotoResponseDto {
  @ApiProperty({
    example: 'add815ce-d602-4e49-a360-e6012e23cead',
    description: 'The unique identifier (UUID) for the photo record.',
  })
  id: string;

  @ApiProperty({
    example: '2a2b508c-c0c5-4d41-9341-2cdc88635c8a',
    description: 'The UUID of the inspection this photo belongs to.',
  })
  inspectionId: string;

  @ApiProperty({
    example: '1748917020710-compressed-1748917126971-729831521.jpg',
    description: 'The file path of the photo.',
  })
  path: string;

  @ApiProperty({
    example: 'Foto Tambahan',
    description: 'The label assigned to the photo.',
    nullable: true,
  })
  label: string | null;

  @ApiProperty({
    example: 'General Tambahan',
    description: 'The category of the photo.',
    nullable: true,
  })
  category: string | null;

  @ApiProperty({
    example: false,
    description: 'Indicates if the photo is mandatory.',
    nullable: true,
  })
  isMandatory: boolean | null;

  @ApiProperty({
    example: null,
    description: 'The original label of the photo.',
    nullable: true,
  })
  originalLabel: string | null;

  @ApiProperty({
    example: false,
    description: 'Indicates if the photo needs attention.',
    nullable: true,
  })
  needAttention: boolean | null;

  @ApiProperty({
    example: true,
    description:
      'Indicates if the photo should be displayed in the PDF report.',
  })
  displayInPdf: boolean;

  @ApiProperty({
    example: '2025-06-03T02:18:46.983Z',
    description: 'The timestamp when the photo record was created.',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2025-06-03T02:18:46.983Z',
    description: 'The timestamp when the photo record was last updated.',
  })
  updatedAt: Date;

  constructor(partial: Partial<PhotoResponseDto>) {
    Object.assign(this, partial);
  }
}

/**
 * Data Transfer Object (DTO) representing a complete Inspection record for API responses.
 */
export class InspectionResponseDto {
  /**
   * The unique identifier (UUID) for the inspection record.
   * Primary key.
   * @example "a1b2c3d4-e5f6-7890-1234-567890abcdef"
   */
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    description: 'The unique identifier (UUID) for the inspection record.',
  })
  id: string;

  /**
   * The UUID of the user (Inspector) who submitted this inspection.
   * Can be null if not linked.
   * @example "a1b2c3d4-e5f6-7890-1234-567890abcdef"
   */
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef', // Generic example as not in provided data
    description:
      'The UUID of the user (Inspector) who submitted this inspection.',
    nullable: true,
  })
  submittedByUserId: string | null;

  /**
   * The UUID of the user (Reviewer) who last reviewed (approved/rejected) this inspection.
   * Can be null if not yet reviewed.
   * @example "a1b2c3d4-e5f6-7890-1234-567890abcdef"
   */
  @ApiProperty({
    example: null,
    description:
      'The UUID of the user (Reviewer) who last reviewed (approved/rejected) this inspection.',
    nullable: true,
  })
  reviewerId: string | null;

  /**
   * The license plate number of the inspected vehicle.
   * @example "AB 4332 KJ"
   */
  @ApiProperty({
    example: 'AB 4332 KJ',
    description: 'The license plate number of the inspected vehicle.',
    nullable: true,
  })
  vehiclePlateNumber: string | null;

  /**
   * The date and time the inspection occurred.
   * @example "2025-07-05T14:30:00.000Z"
   */
  @ApiProperty({
    example: '2025-07-05T14:30:00.000Z',
    description: 'The date and time the inspection occurred.',
    nullable: true,
  })
  inspectionDate: Date | null;

  /**
   * The overall rating assigned during the inspection.
   * @example "8"
   */
  @ApiProperty({
    example: '8',
    description: 'The overall rating assigned during the inspection.',
    nullable: true,
  })
  overallRating: string | null;

  /**
   * The current status of the inspection in its lifecycle.
   * Uses the InspectionStatus enum values (e.g., "NEED_REVIEW", "APPROVED", "ARCHIVED").
   * @example "ARCHIVED"
   */
  @ApiProperty({
    example: 'ARCHIVED',
    description: 'The current status of the inspection in its lifecycle.',
  })
  status: string; // Exposing enum as string in response is common

  /**
   * Object containing identity details (inspector, customer, branch) from the inspection form.
   * Stored as JSON in the database.
   * @example { "namaCustomer": "Steve Roger", "namaInspektor": "Tony Stark", "cabangInspeksi": "Semarang" }
   */
  @ApiProperty({
    example: {
      namaCustomer: 'Steve Roger',
      namaInspektor: 'Tony Stark',
      cabangInspeksi: 'Semarang',
    },
    description: 'Object containing identity details from the inspection form.',
    nullable: true,
  })
  identityDetails: Prisma.JsonValue | null;

  /**
   * Object containing vehicle details (make, model, year, transmission, etc.) from the inspection form.
   * Stored as JSON in the database.
   * @example { "tahun": 2023, "odometer": 15000, "platNomor": "AB 4332 KJ", "transmisi": "Automatic", "biayaPajak": 3500000, "kepemilikan": "Tangan Pertama", "pajak1Tahun": "2025-10-15", "pajak5Tahun": "2028-10-15", "tipeKendaraan": "Ioniq 5", "merekKendaraan": "Hyundai", "warnaKendaraan": "Silver" }
   */
  @ApiProperty({
    example: {
      tahun: 2023,
      odometer: 15000,
      platNomor: 'AB 4332 KJ',
      transmisi: 'Automatic',
      biayaPajak: 3500000,
      kepemilikan: 'Tangan Pertama',
      pajak1Tahun: '2025-10-15',
      pajak5Tahun: '2028-10-15',
      tipeKendaraan: 'Ioniq 5',
      merekKendaraan: 'Hyundai',
      warnaKendaraan: 'Silver',
    },
    description: 'Object containing vehicle details from the inspection form.',
    nullable: true,
  })
  vehicleData: Prisma.JsonValue | null;

  /**
   * Object containing checklist results for equipment (service book, spare key, etc.) from the inspection form.
   * Stored as JSON in the database.
   * @example { "bpkb": false, "noMesin": true, "toolkit": true, "banSerep": true, "dongkrak": true, "noRangka": true, "bukuManual": true, "kunciSerep": false, "bukuService": true }
   */
  @ApiProperty({
    example: {
      bpkb: false,
      noMesin: true,
      toolkit: true,
      banSerep: true,
      dongkrak: true,
      noRangka: true,
      bukuManual: true,
      kunciSerep: false,
      bukuService: true,
    },
    description:
      'Object containing checklist results for equipment from the inspection form.',
    nullable: true,
  })
  equipmentChecklist: Prisma.JsonValue | null;

  /**
   * Object containing summary results (scores, indicators, tire info, estimates) from the inspection form.
   * Stored as JSON in the database.
   * @example { "merkban": "Bridgestone", "tipeVelg": "Original", "posisiBan": "Bridgestone", "mesinNotes": "Suara halus", "mesinScore": 9, "ketebalanBan": "80%", "interiorNotes": "Bersih terawat", "interiorScore": 9, "kakiKakiNotes": "Aman", "kakiKakiScore": 10, "eksteriorNotes": "Baret halus pintu kanan", "eksteriorScore": 8, "indikasiBanjir": false, "indikasiTabrakan": false, "estimasiPerbaikan": [ { "harga": 700000, "namaPart": "Tie Rod Kanan Kiri" }, { "harga": 300000, "namaPart": "Spooring" } ], "deskripsiKeseluruhan": [ "Kondisi sangat baik", "Ada baret halus" ], "indikasiOdometerReset": false, "penilaianKeseluruhanScore": 9 }
   */
  @ApiProperty({
    example: {
      merkban: 'Bridgestone',
      tipeVelg: 'Original',
      posisiBan: 'Bridgestone',
      mesinNotes: 'Suara halus',
      mesinScore: 9,
      ketebalanBan: '80%',
      interiorNotes: 'Bersih terawat',
      interiorScore: 9,
      kakiKakiNotes: 'Aman',
      kakiKakiScore: 10,
      eksteriorNotes: 'Baret halus pintu kanan',
      eksteriorScore: 8,
      indikasiBanjir: false,
      indikasiTabrakan: false,
      estimasiPerbaikan: [
        {
          harga: 700000,
          namaPart: 'Tie Rod Kanan Kiri',
        },
        {
          harga: 300000,
          namaPart: 'Spooring',
        },
      ],
      deskripsiKeseluruhan: ['Kondisi sangat baik', 'Ada baret halus'],
      indikasiOdometerReset: false,
      penilaianKeseluruhanScore: 9,
    },
    description: 'Object containing summary results from the inspection form.',
    nullable: true,
  })
  inspectionSummary: Prisma.JsonValue | null;

  /**
   * Object containing detailed assessment scores across various categories from the inspection form.
   * Stored as JSON in the database.
   * @example { "fitur": { "airbag": 7, "catatan": "OK", "sistemAC": 6, "interior1": 5, "interior2": 4, "interior3": 3, "powerWindow": 2, "sistemAudio": 1 }, "testDrive": { "rpm": 10, "catatan": "OK", "stirBalance": 10, "bunyiGetaran": 10, "performaStir": 9, "performaKopling": 10, "performaSuspensi": 9, "perpindahanTransmisi": 10 }, "toolsTest": { "catatan": "OK", "testAccu": 10, "obdScanner": 10, "temperatureAC": 4, "tebalCatBodyAtap": 110, "tebalCatBodyKiri": 8, "tebalCatBodyDepan": 8, "tebalCatBodyKanan": 5, "tebalCatBodyBelakang": 1 }, "banDanKakiKaki": { "gardan": 10, "tieRod": 10, "catatan": "OK", "knalpot": 10, "banDepan": 9, "brakePad": 9, "balljoint": 10, "discBrake": 10, "karetBoot": 10, "masterRem": 10, "rocksteer": 10, "velgDepan": 10, "banBelakang": 9, "crossmember": 10, "shockBreaker": 9, "velgBelakang": 10, "upperLowerArm": 10, "linkStabilizer": 10 }, "hasilInspeksiMesin": { "fan": 10, "accu": 9, "belt": 9, "kabel": 10, "oliRem": 10, "selang": 10, "catatan": "OK", "oliMesin": 9, "radiator": 10, "coverKlep": 10, "karterOli": 10, "kondensor": 10, "transmisi": 10, "waterPump": 10, "alternator": 10, "suaraMesin": 10, "airRadiator": 10, "bushingBesar": 10, "bushingKecil": 10, "cylinderHead": 10, "getaranMesin": 10, "kompressorAC": 10, "oliTransmisi": 10, "cylinderBlock": 10, "tutupRadiator": 10, "coverTimingChain": 10, "oliPowerSteering": 10, "pompaPowerSteering": 10 }, "hasilInspeksiInterior": { "stir": 10, "pedal": 10, "plafon": 10, "catatan": "OK", "klakson": 10, "jokDepan": 9, "sunVisor": 10, "remTangan": 10, "consoleBox": 10, "handlePintu": 10, "jokBelakang": 9, "karpetDasar": 8, "lampuHazard": 10, "spionTengah": 10, "switchLampu": 10, "switchWiper": 10, "trimInterior": 9, "aromaInterior": 10, "pembukaBagasi": 10, "sabukPengaman": 10, "panelDashboard": 9, "panelIndikator": 10, "tuasPersneling": 10, "pembukaKapMesin": 10, "tuasTangkiBensin": 10, "switchLampuInterior": 10 }, "hasilInspeksiEksterior": { "grill": 10, "catatan": "Baret halus pintu kanan", "kapMesin": 10, "trunklid": 10, "daunWiper": 10, "kacaDepan": 10, "panelAtap": 10, "spionKiri": 10, "fenderKiri": 10, "kacaBening": 10, "lampuUtama": 10, "pintuDepan": 10, "spionKanan": 10, "bumperDepan": 8, "fenderKanan": 10, "lampuFoglamp": 10, "lisplangKiri": 10, "lampuBelakang": 10, "lisplangKanan": 10, "pintuBelakang": 10, "sideSkirtKiri": 10, "wiperBelakang": 10, "bumperBelakang": 9, "pintuDepanKiri": 10, "sideSkirtKanan": 10, "kacaJendelaKiri": 10, "kacaJendelaKanan": 10, "quarterPanelKiri": 10, "pintuBelakangKiri": 10, "quarterPanelKanan": 10, "pintuBelakangKanan": 10 } }
   */
  @ApiProperty({
    example: {
      fitur: {
        airbag: 7,
        catatan: 'OK',
        sistemAC: 6,
        interior1: 5,
        interior2: 4,
        interior3: 3,
        powerWindow: 2,
        sistemAudio: 1,
      },
      testDrive: {
        rpm: 10,
        catatan: 'OK',
        stirBalance: 10,
        bunyiGetaran: 10,
        performaStir: 9,
        performaKopling: 10,
        performaSuspensi: 9,
        perpindahanTransmisi: 10,
      },
      toolsTest: {
        catatan: 'OK',
        testAccu: 10,
        obdScanner: 10,
        temperatureAC: 4,
        tebalCatBodyAtap: 110,
        tebalCatBodyKiri: 8,
        tebalCatBodyDepan: 8,
        tebalCatBodyKanan: 5,
        tebalCatBodyBelakang: 1,
      },
      banDanKakiKaki: {
        gardan: 10,
        tieRod: 10,
        catatan: 'OK',
        knalpot: 10,
        banDepan: 9,
        brakePad: 9,
        balljoint: 10,
        discBrake: 10,
        karetBoot: 10,
        masterRem: 10,
        rocksteer: 10,
        velgDepan: 10,
        banBelakang: 9,
        crossmember: 10,
        shockBreaker: 9,
        velgBelakang: 10,
        upperLowerArm: 10,
        linkStabilizer: 10,
      },
      hasilInspeksiMesin: {
        fan: 10,
        accu: 9,
        belt: 9,
        kabel: 10,
        oliRem: 10,
        selang: 10,
        catatan: 'OK',
        oliMesin: 9,
        radiator: 10,
        coverKlep: 10,
        karterOli: 10,
        kondensor: 10,
        transmisi: 10,
        waterPump: 10,
        alternator: 10,
        suaraMesin: 10,
        airRadiator: 10,
        bushingBesar: 10,
        bushingKecil: 10,
        cylinderHead: 10,
        getaranMesin: 10,
        kompressorAC: 10,
        oliTransmisi: 10,
        cylinderBlock: 10,
        tutupRadiator: 10,
        coverTimingChain: 10,
        oliPowerSteering: 10,
        pompaPowerSteering: 10,
      },
      hasilInspeksiInterior: {
        stir: 10,
        pedal: 10,
        plafon: 10,
        catatan: 'OK',
        klakson: 10,
        jokDepan: 9,
        sunVisor: 10,
        remTangan: 10,
        consoleBox: 10,
        handlePintu: 10,
        jokBelakang: 9,
        karpetDasar: 8,
        lampuHazard: 10,
        spionTengah: 10,
        switchLampu: 10,
        switchWiper: 10,
        trimInterior: 9,
        aromaInterior: 10,
        pembukaBagasi: 10,
        sabukPengaman: 10,
        panelDashboard: 9,
        panelIndikator: 10,
        tuasPersneling: 10,
        pembukaKapMesin: 10,
        tuasTangkiBensin: 10,
        switchLampuInterior: 10,
      },
      hasilInspeksiEksterior: {
        grill: 10,
        catatan: 'Baret halus pintu kanan',
        kapMesin: 10,
        trunklid: 10,
        daunWiper: 10,
        kacaDepan: 10,
        panelAtap: 10,
        spionKiri: 10,
        fenderKiri: 10,
        kacaBening: 10,
        lampuUtama: 10,
        pintuDepan: 10,
        spionKanan: 10,
        bumperDepan: 8,
        fenderKanan: 10,
        lampuFoglamp: 10,
        lisplangKiri: 10,
        lampuBelakang: 10,
        lisplangKanan: 10,
        pintuBelakang: 10,
        sideSkirtKiri: 10,
        wiperBelakang: 10,
        bumperBelakang: 9,
        pintuDepanKiri: 10,
        sideSkirtKanan: 10,
        kacaJendelaKiri: 10,
        kacaJendelaKanan: 10,
        quarterPanelKiri: 10,
        pintuBelakangKiri: 10,
        quarterPanelKanan: 10,
        pintuBelakangKanan: 10,
      },
    },
    description:
      'Object containing detailed assessment scores from the inspection form.',
    nullable: true,
  })
  detailedAssessment: Prisma.JsonValue | null;

  /**
   * Object containing body paint thickness measurements from the inspection form.
   * Stored as JSON in the database.
   * @example { "left": { "rearDoor": 10, "frontDoor": 10, "rearFender": 10, "frontFender": 10 }, "rear": { "trunk": 10, "bumper": 10 }, "front": "10", "right": { "rearDoor": 10, "frontDoor": 10, "rearFender": 10, "frontFender": 10 } }
   */
  @ApiProperty({
    example: {
      left: {
        rearDoor: 10,
        frontDoor: 10,
        rearFender: 10,
        frontFender: 10,
      },
      rear: {
        trunk: 10,
        bumper: 10,
      },
      front: '10',
      right: {
        rearDoor: 10,
        frontDoor: 10,
        rearFender: 10,
        frontFender: 10,
      },
    },
    description:
      'Object containing body paint thickness measurements from the inspection form.',
    nullable: true,
  })
  bodyPaintThickness: Prisma.JsonValue | null;

  /**
   * An array containing metadata for photos associated with this inspection.
   * Each element is expected to be an object (e.g., { path: string, label?: string }).
   * Stored as a JSON array in the database.
   * @example [ { "id": "...", "path": "/uploads/photo1.jpg", "label": "front", "displayInPdf": true } ]
   */
  @ApiProperty({
    example: [
      {
        id: '...',
        path: '/uploads/photo1.jpg',
        label: 'front',
        displayInPdf: true,
      },
    ],
    description:
      'An array containing metadata for photos associated with this inspection.',
    type: PhotoResponseDto, // Specify the DTO type for array items
    isArray: true, // Indicate that this is an array
  })
  photos: PhotoResponseDto[]; // Use the new PhotoResponseDto type

  /**
   * The URL pointing to the generated PDF report file (stored off-chain).
   * Null if the report hasn't been generated/archived.
   * @example "/pdfarchived/SOL-05072025-002-1747546170449.pdf"
   */
  @ApiProperty({
    example: '/pdfarchived/SOL-05072025-002-1747546170449.pdf',
    description:
      'The URL pointing to the generated PDF report file (stored off-chain).',
    nullable: true,
  })
  urlPdf: string | null;

  /**
   * The unique Cardano NFT Asset ID representing this inspection on the blockchain.
   * Null if the NFT has not been minted yet.
   * @example "030307ee382b62d1c2541b3fc1a706384efce7f405f5c0cbbba2a9b2496e7370656374696f6e5f414220313720554c"
   */
  @ApiProperty({
    example:
      '030307ee382b62d1c2541b3fc1a706384efce7f405f5c0cbbba2a9b2496e7370656374696f6e5f414220313720554c',
    description:
      'The unique Cardano NFT Asset ID representing this inspection on the blockchain.',
    nullable: true,
  })
  nftAssetId: string | null;

  /**
   * The Cardano transaction hash for the NFT minting process.
   * Null if the transaction hasn't occurred or completed.
   * @example "b7ad6576cdfb2a386973f7193b7cd24b32806b31beb5d5bac2d4d77cfd2e5f9f"
   */
  @ApiProperty({
    example: 'b7ad6576cdfb2a386973f7193b7cd24b32806b31beb5d5bac2d4d77cfd2e5f9f',
    description: 'The Cardano transaction hash for the NFT minting process.',
    nullable: true,
  })
  blockchainTxHash: string | null;

  /**
   * The cryptographic hash (e.g., SHA-256) of the generated PDF report file.
   * Null if not yet calculated/stored.
   * @example "ad16c1c1f7a3b9eb41512022ce7b92042795d6aa7a34dce0a44c839fa43b4b5f"
   */
  @ApiProperty({
    example: 'ad16c1c1f7a3b9eb41512022ce7b92042795d6aa7a34dce0a44c839fa43b4b5f',
    description:
      'The cryptographic hash (e.g., SHA-256) of the generated PDF report file.',
    nullable: true,
  })
  pdfFileHash: string | null;

  /**
   * The timestamp indicating when the inspection was successfully archived (PDF stored, NFT minted).
   * Null if not yet archived.
   * @example "2025-05-18T06:01:32.593Z"
   */
  @ApiProperty({
    example: '2025-05-18T06:01:32.593Z',
    description:
      'The timestamp indicating when the inspection was successfully archived.',
    nullable: true,
  })
  archivedAt: Date | null;

  /**
   * The timestamp indicating when the inspection was deactivated (soft delete).
   * Null if currently active or never archived.
   * @example null
   */
  @ApiProperty({
    example: null,
    description:
      'The timestamp indicating when the inspection was deactivated (soft delete).',
    nullable: true,
  })
  deactivatedAt: Date | null;

  /**
   * Map of note field paths to their desired font sizes in the report.
   * Stored as JSON in the database.
   * @example {}
   */
  @ApiProperty({
    example: {},
    description:
      'Map of note field paths to their desired font sizes in the report.',
    nullable: true,
  })
  notesFontSizes: Prisma.JsonValue | null;

  /**
   * The timestamp when this inspection record was first created in the database.
   * @example "2025-05-17T17:55:34.539Z"
   */
  @ApiProperty({
    example: '2025-05-17T17:55:34.539Z',
    description:
      'The timestamp when this inspection record was first created in the database.',
  })
  createdAt: Date;

  /**
   * The timestamp when this inspection record was last updated in the database.
   * @example "2025-05-18T06:01:32.595Z"
   */
  @ApiProperty({
    example: '2025-05-18T06:01:32.595Z',
    description:
      'The timestamp when this inspection record was last updated in the database.',
  })
  updatedAt: Date;

  /**
   * The unique human-readable identifier for the inspection.
   * @example "SOL-05072025-002"
   */
  @ApiProperty({
    example: 'SOL-05072025-002',
    description: 'The unique human-readable identifier for the inspection.',
  })
  pretty_id: string;

  /**
   * The UUID of the user (Inspector) who performed this inspection.
   * Can be null if not linked.
   * @example "a1b2c3d4-e5f6-7890-1234-567890abcdef"
   */
  @ApiProperty({
    example: null,
    description:
      'The UUID of the user (Inspector) who performed this inspection.',
    nullable: true,
  })
  inspectorId: string | null;

  /**
   * Constructor to facilitate mapping from a Prisma Inspection entity.
   * Uses Object.assign for straightforward mapping of properties with the same name.
   * Can be extended to explicitly map or exclude fields if needed.
   * @param {Partial<Inspection & { photos: Partial<PhotoResponseDto>[] }>} partial - The Prisma Inspection entity or a partial object including photos.
   */
  constructor(
    partial: Partial<Inspection & { photos: Partial<PhotoResponseDto>[] }>,
  ) {
    // Copies properties from the Prisma entity to this DTO instance
    Object.assign(this, partial);

    // Map the photos array to PhotoResponseDto instances
    if (partial.photos && Array.isArray(partial.photos)) {
      this.photos = partial.photos.map((photo) => new PhotoResponseDto(photo));
    } else {
      this.photos = [];
    }

    // Example: If you included user relations in the service query and want to map them to UserResponseDto
    // if (partial.submittedByUser) {
    //   this.submittedByUser = new UserResponseDto(partial.submittedByUser); // Assuming UserResponseDto exists
    // }
    // if (partial.reviewer) {
    //   this.reviewer = new UserResponseDto(partial.reviewer);
    // }
  }
}
