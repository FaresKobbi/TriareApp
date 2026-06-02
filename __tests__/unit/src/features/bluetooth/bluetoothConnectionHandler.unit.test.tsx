import { BluetoothConnectionHandler } from "@/src/features/bluetooth/handler/BluetoothConnectionHandler";
import { requestBluetoothPermissions } from "@/src/features/bluetooth/requestBluetoothPermission";
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
jest.mock("@/src/features/bluetooth/requestBluetoothPermission", () => ({
  requestBluetoothPermissions: jest.fn()
}));

const mockRequestBluetoothPermissions =
  requestBluetoothPermissions as jest.MockedFunction<typeof requestBluetoothPermissions>;




let testBluetoothConnectionHandler: BluetoothConnectionHandler;

beforeEach(() => {
  jest.clearAllMocks();
  testBluetoothConnectionHandler = new BluetoothConnectionHandler(mockBleManager);
});


{/**TEST */ }

describe("bluetoothService.IsTriareDevice. May change when the real protocol is done", () => {
  it("should return true when name and service uuid are the good ones", () => {
    const bleDevice = {
      name: "TRIARE-001",
      localName: "TRIARE Local",
      serviceUUIDs: ["00000000-0000-0000-0000-000000000011"],
    } as Device;

    expect(testBluetoothConnectionHandler.isTriareDevice(bleDevice)).toBe(true);
  });

  it("should return true when name is good but not service's uuid", () => {
    const bleDevice = {
      name: "STM32WB0",
      localName: "TRIARE Local",
      serviceUUIDs: ["baduuid"],
    } as Device;

    expect(testBluetoothConnectionHandler.isTriareDevice(bleDevice)).toBe(true);
  });

  it("should return true when name is not good but service's uuid is", () => {
    const bleDevice = {
      name: "badName",
      localName: null,
      serviceUUIDs: ["00000000-0000-0000-0000-000000000011"],
    } as Device;

    expect(testBluetoothConnectionHandler.isTriareDevice(bleDevice)).toBe(true);
  });

  it("should return false when name and service's uuid are not good", () => {
    const bleDevice = {
      name: "badName",
      localName: null,
      serviceUUIDs: ["baduuid"],
    } as Device;

    expect(testBluetoothConnectionHandler.isTriareDevice(bleDevice)).toBe(false);
  });

  it("should return false when name and service's uuid are null", () => {
    const bleDevice = {
      name: null,
      localName: null,
      serviceUUIDs: null,
    } as Device;

    expect(testBluetoothConnectionHandler.isTriareDevice(bleDevice)).toBe(false);
  });

  it("should throw and exeption when a null device is given", () => {
    const bleDevice = null;

    expect(() => {
      // @ts-expect-error Testing invalid runtime input
      testBluetoothConnectionHandler.isTriareDevice(bleDevice);
    }).toThrow();

  });
});


