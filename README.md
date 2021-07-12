# tides-builder
This is a module for building images of tide data based on NOAA data.
* It uses pureimage as an alternative to canvas.  Its slower but no native dependencies.
* After additional testing this will be published to npmjs.org

I am slowly working on an applicaiton that will just cycle through images with this, news, weather, sports, etc.  This module will be part of that larger application but it may be useful for others.

The following sample index.js shows how to use it:
```javascript
const fs = require('fs');
const TideImage = require('./TideImage');

// module requires a logger that can be part of a bigger package
// This uses the minimal set of methods to work using just the console.
const logger = {};
logger.info = (...args) => {console.log(...args)};
logger.verbose = (...args) => {console.debug(...args)};
logger.warn = (...args) => {console.warn(...args)};
logger.error = (...args) => {console.error(...args)};

async function main() {
    const tideImage = new TideImage(logger);
    const station: string = "8447270";               // NOAA tide station
    const location: string = "Onset, MA";            // used for the label on screen
    const application: string = "user@domain.comn";  // Passed in the NOAA GET request

    const result = await tideImage.getImageStream(station, location, application);
    
    if (result !== null && result.jpegImg !== null ) {
        fs.writeFileSync('image.jpg', result.jpegImg.data);
    } else {
        logger.error("test.ts: no jpegImg returned from weatherImage.getImageStream");
        process.exit(1);
    }
}

main();
```
