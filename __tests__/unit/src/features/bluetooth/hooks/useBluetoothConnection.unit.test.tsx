import React, { act } from "react";
import { Device } from "react-native-ble-plx";
import { create } from "react-test-renderer";
import { useBluetoothConnection } from "@/src/features/bluetooth/hooks/useBluetoothConnection";
import { IBluetoothService } from "@/src/features/bluetooth/IBluetoothService";


{/**SETUP */}

{/**react-native-ble-plx Mocking */}
jest.mock("react-native-ble-plx", () => ({
  BleManager: jest.fn(),
  Device: jest.fn(),
}));

{/**
 * Minimal renderHook helper using react-test-renderer.
 * Avoids needing @testing-library/react-native as a dependency.
 */}
function renderHook<T>(hookFn: () => T) {
  const result: { current: T | null } = { current: null };

  function TestComponent() {
    result.current = hookFn();
    return null;
  }

  let renderer: ReturnType<typeof create>;
  act(() => {
    renderer = create(React.createElement(TestComponent));
  });

  return {
    result,
    rerender: () => {
      act(() => {
        renderer.update(React.createElement(TestComponent));
      });
    },
    unmount: () => {
      act(() => {
        renderer.unmount();
      });
    },
  };
}


{/**IBluetoothService mock factory*/}
function createMockBluetoothService(): jest.Mocked<IBluetoothService> {
  return {
    scanForTriareDevice: jest.fn(),
    stopScan: jest.fn(),
    connectToDevice: jest.fn(),
  };
}


{/**Reusable mock BLE Device factory */}
function createMockDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: "device-1",
    name: "TRIARE-001",
    localName: null,
    rssi: -50,
    serviceUUIDs: [],
    ...overrides,
  } as Device;
}


let mockBluetoothService: jest.Mocked<IBluetoothService>;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockBluetoothService = createMockBluetoothService();
});

afterEach(() => {
  jest.useRealTimers();
});


{/**TEST */}

describe("useBluetoothConnection initial state", () => {
  it("should start with idle status and empty devices", () => {
    const { result } = renderHook(() =>
      useBluetoothConnection(mockBluetoothService)
    );

    expect(result.current!.status).toBe("idle");
    expect(result.current!.error).toBeNull();
    expect(result.current!.triareDevicesDTO).toEqual([]);
    expect(result.current!.selectedDevice).toBeNull();
    expect(result.current!.connectedDevice).toBeNull();
  });
});


describe("useBluetoothConnection.startScan", () => {
  it("should set status to scanning and call scanForTriareDevice", () => {
    const { result } = renderHook(() =>
      useBluetoothConnection(mockBluetoothService)
    );

    act(() => {
      result.current!.startScan();
    });

    expect(result.current!.status).toBe("scanning");
    expect(result.current!.error).toBeNull();
    expect(mockBluetoothService.scanForTriareDevice).toHaveBeenCalledTimes(1);
    expect(mockBluetoothService.scanForTriareDevice).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function)
    );
  });

  it("should add discovered devices to the list via the onDeviceFound callback", () => {
    const { result } = renderHook(() =>
      useBluetoothConnection(mockBluetoothService)
    );

    act(() => {
      result.current!.startScan();
    });

    const onDeviceFound = (mockBluetoothService.scanForTriareDevice as jest.Mock)
      .mock.calls[0][0];

    const device = createMockDevice({ id: "dev-A", name: "TRIARE-A" });

    act(() => {
      onDeviceFound(device);
    });

    expect(result.current!.triareDevicesDTO).toHaveLength(1);
    expect(result.current!.triareDevicesDTO[0].id).toBe("dev-A");
  });

  it("should not add duplicate devices with the same id", () => {
    const { result } = renderHook(() =>
      useBluetoothConnection(mockBluetoothService)
    );

    act(() => {
      result.current!.startScan();
    });

    const onDeviceFound = (mockBluetoothService.scanForTriareDevice as jest.Mock)
      .mock.calls[0][0];

    const device1 = createMockDevice({ id: "dev-A", name: "TRIARE-A" });
    const device2 = createMockDevice({ id: "dev-A", name: "TRIARE-A" });

    act(() => {
      onDeviceFound(device1);
      onDeviceFound(device2);
    });

    expect(result.current!.triareDevicesDTO).toHaveLength(1);
  });

  it("should add multiple different devices", () => {
    const { result } = renderHook(() =>
      useBluetoothConnection(mockBluetoothService)
    );

    act(() => {
      result.current!.startScan();
    });

    const onDeviceFound = (mockBluetoothService.scanForTriareDevice as jest.Mock)
      .mock.calls[0][0];

    act(() => {
      onDeviceFound(createMockDevice({ id: "dev-A" }));
      onDeviceFound(createMockDevice({ id: "dev-B" }));
      onDeviceFound(createMockDevice({ id: "dev-C" }));
    });

    expect(result.current!.triareDevicesDTO).toHaveLength(3);
  });

  it("should set status to error when the scan's onError callback is invoked", () => {
    const { result } = renderHook(() =>
      useBluetoothConnection(mockBluetoothService)
    );

    act(() => {
      result.current!.startScan();
    });

    const onError = (mockBluetoothService.scanForTriareDevice as jest.Mock)
      .mock.calls[0][1];

    act(() => {
      onError();
    });

    expect(result.current!.status).toBe("error");
    expect(result.current!.error).toBe("BLE scan failed");
  });

  it("should clear previous devices when starting a new scan", () => {
    const { result } = renderHook(() =>
      useBluetoothConnection(mockBluetoothService)
    );

    // First scan: add a device
    act(() => {
      result.current!.startScan();
    });
    const firstOnDeviceFound = (mockBluetoothService.scanForTriareDevice as jest.Mock)
      .mock.calls[0][0];
    act(() => {
      firstOnDeviceFound(createMockDevice({ id: "dev-old" }));
    });
    expect(result.current!.triareDevicesDTO).toHaveLength(1);

    // Second scan: device list should be cleared
    act(() => {
      result.current!.startScan();
    });

    expect(result.current!.triareDevicesDTO).toHaveLength(0);
  });

  it("should clear previous error when starting a new scan", () => {
    const { result } = renderHook(() =>
      useBluetoothConnection(mockBluetoothService)
    );

    // Trigger an error first
    act(() => {
      result.current!.startScan();
    });
    const onError = (mockBluetoothService.scanForTriareDevice as jest.Mock)
      .mock.calls[0][1];
    act(() => {
      onError();
    });
    expect(result.current!.error).toBe("BLE scan failed");

    // Start a new scan: error should be cleared
    act(() => {
      result.current!.startScan();
    });

    expect(result.current!.error).toBeNull();
    expect(result.current!.status).toBe("scanning");
  });

  it("should stop the scan after 10 seconds timeout", () => {
    const { result } = renderHook(() =>
      useBluetoothConnection(mockBluetoothService)
    );

    act(() => {
      result.current!.startScan();
    });

    expect(mockBluetoothService.stopScan).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(10000);
    });

    expect(mockBluetoothService.stopScan).toHaveBeenCalledTimes(1);
  });
});


