import { BleTransport, Logger } from '../ble/BleTransport';
import { PidDef } from './pids';

export interface Sample {
  t: number; // ms since session start
  key: string;
  value: number;
  raw: string;
}

/** Drives an ELM327/STN-compatible adapter over an already-connected transport. */
export class ElmSession {
  private startedAt = 0;
  elmVersion = '';

  constructor(private transport: BleTransport, private log: Logger) {}

  private clean(response: string): string {
    return response
      .split('\r')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && l !== 'SEARCHING...')
      .join(' ');
  }

  async init(): Promise<void> {
    this.startedAt = Date.now();
    // ATZ resets the adapter; response is the version banner.
    this.elmVersion = this.clean(await this.transport.request('ATZ', 10000));
    this.log(`Adapter: ${this.elmVersion}`);
    for (const cmd of ['ATE0', 'ATL0', 'ATS0', 'ATH0', 'ATSP0']) {
      const r = this.clean(await this.transport.request(cmd));
      this.log(`${cmd} -> ${r}`);
      if (!r.includes('OK') && !r.includes('ATE0')) {
        // ATE0's own echo can precede OK before echo turns off; anything else must ack.
        if (cmd !== 'ATE0') throw new Error(`Adapter rejected ${cmd}: ${r}`);
      }
    }
    // First real request triggers protocol search against the car.
    this.log('Probing vehicle bus (0100)...');
    const probe = this.clean(await this.transport.request('0100', 15000));
    this.log(`0100 -> ${probe}`);
    if (probe.includes('UNABLE TO CONNECT') || probe.includes('NO DATA')) {
      throw new Error(`Bus probe failed: ${probe} — is the ignition on?`);
    }
    const proto = this.clean(await this.transport.request('ATDPN'));
    this.log(`Protocol: ${proto}`);
  }

  async queryPid(pid: PidDef): Promise<Sample | null> {
    const raw = this.clean(await this.transport.request(pid.request));
    const hex = raw.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    const idx = hex.indexOf(pid.responsePrefix);
    if (idx === -1) {
      this.log(`${pid.request} -> unparseable: "${raw}"`);
      return null;
    }
    const dataHex = hex.slice(idx + pid.responsePrefix.length);
    const bytes: number[] = [];
    for (let i = 0; i + 1 < dataHex.length && bytes.length < 4; i += 2) {
      bytes.push(parseInt(dataHex.slice(i, i + 2), 16));
    }
    if (bytes.length === 0) {
      this.log(`${pid.request} -> no data bytes: "${raw}"`);
      return null;
    }
    return {
      t: Date.now() - this.startedAt,
      key: pid.key,
      value: Math.round(pid.decode(bytes) * 100) / 100,
      raw,
    };
  }
}
