import { mapBleDeviceToTriareDeviceDTO, TriareDeviceDTO } from "@/src/models/triareDeviceDTO";
import { Device } from "react-native-ble-plx";

describe("mapBleDeviceToTriareDeviceDTO unit test", () => {
  it("should map a complete BLE device to a TriareDeviceDTO", () => {
    const bleDevice = {
      id: "triare-001",
      name: "TRIARE-001",
      localName: "TRIARE Local",
      rssi: -45,
    } as Device;

    const result: TriareDeviceDTO = mapBleDeviceToTriareDeviceDTO(bleDevice);

    expect(result).toEqual({
      id: "triare-001",
      name: "TRIARE-001",
      battery: null,
      rssi: -45,
    });
  });

  it("should use localName when name is missing", () => {
    const bleDevice = {
      id: "triare-002",
      name: null,
      localName: "TRIARE Local Name",
      rssi: -60,
    } as Device;

    const result = mapBleDeviceToTriareDeviceDTO(bleDevice);

    expect(result).toEqual({
      id: "triare-002",
      name: "TRIARE Local Name",
      battery: null,
      rssi: -60,
    });
  });

  it("should use UNKNOWN and null rssi when name, localName and rssi are missing", () => {
    const bleDevice = {
      id: "triare-003",
      name: null,
      localName: null,
      rssi: null,
    } as Device;

    const result = mapBleDeviceToTriareDeviceDTO(bleDevice);

    expect(result).toEqual({
      id: "triare-003",
      name: "UNKNOWN",
      battery: null,
      rssi: null,
    });
  });
});