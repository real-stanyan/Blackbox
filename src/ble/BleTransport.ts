import { BleManager, Device, Subscription } from 'react-native-ble-plx';
import { asciiToBase64, base64ToAscii } from './base64';

export interface GattCharInfo {
  serviceUUID: string;
  uuid: string;
  isNotifiable: boolean;
  isWritableWithResponse: boolean;
  isWritableWithoutResponse: boolean;
}

export interface GattDump {
  deviceId: string;
  deviceName: string | null;
  characteristics: GattCharInfo[];
  chosenNotify: { service: string; char: string } | null;
  chosenWrite: { service: string; char: string; withResponse: boolean } | null;
}

export type Logger = (line: string) => void;

// OBDLink CX exposes a BLE serial channel: one notify characteristic (adapter -> app)
// and one write characteristic (app -> adapter). UUIDs are not documented, so we
// discover everything and pick the first notify + write pair in the same service,
// preferring vendor (128-bit non-standard) services.
export class BleTransport {
  private manager = new BleManager();
  private device: Device | null = null;
  private notifySub: Subscription | null = null;
  private writeService = '';
  private writeChar = '';
  private writeWithResponse = true;
  private rxBuffer = '';
  private onChunk: ((buffered: string) => void) | null = null;
  gattDump: GattDump | null = null;

  constructor(private log: Logger) {}

  /**
   * Continuous scan reporting every device seen (named or not) via callback.
   * Caller decides which to connect to. Returns a stop function.
   */
  startScan(onDevice: (device: Device) => void): () => void {
    let stopped = false;
    const begin = () => {
      if (stopped) return;
      this.log('Scanning (all BLE devices)...');
      this.manager.startDeviceScan(null, { allowDuplicates: false }, (error, device) => {
        if (error) {
          this.log(`!! scan error: ${error.message}`);
          return;
        }
        if (device) onDevice(device);
      });
    };
    // BLE stack may still be powering up right after app launch — wait for poweredOn.
    const sub = this.manager.onStateChange((state) => {
      if (state === 'PoweredOn') {
        sub.remove();
        begin();
      } else {
        this.log(`Bluetooth state: ${state}...`);
      }
    }, true);
    return () => {
      stopped = true;
      sub.remove();
      this.manager.stopDeviceScan();
    };
  }

  async connect(device: Device): Promise<void> {
    this.log(`Connecting to ${device.name ?? device.id}...`);
    // requestMTU is Android-only; iOS negotiates MTU automatically.
    this.device = await device.connect({ requestMTU: 185 });
    this.device.onDisconnected((_err, d) => this.log(`!! Disconnected from ${d?.name ?? d?.id}`));
    this.log('Discovering services/characteristics...');
    await this.device.discoverAllServicesAndCharacteristics();

    const chars: GattCharInfo[] = [];
    for (const service of await this.device.services()) {
      for (const ch of await service.characteristics()) {
        chars.push({
          serviceUUID: service.uuid,
          uuid: ch.uuid,
          isNotifiable: ch.isNotifiable,
          isWritableWithResponse: ch.isWritableWithResponse,
          isWritableWithoutResponse: ch.isWritableWithoutResponse,
        });
        this.log(
          `  ${service.uuid.slice(0, 8)}/${ch.uuid.slice(0, 8)} ` +
            `${ch.isNotifiable ? 'N' : '-'}${ch.isWritableWithResponse ? 'W' : '-'}${ch.isWritableWithoutResponse ? 'w' : '-'}`
        );
      }
    }

    // Rank candidate services. 0xfff0/0xffe0 are the classic OBD BLE serial layouts.
    // 0xfef5 is Dialog SUOTA (firmware update) — looks like a serial pair but is not.
    const rank = (uuid: string): number => {
      const u = uuid.toLowerCase();
      if (u.startsWith('0000fff0')) return 0;
      if (u.startsWith('0000ffe0')) return 1;
      if (u.startsWith('0000fef5')) return 9; // SUOTA — try only as a last resort
      if (['00001800', '00001801', '0000180a', '0000180f'].some((s) => u.startsWith(s))) return 8;
      return 2;
    };
    const services = [...new Set(chars.map((c) => c.serviceUUID))].sort((a, b) => rank(a) - rank(b));

    // Build (notify, write) candidate pairs, then probe each with ATZ — the pair
    // that answers is the serial channel. No more guessing from structure alone.
    const pairs: { n: GattCharInfo; w: GattCharInfo }[] = [];
    for (const svc of services) {
      const inSvc = chars.filter((c) => c.serviceUUID === svc);
      const notifies = inSvc.filter((c) => c.isNotifiable);
      const writes = inSvc.filter((c) => c.isWritableWithResponse || c.isWritableWithoutResponse);
      for (const n of notifies) for (const w of writes) pairs.push({ n, w });
    }

    this.gattDump = {
      deviceId: this.device.id,
      deviceName: this.device.name,
      characteristics: chars,
      chosenNotify: null,
      chosenWrite: null,
    };

    if (pairs.length === 0) {
      throw new Error('No notify+write characteristic pair found — export the GATT dump and inspect.');
    }

    let adopted = false;
    for (const [i, { n, w }] of pairs.entries()) {
      this.log(`Probing ${n.serviceUUID.slice(4, 8)}: notify=${n.uuid.slice(4, 8)} write=${w.uuid.slice(4, 8)}...`);
      // CX data channel is encrypted: first-ever access triggers the iOS pairing
      // dialog, which the user may take several seconds to accept. Give the top
      // candidate a window generous enough to cover that.
      if (await this.probePair(n, w, i === 0 ? 12000 : 4000)) {
        this.gattDump.chosenNotify = { service: n.serviceUUID, char: n.uuid };
        this.gattDump.chosenWrite = { service: w.serviceUUID, char: w.uuid, withResponse: w.isWritableWithResponse };
        this.log(`Serial channel confirmed: ${n.uuid.slice(4, 8)}/${w.uuid.slice(4, 8)}`);
        adopted = true;
        break;
      }
    }
    if (!adopted) {
      throw new Error(
        'No candidate pair answered ATZ. The CX only accepts new bonds for 5 minutes after ' +
          'power-on: unplug/replug the adapter, reconnect, and accept the iOS pairing dialog ' +
          '(PIN 123456 if asked). If no dialog ever appeared, export the GATT dump and send it over.'
      );
    }
  }

