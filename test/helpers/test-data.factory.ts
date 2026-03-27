/**
 * @fileoverview Test data factories for creating valid DTOs in integration tests.
 * Each factory produces the minimum valid payload that passes ValidationPipe.
 */

/**
 * Minimal valid CreateInspectionDto payload.
 * `inspectorId` is set by the controller from JWT, so not included here.
 * `identityDetails.namaInspektor` and `identityDetails.cabangInspeksi` must be
 * real UUIDs (inspector user ID and branch city ID respectively).
 */
export function createInspectionPayload(
  inspectorUserId: string,
  branchCityId: string,
  overrides: Record<string, any> = {},
) {
  const base = {
    vehiclePlateNumber: `INTTEST${Date.now().toString(36).toUpperCase()}`,
    inspectionDate: new Date().toISOString(),
    overallRating: 75,
    identityDetails: {
      namaInspektor: inspectorUserId,
      namaCustomer: 'Test Customer Name',
      cabangInspeksi: branchCityId,
    },
    vehicleData: {
      merekKendaraan: 'Toyota',
      tipeKendaraan: 'Avanza',
      tahun: 2022,
      transmisi: 'Automatic',
      warnaKendaraan: 'Hitam',
      odometer: '25000 km',
      kepemilikan: 'Pertama',
      platNomor: 'AB 1234 CD',
      pajak1Tahun: new Date('2025-12-31').toISOString(),
      pajak5Tahun: new Date('2028-12-31').toISOString(),
      biayaPajak: 2500000,
    },
    equipmentChecklist: {
      bukuService: true,
      kunciSerep: true,
      bukuManual: true,
      banSerep: true,
      bpkb: true,
      dongkrak: true,
      toolkit: true,
      noRangka: true,
      noMesin: true,
    },
    inspectionSummary: {
      interiorScore: 80,
      eksteriorScore: 85,
      kakiKakiScore: 70,
      mesinScore: 90,
      penilaianKeseluruhanScore: 75,
      indikasiTabrakan: false,
      indikasiBanjir: false,
      indikasiOdometerReset: false,
      posisiBan: 'Depan',
      merkban: 'Bridgestone',
      tipeVelg: 'Alloy',
      ketebalanBan: '5mm',
    },
    detailedAssessment: {
      testDrive: {
        bunyiGetaran: 8,
        performaStir: 8,
        perpindahanTransmisi: 9,
        stirBalance: 8,
        performaSuspensi: 7,
        performaKopling: 8,
        rpm: 8,
      },
      banDanKakiKaki: {
        banDepan: 7,
        velgDepan: 8,
        discBrake: 7,
        masterRem: 8,
        tieRod: 7,
        gardan: 8,
        banBelakang: 7,
        velgBelakang: 8,
        brakePad: 7,
        crossmember: 8,
        knalpot: 7,
        balljoint: 8,
        karetBoot: 7,
        upperLowerArm: 8,
        shockBreaker: 7,
        linkStabilizer: 8,
        racksteer: 7,
      },
      hasilInspeksiEksterior: {
        bumperDepan: 8,
        kapMesin: 8,
        lampuUtama: 9,
        panelAtap: 8,
        grill: 8,
        lampuFoglamp: 7,
        kacaBening: 8,
        wiperBelakang: 7,
        bumperBelakang: 8,
        lampuBelakang: 9,
        trunklid: 8,
        kacaDepan: 8,
        fenderKanan: 8,
        quarterPanelKanan: 8,
        pintuBelakangKanan: 8,
        spionKanan: 8,
        lisplangKanan: 8,
        sideSkirtKanan: 8,
        daunWiper: 7,
        pintuBelakang: 8,
        fenderKiri: 8,
        quarterPanelKiri: 8,
        pintuDepan: 8,
        kacaJendelaKanan: 8,
        pintuBelakangKiri: 8,
        spionKiri: 8,
        pintuDepanKiri: 8,
        kacaJendelaKiri: 8,
        lisplangKiri: 8,
        sideSkirtKiri: 8,
      },
      toolsTest: {
        tebalCatBodyDepan: 8,
        tebalCatBodyKiri: 8,
        temperatureAC: 8,
        tebalCatBodyKanan: 8,
        tebalCatBodyBelakang: 8,
        obdScanner: 8,
        tebalCatBodyAtap: 8,
        testAccu: 8,
      },
      fitur: {
        airbag: 8,
        sistemAudio: 8,
        powerWindow: 8,
        sistemAC: 8,
        remAbs: 8,
        centralLock: 8,
        electricMirror: 8,
      },
      hasilInspeksiMesin: {
        getaranMesin: 8,
        suaraMesin: 8,
        transmisi: 8,
        pompaPowerSteering: 8,
        coverTimingChain: 8,
        oliPowerSteering: 8,
        accu: 8,
        kompressorAC: 8,
        fan: 8,
        selang: 8,
        karterOli: 8,
        oliRem: 8,
        kabel: 8,
        kondensor: 8,
        radiator: 8,
        cylinderHead: 8,
        oliMesin: 8,
        airRadiator: 8,
        coverKlep: 8,
        alternator: 8,
        waterPump: 8,
        belt: 8,
        oliTransmisi: 8,
        cylinderBlock: 8,
        bushingBesar: 8,
        bushingKecil: 8,
        tutupRadiator: 8,
      },
      hasilInspeksiInterior: {
        stir: 8,
        remTangan: 8,
        pedal: 8,
        switchWiper: 8,
        lampuHazard: 8,
        switchLampu: 8,
        panelDashboard: 8,
        pembukaKapMesin: 8,
        pembukaBagasi: 8,
        jokDepan: 8,
        aromaInterior: 8,
        handlePintu: 8,
        consoleBox: 8,
        spionTengah: 8,
        tuasPersneling: 8,
        jokBelakang: 8,
        panelIndikator: 8,
        switchLampuInterior: 8,
        karpetDasar: 8,
        klakson: 8,
        sunVisor: 8,
        tuasTangkiBensin: 8,
        sabukPengaman: 8,
        trimInterior: 8,
        plafon: 8,
      },
    },
    bodyPaintThickness: {
      front: 120,
      rear: { trunk: 110, bumper: 115 },
      right: {
        frontFender: 100,
        frontDoor: 105,
        rearDoor: 110,
        rearFender: 108,
        sideSkirt: 102,
      },
      left: {
        frontFender: 100,
        frontDoor: 105,
        rearDoor: 110,
        rearFender: 108,
        sideSkirt: 102,
      },
    },
  };

  return { ...base, ...overrides };
}

