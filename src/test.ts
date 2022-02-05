import { TideBuilder, TideStation } from "./TideBuilder";
import { Logger } from "./Logger";
import { Kache } from "./Kache";
import { SimpleImageWriter } from "./SimpleImageWriter";
import dotenv from "dotenv";

async function run() {
    dotenv.config();  // Load var from .env into the environment

    const logger: Logger = new Logger("tide-builder", "verbose"); 
    const cache: Kache = new Kache(logger, "tides-cache.json");
    const simpleImageWriter: SimpleImageWriter = new SimpleImageWriter(logger, ".");

    const userAgent: string | undefined = process.env.USER_AGENT;
    if (typeof userAgent !== "string" ) {
        logger.error("USER_AGENT (email address) is not specified in the environment.  Set it in .env");
        return;
    }
   
    const tideBuilder: TideBuilder = new TideBuilder(logger, cache, simpleImageWriter);
    const tideStation: TideStation = {
        station: "8447270",
        fileName: "onset-tides.jpg",
        location: "Onset, MA",
        timeZone: "America/New_York",
        application: userAgent,
    };

    await tideBuilder.CreateImages(tideStation);
    
    logger.info("Done"); 
}

run();