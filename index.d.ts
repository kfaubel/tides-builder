declare module "canal-current-builder";

export interface ImageResult {
    expires: string;
    imageType: string;
    imageData: jpeg.BufferRet | null;
}

export declare class TideImage {
    constructor(logger: LoggerInterface, cache: KacheInterface): void;
    getImage(): Promise<ImageResult | null>;
}