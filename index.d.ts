// Not sure why this is needed.
// Seems like the CanalCurrentImge.d.ts next to the CanalCurrentImage.js file should be enough...
declare module "tide-builder";

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
    CreateImages(station: string, fileName: string, location: string, application: string): Promise<boolean>
}