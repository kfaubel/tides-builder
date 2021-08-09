/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { LoggerInterface } from "./Logger";
import { TideImage } from "./TideImage";
import { KacheInterface } from "./Kache";
import { ImageWriterInterface } from "./SimpleImageWriter";

export class TideBuilder {
    private logger: LoggerInterface;
    private cache: KacheInterface;
    private writer: ImageWriterInterface;

    constructor(logger: LoggerInterface, cache: KacheInterface, writer: ImageWriterInterface) {
        this.logger = logger;
        this.cache = cache; 
        this.writer = writer;
    }

    // I would prefer to use the interface commented out above but it does not work direclty.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public async CreateImages(station: string, fileName: string, location: string, application: string): Promise<boolean>{
        try {
            const tideImage: TideImage = new TideImage(this.logger, this.cache);

            const result = await tideImage.getImage(station, location, application);

            if (result !== null && result.imageData !== null ) {
                this.logger.info(`CreateImages: Writing: ${fileName}`);
                this.writer.saveFile(fileName, result.imageData.data);
            } else {
                this.logger.error("CreateImages: No imageData returned from TideImage.getImage()");
                return false;
            }
        } catch (e) {
            this.logger.error(`CreateImages: Exception: ${e}`);
            return false;
        }

        return true;
    }
}
