import fs from "fs";
import { TideBuilder } from "./TideBuilder";
import { Logger } from "./Logger";
import { Kache } from "./Kache";
import { SimpleImageWriter } from "./SimpleImageWriter";

// Create a new express application instance
async function run() {
    const logger: Logger = new Logger("tide-builder", "verbose"); 
    const cache: Kache = new Kache(logger, "tides-cache.json");
    const simpleImageWriter: SimpleImageWriter = new SimpleImageWriter(logger, ".");
   
    const tideBuilder: TideBuilder = new TideBuilder(logger, cache, simpleImageWriter);
    const station = "8447270";
    const fileName = "onset-tides.jpg";
    const location = "Onset, MA";
    const application = "ken@faubel.org";

    await tideBuilder.CreateImages(station, fileName, location, application);
    
    logger.info("Done"); 
}

run();