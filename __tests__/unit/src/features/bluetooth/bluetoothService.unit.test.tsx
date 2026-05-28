import { BluetoothService } from "@/src/features/bluetooth/BluetoothService";
import { requestBluetoothPermissions } from "@/src/features/bluetooth/hooks/requestBluetoothPermission";
import { BleManager, Device } from "react-native-ble-plx";



{/**SETUP */ }

{/**bleManager Mocking */ }
jest.mock("react-native-ble-plx", () => {
  const mockBleManagerInstance = {
    startDeviceScan: jest.fn(),
    stopDeviceScan: jest.fn(),
    connectToDevice: jest.fn(),
    destroy: jest.fn(),
  };

  return {
    BleManager: jest.fn(() => mockBleManagerInstance),
    Device: jest.fn(),
  };
});

const mockBleManager = new BleManager() as jest.Mocked<BleManager>;


{/**requestBluetoothPermission Mocking */ }
jest.mock("@/src/features/bluetooth/hooks/requestBluetoothPermission", () => ({
  requestBluetoothPermissions: jest.fn()
}));

const mockRequestBluetoothPermissions =
  requestBluetoothPermissions as jest.MockedFunction<typeof requestBluetoothPermissions>;




let testBluetoothService: BluetoothService;

beforeEach(() => {
  jest.clearAllMocks();
  testBluetoothService = new BluetoothService(mockBleManager);
});


{/**TEST */ }

describe("bluetoothService.IsTriareDevice. May change when the real protocol is done", () => {
  it("should return true when name and service uuid are the good ones", () => {
    const bleDevice = {
      name: "TRIARE-001",
      localName: "TRIARE Local",
      serviceUUIDs: ["00000000-0000-0000-0000-000000000011"],
    } as Device;

    expect(testBluetoothService.isTriareDevice(bleDevice)).toBe(true);
  });

  it("should return true when name is good but not service's uuid", () => {
    const bleDevice = {
      name: "STM32WB0",
      localName: "TRIARE Local",
      serviceUUIDs: ["baduuid"],
    } as Device;

    expect(testBluetoothService.isTriareDevice(bleDevice)).toBe(true);
  });

  it("should return true when name is not good but service's uuid is", () => {
    const bleDevice = {
      name: "badName",
      localName: null,
      serviceUUIDs: ["00000000-0000-0000-0000-000000000011"],
    } as Device;

    expect(testBluetoothService.isTriareDevice(bleDevice)).toBe(true);
  });

  it("should return false when name and service's uuid are not good", () => {
    const bleDevice = {
      name: "badName",
      localName: null,
      serviceUUIDs: ["baduuid"],
    } as Device;

    expect(testBluetoothService.isTriareDevice(bleDevice)).toBe(false);
  });

  it("should return false when name and service's uuid are null", () => {
    const bleDevice = {
      name: null,
      localName: null,
      serviceUUIDs: null,
    } as Device;

    expect(testBluetoothService.isTriareDevice(bleDevice)).toBe(false);
  });

  it("should throw and exeption when a null device is given", () => {
    const bleDevice = null;

    expect(() => {
      // @ts-expect-error Testing invalid runtime inpu
      testBluetoothService.isTriareDevice(bleDevice);
    }).toThrow();

  });
});


describe('bluetoorhService.scanForTriareDevice', () => {
  it("should not scan if permission is denied", async () => {
    mockRequestBluetoothPermissions.mockResolvedValue(false)

    const onDeviceFound = jest.fn();
    const onError = jest.fn();

    await testBluetoothService.scanForTriareDevice(onDeviceFound, onError)

    expect(mockRequestBluetoothPermissions).toHaveBeenCalledTimes(1);
    expect(mockBleManager.startDeviceScan).not.toHaveBeenCalled();

  });

  it("should scan if permission is granted", async () => {

    mockRequestBluetoothPermissions.mockResolvedValue(true)

    const onDeviceFound = jest.fn();
    const onError = jest.fn();


    await testBluetoothService.scanForTriareDevice(onDeviceFound, onError)

    expect(mockRequestBluetoothPermissions).toHaveBeenCalledTimes(1);
    expect(mockBleManager.startDeviceScan).toHaveBeenCalledWith(null, null, expect.any(Function));
    expect(onDeviceFound).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();

  });

  it("should call onError when scan returns an error", async () => {
    (requestBluetoothPermissions as jest.Mock).mockResolvedValue(true);

    const onDeviceFound = jest.fn();
    const onError = jest.fn();

    await testBluetoothService.scanForTriareDevice(onDeviceFound, onError);

    const scanCallback = (mockBleManager.startDeviceScan as jest.Mock).mock.calls[0][2];

    scanCallback({ message: "Bluetooth error" }, null);

    expect(onError).toHaveBeenCalled();
    expect(onDeviceFound).not.toHaveBeenCalled();
  })

  it("should not crash if onError is not provided", async () => {
    (requestBluetoothPermissions as jest.Mock).mockResolvedValue(true);

    const onDeviceFound = jest.fn();

    await testBluetoothService.scanForTriareDevice(onDeviceFound);

    const scanCallback = (mockBleManager.startDeviceScan as jest.Mock).mock.calls[0][2];

    expect(() => {scanCallback({ message: "Bluetooth error" }, null);}).not.toThrow();
  
  })

  it("should call onDeviceFound when device is triare device", async () => {
    const bleDevice = {
      name: "TRIARE-001",
      localName: "TRIARE Local",
      serviceUUIDs: ["00000000-0000-0000-0000-000000000011"],
    } as Device;

    jest.spyOn(testBluetoothService, "isTriareDevice").mockReturnValue(true);
    (requestBluetoothPermissions as jest.Mock).mockResolvedValue(true);

    const onDeviceFound = jest.fn();

    await testBluetoothService.scanForTriareDevice(onDeviceFound);

    const scanCallback = (mockBleManager.startDeviceScan as jest.Mock).mock.calls[0][2];
    scanCallback(null, bleDevice);

    expect(onDeviceFound).toHaveBeenCalled();

  })

  it("should not call onDeviceFound when device is not triare device", async () => {
    const bleDevice = {
      id: "2",
      name: "OTHER_DEVICE",
    } as Device;

    jest.spyOn(testBluetoothService, "isTriareDevice").mockReturnValue(false);
    (requestBluetoothPermissions as jest.Mock).mockResolvedValue(true);

    const onDeviceFound = jest.fn();

    await testBluetoothService.scanForTriareDevice(onDeviceFound);

    const scanCallback = (mockBleManager.startDeviceScan as jest.Mock).mock.calls[0][2];
    scanCallback(null, bleDevice);

    expect(onDeviceFound).not.toHaveBeenCalled();

  })

    it("should not call onDeviceFound when device is null", async () => {

    (requestBluetoothPermissions as jest.Mock).mockResolvedValue(true);

    const onDeviceFound = jest.fn();

    await testBluetoothService.scanForTriareDevice(onDeviceFound);

    const scanCallback = (mockBleManager.startDeviceScan as jest.Mock).mock.calls[0][2];
    scanCallback(null, null);

    expect(onDeviceFound).not.toHaveBeenCalled();

  })

  it("should throws if requestBluetoothPermissions throws", async () => {
    
  })

  it("should throws if startDeviceScan throws", async () => {

  })

});

/*

describe('', () => {

});


  it("", () => {

  });

  */