describe('bluetoorhService.scanForTriareDevice', () => {
  it("should not scan if permission is denied", async () => {
    mockRequestBluetoothPermissions.mockResolvedValue(false)

    const onDeviceFound = jest.fn();
    const onError = jest.fn();

    await testBluetoothConnectionHandler.scanForTriareDevice(onDeviceFound, onError)

    expect(mockRequestBluetoothPermissions).toHaveBeenCalledTimes(1);
    expect(mockBleManager.startDeviceScan).not.toHaveBeenCalled();

  });

  it("should scan if permission is granted", async () => {

    mockRequestBluetoothPermissions.mockResolvedValue(true)

    const onDeviceFound = jest.fn();
    const onError = jest.fn();


    await testBluetoothConnectionHandler.scanForTriareDevice(onDeviceFound, onError)

    expect(mockRequestBluetoothPermissions).toHaveBeenCalledTimes(1);
    expect(mockBleManager.startDeviceScan).toHaveBeenCalledWith(null, null, expect.any(Function));
    expect(onDeviceFound).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();

  });

  it("should call onError when scan returns an error", async () => {
    (requestBluetoothPermissions as jest.Mock).mockResolvedValue(true);

    const onDeviceFound = jest.fn();
    const onError = jest.fn();

    await testBluetoothConnectionHandler.scanForTriareDevice(onDeviceFound, onError);

    const scanCallback = (mockBleManager.startDeviceScan as jest.Mock).mock.calls[0][2];

    scanCallback({ message: "Bluetooth error" }, null);

    expect(onError).toHaveBeenCalled();
    expect(onDeviceFound).not.toHaveBeenCalled();
  })

  it("should not crash if onError is not provided", async () => {
    (requestBluetoothPermissions as jest.Mock).mockResolvedValue(true);

    const onDeviceFound = jest.fn();

    await testBluetoothConnectionHandler.scanForTriareDevice(onDeviceFound);

    const scanCallback = (mockBleManager.startDeviceScan as jest.Mock).mock.calls[0][2];

    expect(() => { scanCallback({ message: "Bluetooth error" }, null); }).not.toThrow();

  })

  it("should call onDeviceFound when device is triare device", async () => {
    const bleDevice = {
      name: "TRIARE-001",
      localName: "TRIARE Local",
      serviceUUIDs: ["00000000-0000-0000-0000-000000000011"],
    } as Device;

    jest.spyOn(testBluetoothConnectionHandler, "isTriareDevice").mockReturnValue(true);
    (requestBluetoothPermissions as jest.Mock).mockResolvedValue(true);

    const onDeviceFound = jest.fn();

    await testBluetoothConnectionHandler.scanForTriareDevice(onDeviceFound);

    const scanCallback = (mockBleManager.startDeviceScan as jest.Mock).mock.calls[0][2];
    scanCallback(null, bleDevice);

    expect(onDeviceFound).toHaveBeenCalled();

  })

  it("should not call onDeviceFound when device is not triare device", async () => {
    const bleDevice = {
      id: "2",
      name: "OTHER_DEVICE",
    } as Device;

    jest.spyOn(testBluetoothConnectionHandler, "isTriareDevice").mockReturnValue(false);
    (requestBluetoothPermissions as jest.Mock).mockResolvedValue(true);

    const onDeviceFound = jest.fn();

    await testBluetoothConnectionHandler.scanForTriareDevice(onDeviceFound);

    const scanCallback = (mockBleManager.startDeviceScan as jest.Mock).mock.calls[0][2];
    scanCallback(null, bleDevice);

    expect(onDeviceFound).not.toHaveBeenCalled();

  })

  it("should not call onDeviceFound when device is null", async () => {

    (requestBluetoothPermissions as jest.Mock).mockResolvedValue(true);

    const onDeviceFound = jest.fn();

    await testBluetoothConnectionHandler.scanForTriareDevice(onDeviceFound);

    const scanCallback = (mockBleManager.startDeviceScan as jest.Mock).mock.calls[0][2];
    scanCallback(null, null);

    expect(onDeviceFound).not.toHaveBeenCalled();

  })

  it("should call onError if requestBluetoothPermissions throws", async () => {
    mockRequestBluetoothPermissions.mockRejectedValue(
      new Error("Permission request failed")
    );

    const onDeviceFound = jest.fn();
    const onError = jest.fn();

    await testBluetoothConnectionHandler.scanForTriareDevice(onDeviceFound, onError);

    expect(mockRequestBluetoothPermissions).toHaveBeenCalledTimes(1);
    expect(mockBleManager.startDeviceScan).not.toHaveBeenCalled();
    expect(onDeviceFound).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  })

  it("should call onError if startDeviceScan throws", async () => {
    mockRequestBluetoothPermissions.mockResolvedValue(true);

    (mockBleManager.startDeviceScan as jest.Mock).mockImplementation(() => {
      throw new Error("Scan failed");
    });

    const onDeviceFound = jest.fn();
    const onError = jest.fn();

    await testBluetoothConnectionHandler.scanForTriareDevice(onDeviceFound, onError);

    expect(mockRequestBluetoothPermissions).toHaveBeenCalledTimes(1);
    expect(mockBleManager.startDeviceScan).toHaveBeenCalledWith(
      null,
      null,
      expect.any(Function)
    );
    expect(onDeviceFound).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });

});


describe("bluetoothService.connectToDevice", () => {

  it("should connect, discover services, and return the device when the deviceId is correct", async () => {
    const mockDevice = {
      id: "valid-device-id",
      name: "TRIARE-001",
      discoverAllServicesAndCharacteristics: jest.fn().mockResolvedValue(undefined),
    } as unknown as Device;

    (mockBleManager.connectToDevice as jest.Mock).mockResolvedValue(mockDevice);

    const result = await testBluetoothConnectionHandler.connectToDevice("valid-device-id");

    expect(mockBleManager.connectToDevice).toHaveBeenCalledWith("valid-device-id");
    expect(mockDevice.discoverAllServicesAndCharacteristics).toHaveBeenCalledTimes(1);
    expect(result).toBe(mockDevice);
  });

  it("should throw when the deviceId is wrong or unavailable", async () => {
    (mockBleManager.connectToDevice as jest.Mock).mockRejectedValue(
      new Error("Device not found")
    );

    await expect(
      testBluetoothConnectionHandler.connectToDevice("non-existent-id")
    ).rejects.toThrow("Device not found");

    expect(mockBleManager.connectToDevice).toHaveBeenCalledWith("non-existent-id");
  });

  it("should throw when connectToDevice succeeds but discoverAllServicesAndCharacteristics fails", async () => {
    const mockDevice = {
      id: "valid-device-id",
      name: "TRIARE-001",
      discoverAllServicesAndCharacteristics: jest.fn().mockRejectedValue(
        new Error("Service discovery failed")
      ),
    } as unknown as Device;

    (mockBleManager.connectToDevice as jest.Mock).mockResolvedValue(mockDevice);

    await expect(
      testBluetoothConnectionHandler.connectToDevice("valid-device-id")
    ).rejects.toThrow("Service discovery failed");

    expect(mockBleManager.connectToDevice).toHaveBeenCalledWith("valid-device-id");
    expect(mockDevice.discoverAllServicesAndCharacteristics).toHaveBeenCalledTimes(1);
  });

  it("should throw when an empty deviceId is provided", async () => {
    (mockBleManager.connectToDevice as jest.Mock).mockRejectedValue(
      new Error("Device not found")
    );

    await expect(
      testBluetoothConnectionHandler.connectToDevice("")
    ).rejects.toThrow();

    expect(mockBleManager.connectToDevice).toHaveBeenCalledWith("");
  });

})