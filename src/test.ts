import { TideBuilder, TideStation } from "./TideBuilder";
import { Logger } from "./Logger";
import { Kache } from "./Kache";
import { SimpleImageWriter } from "./SimpleImageWriter";

async function run() {
    const logger: Logger = new Logger("tide-builder", "verbose"); 
    const cache: Kache = new Kache(logger, "tides-cache.json");
    const simpleImageWriter: SimpleImageWriter = new SimpleImageWriter(logger, ".");
   
    const tideBuilder: TideBuilder = new TideBuilder(logger, cache, simpleImageWriter);
    const tideStation: TideStation = {
        station: "8447270",
        fileName: "onset-tides.jpg",
        location: "Onset, MA",
        timeZone: "America/New_York",
        application: "ken@faubel.org",
    };

    await tideBuilder.CreateImages(tideStation);
    
    logger.info("Done"); 
}

run();