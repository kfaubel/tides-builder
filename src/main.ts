import fs from "fs";
import { TideImage } from "./TideImage";
import { Logger } from "./Logger";
import { Kache } from "./Kache";

// Create a new express application instance
async function run() {
    const logger: Logger = new Logger("tide-builder", "verbose"); 

    const cache: Kache = new Kache(logger, "tides-cache.json");
   
    const tideImage: TideImage = new TideImage(logger, __dirname, cache);
    const station = "8447270";
    const location = "Onset, MA";
    const application = "ken@faubel.org";

    const result = await tideImage.getImage(station, location, application);
    
    // We now get result.jpegImg
    logger.info("Writing: image.jpg");

    if (result !== null && result.imageData !== null ) {
        fs.writeFileSync("image.jpg", result.imageData.data);
    } else {
        logger.error("test.ts: no jpegImg returned from weatherImage.getImageStream");
        process.exit(1);
    }
    
    logger.info("Done"); 
}

run();