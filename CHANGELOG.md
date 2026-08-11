# [1.3.0](https://github.com/FaresKobbi/TriareApp/compare/v1.2.0...v1.3.0) (2026-08-11)


### Bug Fixes

* bad bluetoothConnectionHandler impor ([8578f30](https://github.com/FaresKobbi/TriareApp/commit/8578f302d6106d6e18502a65000fd08dcf02883b))


### Features

* add ble protocol communication ([34e8b02](https://github.com/FaresKobbi/TriareApp/commit/34e8b026745f57988002e1a2f9ed693f0883e92f))
* add ble protocol communication merged in main ([0c66d39](https://github.com/FaresKobbi/TriareApp/commit/0c66d390a387ca742f6d4ffd604b54b158994d7d))
* **ble:** add BleCharacteristicManager ([04b7c0e](https://github.com/FaresKobbi/TriareApp/commit/04b7c0e2edb7229211fbae66b33573a3b1490f3f))
* **ble:** add per-connection session layer with context and basic communication ([d1164a1](https://github.com/FaresKobbi/TriareApp/commit/d1164a12aa75b2b1f4ec4cfee04c9ff190cf06cb))
* **ble:** expose useMotorControl hook for the motor test screen ([9dc1ec7](https://github.com/FaresKobbi/TriareApp/commit/9dc1ec73ce553777657f13563c08e399ebc59a98))
* **ble:** implement WBA65 TRIARE command protocol layer ([9fdfa9e](https://github.com/FaresKobbi/TriareApp/commit/9fdfa9e9be68d523e924e36feec2919de40d69f9))

# [1.2.0](https://github.com/FaresKobbi/TriareApp/compare/v1.1.0...v1.2.0) (2026-05-29)


### Bug Fixes

* **bluetooth:** change STM32 name for basic recognition ([bbf30ee](https://github.com/FaresKobbi/TriareApp/commit/bbf30ee6d6d4d820450f55d09554d647d6a345ec))
* manage null field for devices display after scan ([948f3fa](https://github.com/FaresKobbi/TriareApp/commit/948f3fabc6f5ca42d1799057b0d5fadb864746b6))
* **ui:** update triare dto import and rssi display in AppDeviceSeclector ([168f5b5](https://github.com/FaresKobbi/TriareApp/commit/168f5b5c49b77a6ef3970c52b57cce58f9e364dd))


### Features

* **bluetooth:** add bluetooth scanning and connection to basic STM device ([d895aed](https://github.com/FaresKobbi/TriareApp/commit/d895aedf67d1852fea4dca9ae43447b8b33dc9f8))
* **bluetooth:** add bluetooth scanning and connection to basic STM device MERGED TO MAIN ([51074a4](https://github.com/FaresKobbi/TriareApp/commit/51074a46e39a09343b05f79c126d4eaee57ecd8a))
* **bluetooth:** add connection to ble device onPress AppDeviceSelector ([e1eed8a](https://github.com/FaresKobbi/TriareApp/commit/e1eed8afb59f19a7b9d29c4c1ba312e6795473e5))
* **bluetooth:** add ensureBluetoothPermissions with retry dialog ([a8114e5](https://github.com/FaresKobbi/TriareApp/commit/a8114e5831fea314d8b734527cc8070e77e84d8c))
* **bluetooth:** implement BLE scanning, device filtering, and dependency injection ([8c9aae0](https://github.com/FaresKobbi/TriareApp/commit/8c9aae06fd3e9d7a711a331c870fbbff362d61df))
* **bluetooth:** implement bluetooth permission request and scanning ([eb09278](https://github.com/FaresKobbi/TriareApp/commit/eb09278e1be9c585e1ad59e6da1493dc043221ba))
* **bluetooth:** implement useBluetoothConnection hook ([23dcb6e](https://github.com/FaresKobbi/TriareApp/commit/23dcb6e11c1d5aee970919a47226cf47aadcbc62))

# [1.1.0](https://github.com/FaresKobbi/TriareApp/compare/v1.0.0...v1.1.0) (2026-05-20)


### Bug Fixes

* correct bad index export ([7bd93ec](https://github.com/FaresKobbi/TriareApp/commit/7bd93ec451e9b518e263a3485f6243298ad07777))


### Features

* add devices list display, missing click icon and battery level ([4353c14](https://github.com/FaresKobbi/TriareApp/commit/4353c14fb02162c398d863ad0d06ecbdc2825ce5))
* **connectionScreen:** add triare device battery status bar ([0954347](https://github.com/FaresKobbi/TriareApp/commit/09543472720268bf57349cb099fecad7de7d27ad))
* **connectionScrenn:** add mocked device list display ([7aabc07](https://github.com/FaresKobbi/TriareApp/commit/7aabc078c37714371ca53ace73a9f01645f140e6))
* finish connection page front, add tests and github wf for ci ([4e75b3c](https://github.com/FaresKobbi/TriareApp/commit/4e75b3c45d46fdbe025b33d71292472688a1424e))

# 1.0.0 (2026-05-14)


### Bug Fixes

* changed scan button color an transformation on press ([d6b395e](https://github.com/FaresKobbi/TriareApp/commit/d6b395e455f06af119b142975e9619d150377585))
* changed scan button color an transformation on press ([b0c1d5d](https://github.com/FaresKobbi/TriareApp/commit/b0c1d5d1bae398c5ed27ac918f0ffaf729071059))


### Features

* add connection page, title and scan sections ([b579687](https://github.com/FaresKobbi/TriareApp/commit/b57968769670eef8048dd11d8f43b34b56eb11a1))
* added title, scan section ([1da226a](https://github.com/FaresKobbi/TriareApp/commit/1da226a02c417b35a7ce730c41cdd9ca057703ce))
* added title, scan section ([a9a35f6](https://github.com/FaresKobbi/TriareApp/commit/a9a35f6e1510376e5d967e1f33dc4c07785a58da))
* started connection screen, added basic ci and release pipeline ([eb9f1e6](https://github.com/FaresKobbi/TriareApp/commit/eb9f1e6e2183c8bb91c4ede186b57f237b332be0))