/**
 * Minimal valid CreateInspectionBranchCityDto payload.
 */
export function createBranchPayload(overrides: Record<string, any> = {}) {
  const suffix = Date.now().toString(36).toUpperCase().slice(-2);
  return {
    city: `TestCity-IntTest-${suffix}`,
    code: suffix.slice(0, 3).padEnd(3, 'X'),
    isActive: true,
    ...overrides,
  };
}

/**
 * Minimal valid RegisterUserDto payload.
 */
export function createRegisterPayload(overrides: Record<string, any> = {}) {
  const uid = Date.now().toString(36);
  return {
    email: `reg${uid}inttest@test.com`,
    username: `inttest_reg_${uid}`,
    password: 'TestPass123!',
    name: 'IntTest Registered User',
    ...overrides,
  };
}

/**
 * Minimal valid CreateInspectorDto payload.
 */
export function createInspectorPayload(
  branchCityId: string,
  overrides: Record<string, any> = {},
) {
  const uid = Date.now().toString(36);
  return {
    email: `inspector_${uid}inttest@test.com`,
    username: `inttest_insp_${uid}`,
    name: 'IntTest Inspector',
    inspectionBranchCityId: branchCityId,
    ...overrides,
  };
}

/**
 * Minimal valid CreateAdminDto payload.
 */
export function createAdminPayload(overrides: Record<string, any> = {}) {
  const uid = Date.now().toString(36);
  return {
    email: `admin_${uid}inttest@test.com`,
    username: `inttest_adm_${uid}`,
    name: 'IntTest Admin User',
    password: 'AdminPass123!',
    role: 'ADMIN',
    ...overrides,
  };
}