  /** Subscribe to a candidate pair, fire ATZ, adopt the pair if anything comes back. */
  private async probePair(n: GattCharInfo, w: GattCharInfo, timeoutMs = 4000): Promise<boolean> {
    if (!this.device) return false;
    this.notifySub?.remove();
    this.rxBuffer = '';
    this.writeService = w.serviceUUID;
    this.writeChar = w.uuid;
    this.writeWithResponse = w.isWritableWithResponse;
    try {
      this.notifySub = this.device.monitorCharacteristicForService(n.serviceUUID, n.uuid, (error, characteristic) => {
        if (error) {
          if (!error.message.includes('cancelled')) {
            this.log(`!! notify error: ${error.message}`);
            if (/encrypt|authenticat|pair|bond/i.test(error.message)) {
              this.log('>> CX needs BLE pairing. Power-cycle it (bonds only in first 5 min), reconnect, accept the iOS dialog.');
            }
          }
          return;
        }
        if (characteristic?.value) {
          this.rxBuffer += base64ToAscii(characteristic.value);
          this.onChunk?.(this.rxBuffer);
        }
      });
      // monitorCharacteristicForService returns before the CCCD write that actually
      // enables notifications lands. Writing ATZ immediately races that: the adapter's
      // echo can be emitted before notifications are on and get dropped. Wait for the
      // subscription to settle first.
      await this.delay(400);
      const got = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
          this.onChunk = null;
          resolve(false);
        }, timeoutMs);
        this.onChunk = (buffered) => {
          if (buffered.length > 0) {
            clearTimeout(timer);
            this.onChunk = null;
            resolve(true);
          }
        };
        const fire = () =>
          this.write('ATZ\r').catch((e: any) => {
            this.log(`  !! ATZ write failed: ${e.message}`);
            if (/encrypt|authenticat|pair|bond/i.test(e.message)) {
              // iOS pairing dialog is likely on screen — keep the probe window
              // open and retry after the user has had a moment to accept it.
              setTimeout(() => {
                if (this.onChunk) fire();
              }, 2000);
            } else {
              clearTimeout(timer);
              this.onChunk = null;
              resolve(false);
            }
          });
        fire();
        // A cold CX frequently swallows the first ATZ; nudge once more mid-window
        // if nothing has come back yet.
        setTimeout(() => {
          if (this.onChunk) fire();
        }, 1500);
      });
      if (!got) {
        this.log('  no answer — next candidate');
        this.notifySub?.remove();
        this.notifySub = null;
      }
      return got;
    } catch (e: any) {
      this.log(`  probe failed: ${e.message}`);
      this.notifySub?.remove();
      this.notifySub = null;
      return false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Send raw bytes, chunked to stay under any BLE MTU (CX docs warn writes over MTU fail). */
  async write(data: string): Promise<void> {
    if (!this.device) throw new Error('Not connected');
    const CHUNK = 20;
    for (let i = 0; i < data.length; i += CHUNK) {
      const b64 = asciiToBase64(data.slice(i, i + CHUNK));
      if (this.writeWithResponse) {
        await this.device.writeCharacteristicWithResponseForService(this.writeService, this.writeChar, b64);
      } else {
        await this.device.writeCharacteristicWithoutResponseForService(this.writeService, this.writeChar, b64);
      }
    }
  }

  /** Send a command and resolve with everything received up to the '>' prompt. */
  async request(command: string, timeoutMs = 5000): Promise<string> {
    this.rxBuffer = '';
    return new Promise(async (resolve, reject) => {
      const timer = setTimeout(() => {
        this.onChunk = null;
        reject(new Error(`Timeout waiting for response to "${command}" (got: "${this.rxBuffer.trim()}")`));
      }, timeoutMs);
      this.onChunk = (buffered) => {
        if (buffered.includes('>')) {
          clearTimeout(timer);
          this.onChunk = null;
          resolve(buffered.slice(0, buffered.indexOf('>')));
        }
      };
      try {
        await this.write(command + '\r');
      } catch (e) {
        clearTimeout(timer);
        this.onChunk = null;
        reject(e);
      }
    });
  }

  async disconnect(): Promise<void> {
    this.notifySub?.remove();
    this.notifySub = null;
    if (this.device) {
      await this.device.cancelConnection().catch(() => {});
      this.device = null;
    }
  }

  destroy(): void {
    this.manager.destroy();
  }
}
