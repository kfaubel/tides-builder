import fs from 'fs';
import { TideImage } from './TideImage';
import { Logger } from "./Logger";

// Create a new express application instance
async function run() {
    const logger: Logger = new Logger("tide-builder"); 
   
    const tideImage = new TideImage(logger);
    const station: string = "8447270";
    const location: string = "Onset, MA";
    const application: string = "ken@faubel.org";

    const result = await tideImage.getImageStream(station, location, application);
    
    // We now get result.jpegImg
    logger.info(`Writing: image.jpg`);

    if (result !== null && result.jpegImg !== null ) {
        fs.writeFileSync('image.jpg', result.jpegImg.data);
    } else {
        logger.error("test.ts: no jpegImg returned from weatherImage.getImageStream");
        process.exit(1);
    }

    logger.info(`Expires at: ${result.expires}`)
    
    logger.info("Done"); 
}

run();