declare module "tide-builder";

export interface TideStation {
    station: string;        // "8447270";
    fileName: string;       // "onset-tides.jpg";
    location: string;       // "Onset, MA";
    application: string;    // "ken@faubel.org";
}

export interface LoggerInterface {
    error(text: string): void;
    warn(text: string): void;
    log(text: string): void;
    info(text: string): void;
    verbose(text: string): void;
    trace(text: string): void;
}

export interface KacheInterface {
    get(key: string): unknown;
    set(key: string, newItem: unknown, expirationTime: number): void;
}

export interface ImageWriterInterface {
    saveFile(fileName: string, buf: Buffer): void;
}

export declare class TideBuilder {
    constructor(logger: LoggerInterface, cache: KacheInterface, writer: ImageWriterInterface): void;
    CreateImages(tideStation: TideStation): Promise<boolean>
}