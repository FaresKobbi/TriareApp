import { BleCharacteristicManager } from "../BleCharacteristicManager";

export class BasicCommunicationService{
 constructor(private manager: BleCharacteristicManager){}

 async setValue(value: number): Promise<void> {
    const encoded = btoa(String.fromCharCode(value))
    await this.manager.write()
 }
}