describe("useBluetoothConnection.stopScan", () => {
  it("should call stopScan on the bluetooth service", () => {
    const { result } = renderHook(() =>
      useBluetoothConnection(mockBluetoothService)
    );

    act(() => {
      result.current!.startScan();
    });

    act(() => {
      result.current!.stopScan();
    });

    expect(mockBluetoothService.stopScan).toHaveBeenCalledTimes(1);
  });

  it("should set status to idle after stopping", () => {
    const { result } = renderHook(() =>
      useBluetoothConnection(mockBluetoothService)
    );

    act(() => {
      result.current!.startScan();
    });
    expect(result.current!.status).toBe("scanning");

    act(() => {
      result.current!.stopScan();
    });

    expect(result.current!.status).toBe("idle");
  });

  it("should work even if called without having started a scan", () => {
    const { result } = renderHook(() =>
      useBluetoothConnection(mockBluetoothService)
    );

    act(() => {
      result.current!.stopScan();
    });

    expect(mockBluetoothService.stopScan).toHaveBeenCalledTimes(1);
    expect(result.current!.status).toBe("idle");
  });
});


describe("useBluetoothConnection.connect", () => {
  it("should set error when the deviceId is not found in bleDevices", async () => {
    const { result } = renderHook(() =>
      useBluetoothConnection(mockBluetoothService)
    );

    await act(async () => {
      await result.current!.connect("non-existent-id");
    });

    expect(result.current!.status).toBe("error");
    expect(result.current!.error).toBe("Device not found");
    expect(mockBluetoothService.connectToDevice).not.toHaveBeenCalled();
  });

  it("should connect successfully when the device exists in the scanned list", async () => {
    const mockDevice = createMockDevice({ id: "dev-1", name: "TRIARE-1" });

    (mockBluetoothService.connectToDevice as jest.Mock).mockResolvedValue(mockDevice);

    const { result } = renderHook(() =>
      useBluetoothConnection(mockBluetoothService)
    );

    // First, scan and discover the device
    act(() => {
      result.current!.startScan();
    });
    const onDeviceFound = (mockBluetoothService.scanForTriareDevice as jest.Mock)
      .mock.calls[0][0];
    act(() => {
      onDeviceFound(mockDevice);
    });

    // Now connect
    await act(async () => {
      await result.current!.connect("dev-1");
    });

    expect(mockBluetoothService.connectToDevice).toHaveBeenCalledWith("dev-1");
    expect(result.current!.status).toBe("connected");
    expect(result.current!.error).toBeNull();
    expect(result.current!.connectedDevice).not.toBeNull();
    expect(result.current!.connectedDevice!.id).toBe("dev-1");
  });

  it("should set selectedDevice when connecting", async () => {
    const mockDevice = createMockDevice({ id: "dev-1", name: "TRIARE-1" });

    (mockBluetoothService.connectToDevice as jest.Mock).mockResolvedValue(mockDevice);

    const { result } = renderHook(() =>
      useBluetoothConnection(mockBluetoothService)
    );

    // Scan and discover the device
    act(() => {
      result.current!.startScan();
    });
    const onDeviceFound = (mockBluetoothService.scanForTriareDevice as jest.Mock)
      .mock.calls[0][0];
    act(() => {
      onDeviceFound(mockDevice);
    });

    // Connect
    await act(async () => {
      await result.current!.connect("dev-1");
    });

    expect(result.current!.selectedDevice).not.toBeNull();
    expect(result.current!.selectedDevice!.id).toBe("dev-1");
  });

  it("should set status to error when connectToDevice throws", async () => {
    const mockDevice = createMockDevice({ id: "dev-1", name: "TRIARE-1" });

    (mockBluetoothService.connectToDevice as jest.Mock).mockRejectedValue(
      new Error("Connection failed")
    );

    const { result } = renderHook(() =>
      useBluetoothConnection(mockBluetoothService)
    );

    // Scan and discover the device
    act(() => {
      result.current!.startScan();
    });
    const onDeviceFound = (mockBluetoothService.scanForTriareDevice as jest.Mock)
      .mock.calls[0][0];
    act(() => {
      onDeviceFound(mockDevice);
    });

    // Try to connect
    await act(async () => {
      await result.current!.connect("dev-1");
    });

    expect(result.current!.status).toBe("error");
    expect(result.current!.error).toBe("Unable to connect to device");
    expect(result.current!.connectedDevice).toBeNull();
  });

  it("should clear previous error when connecting to a valid device", async () => {
    const mockDevice = createMockDevice({ id: "dev-1", name: "TRIARE-1" });

    (mockBluetoothService.connectToDevice as jest.Mock).mockResolvedValue(mockDevice);

    const { result } = renderHook(() =>
      useBluetoothConnection(mockBluetoothService)
    );

    // Trigger an error first by connecting to a non-existent device
    await act(async () => {
      await result.current!.connect("ghost-device");
    });
    expect(result.current!.error).toBe("Device not found");

    // Scan and discover a real device
    act(() => {
      result.current!.startScan();
    });
    const onDeviceFound = (mockBluetoothService.scanForTriareDevice as jest.Mock)
      .mock.calls[0][0];
    act(() => {
      onDeviceFound(mockDevice);
    });

    // Connect to the real device: error should be cleared
    await act(async () => {
      await result.current!.connect("dev-1");
    });

    expect(result.current!.error).toBeNull();
    expect(result.current!.status).toBe("connected");
  });

  it("should connect to the correct device when multiple devices were discovered", async () => {
    const deviceA = createMockDevice({ id: "dev-A", name: "TRIARE-A" });
    const deviceB = createMockDevice({ id: "dev-B", name: "TRIARE-B" });

    (mockBluetoothService.connectToDevice as jest.Mock).mockResolvedValue(deviceB);

    const { result } = renderHook(() =>
      useBluetoothConnection(mockBluetoothService)
    );

    // Discover both devices
    act(() => {
      result.current!.startScan();
    });
    const onDeviceFound = (mockBluetoothService.scanForTriareDevice as jest.Mock)
      .mock.calls[0][0];
    act(() => {
      onDeviceFound(deviceA);
      onDeviceFound(deviceB);
    });

    // Connect to device B specifically
    await act(async () => {
      await result.current!.connect("dev-B");
    });

    expect(mockBluetoothService.connectToDevice).toHaveBeenCalledWith("dev-B");
    expect(result.current!.selectedDevice!.id).toBe("dev-B");
    expect(result.current!.connectedDevice!.id).toBe("dev-B");
  });
});


