/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { LoggerInterface } from "./Logger";
import { TideImage } from "./TideImage";
import { KacheInterface } from "./Kache";
import { ImageWriterInterface } from "./SimpleImageWriter";

export interface TideStation {
    station: string;        // "8447270";
    fileName: string;       // "onset-tides.jpg";
    location: string;       // "Onset, MA";
    timeZone: string;       // "America/New_York"
    application: string;      // "name@domain.com";
}

export class TideBuilder {
    private logger: LoggerInterface;
    private cache: KacheInterface;
    private writer: ImageWriterInterface;

    constructor(logger: LoggerInterface, cache: KacheInterface, writer: ImageWriterInterface) {
        this.logger = logger;
        this.cache = cache; 
        this.writer = writer;
    }

    public async CreateImages(tideStation: TideStation): Promise<boolean>{
        try {
            const tideImage: TideImage = new TideImage(this.logger, this.cache);

            const result = await tideImage.getImage(tideStation.station, tideStation.location, tideStation.timeZone, tideStation.application);

            if (result !== null && result.imageData !== null ) {
                this.logger.info(`TideBuilder: Writing: ${tideStation.fileName}`);
                this.writer.saveFile(tideStation.fileName, result.imageData.data);
            } else {
                this.logger.warn(`TideBuilder: No image for ${tideStation.fileName}`);
                return false;
            }
        } catch(e) {
            this.logger.error(`TideBuilder: Exception: : ${e}`);
            return false;
        }

        return true;
    }
}