describe("useBluetoothConnection.triareDevicesDTO mapping", () => {
  it("should map BLE devices to TriareDeviceDTO format", () => {
    const { result } = renderHook(() =>
      useBluetoothConnection(mockBluetoothService)
    );

    act(() => {
      result.current!.startScan();
    });

    const onDeviceFound = (mockBluetoothService.scanForTriareDevice as jest.Mock)
      .mock.calls[0][0];

    const device = createMockDevice({
      id: "dev-1",
      name: "TRIARE-TRIKE",
      rssi: -65,
    });

    act(() => {
      onDeviceFound(device);
    });

    expect(result.current!.triareDevicesDTO).toHaveLength(1);
    expect(result.current!.triareDevicesDTO[0]).toEqual({
      id: "dev-1",
      name: "TRIARE-TRIKE",
      battery: null,
      rssi: -65,
    });
  });

  it("should use 'UNKNOWN' as name when device name and localName are null", () => {
    const { result } = renderHook(() =>
      useBluetoothConnection(mockBluetoothService)
    );

    act(() => {
      result.current!.startScan();
    });

    const onDeviceFound = (mockBluetoothService.scanForTriareDevice as jest.Mock)
      .mock.calls[0][0];

    const device = createMockDevice({
      id: "dev-null",
      name: null,
      localName: null,
    });

    act(() => {
      onDeviceFound(device);
    });

    expect(result.current!.triareDevicesDTO[0].name).toBe("UNKNOWN");
  });
});
